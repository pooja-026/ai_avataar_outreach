/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads the transpiled TypeScript module. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename: file })(require, loaded, loaded.exports);
  return loaded.exports;
}

const { planTranscriptWrite } = load('src/lib/transcript.ts');
const user = (content) => ({ role: 'USER', content });
const avatar = (content) => ({ role: 'ASSISTANT', content });
const stored = (sequence, turn) => ({ sequence, ...turn });

// Applies a plan to an in-memory transcript, like the route does in the database.
function apply(transcript, incoming) {
  const plan = planTranscriptWrite(transcript.length, transcript.length ? stored(transcript.length, transcript.at(-1)) : null, incoming);
  if (plan.updateLast) transcript.at(-1).content = plan.updateLast;
  transcript.push(...plan.append.map(({ role, content }) => ({ role, content })));
  return plan;
}

test('first save appends every message with sequences from 1', () => {
  const plan = planTranscriptWrite(0, null, [user('Hi'), avatar('Hello!')]);
  assert.deepEqual(plan.append.map((turn) => turn.sequence), [1, 2]);
  assert.equal(plan.updateLast, null);
});

test('later saves append only the new messages', () => {
  const transcript = [user('Hi'), avatar('Hello!')];
  const plan = apply(transcript, [user('Hi'), avatar('Hello!'), user('What is the price?')]);
  assert.deepEqual(plan.append, [{ role: 'USER', content: 'What is the price?', sequence: 3 }]);
  assert.equal(transcript.length, 3);
});

test('a streaming avatar reply grows in place', () => {
  const transcript = [user('Price?'), avatar('It starts')];
  apply(transcript, [user('Price?'), avatar('It starts at 2 lakh.')]);
  assert.deepEqual(transcript, [user('Price?'), avatar('It starts at 2 lakh.')]);
});

test('a late, older snapshot cannot shorten or erase the transcript', () => {
  const transcript = [user('Price?'), avatar('It starts at 2 lakh.'), user('And parking?')];
  apply(transcript, [user('Price?')]);
  apply(transcript, [user('Price?'), avatar('It starts')]);
  apply(transcript, [user('Price?'), avatar('It starts at 2 lakh.'), user('And')]);
  assert.deepEqual(transcript, [user('Price?'), avatar('It starts at 2 lakh.'), user('And parking?')]);
});

test('earlier messages are never rewritten by a tampered payload', () => {
  const transcript = [user('Price?'), avatar('It starts at 2 lakh.'), user('Thanks')];
  apply(transcript, [user('I want to buy ten units'), avatar('Great, ten units it is'), user('Thanks'), avatar('You are welcome.')]);
  assert.deepEqual(transcript.slice(0, 2), [user('Price?'), avatar('It starts at 2 lakh.')]);
  assert.equal(transcript.length, 4);
});

test('a refined transcription of the last message replaces it', () => {
  const transcript = [avatar('Hello!'), user('I wont the price')];
  apply(transcript, [avatar('Hello!'), user('I want the price')]);
  assert.equal(transcript.at(-1).content, 'I want the price');
});
