/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS harness injects offline dependencies into transpiled modules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual route and component with offline service/SDK doubles.
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const run = vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename: file });
  run((name) => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

const intent = load('src/lib/conversation-intent.ts');
test('corrections and interruption checks do not restart the greeting', () => {
  assert.equal(intent.directConversationResponse("I said no worries, it's okay."), 'No problem. Take your time.');
  assert.equal(intent.directConversationResponse('Are you trying to say something?'), 'Sorry for the interruption. Please go ahead.');
  assert.equal(intent.directConversationResponse("Nobody's."), null);
  assert.equal(intent.directConversationResponse("Okay, so if I'm looking for any."), null);
});

function routeHarness() {
  const calls = [];
  let retrievals = 0;
  const route = load('src/app/api/recipient-links/[token]/sessions/[sessionId]/rag-reply/route.ts', {
    openai: class {
      responses = { create: async (input) => {
        calls.push(input);
        return (async function* () { yield { type: 'response.output_text.delta', delta: 'Test response.' }; })();
      } };
    },
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/db': { getDb: () => ({ avatarSession: { findFirst: async () => ({
      recipientLink: {},
      campaignRecipient: { campaignId: 'campaign', campaign: { name: 'New Estate', message: 'An invitation to discuss New Estate.' }, recipient: { firstName: 'Sam' } },
    }) } }) },
    '@/lib/conversation-intent': intent,
    '@/lib/knowledge-processing': { retrieveCampaignKnowledge: async () => { retrievals++; return []; } },
  });
  return { calls, get retrievals() { return retrievals; }, reply: (messages) => route.POST(new Request('http://localhost/reply', {
    method: 'POST', body: JSON.stringify({ messages }),
  }), { params: Promise.resolve({ token: 'token', sessionId: 'session' }) }) };
}

test('email purpose uses approved outreach even when retrieval has no passages', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'offline-test';
  try {
    const harness = routeHarness();
    const response = await harness.reply([{ role: 'user', content: 'So what is this email regarding?' }]);
    assert.equal(await response.text(), 'Test response.');
    assert.equal(harness.calls.length, 1);
    assert.match(harness.calls[0].input, /An invitation to discuss New Estate/);
    assert.match(harness.calls[0].instructions, /Do not invent why this particular person was selected/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('reassurance is answered without retrieval or generation', async () => {
  const harness = routeHarness();
  const response = await harness.reply([{ role: 'user', content: "I said no worries, it's okay." }]);
  assert.equal(await response.text(), 'No problem. Take your time.');
  assert.equal(harness.retrievals, 0);
  assert.equal(harness.calls.length, 0);
});

test('new speech aborts an older answer and prevents stale audio', async () => {
  const originalFetch = global.fetch;
  const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  const listeners = {};
  const speech = [];
  let cleanup;
  let requestSignal;
  let finishReply;
  const client = {
    addListener: (event, listener) => { listeners[event] = listener; },
    streamToVideoElement: async () => {}, stopStreaming: async () => {}, interruptPersona: () => {},
    createTalkMessageStream: () => ({ streamMessageChunk: async (text) => speech.push(text), endMessage: async () => {} }),
  };
  const events = Object.fromEntries(['USER_SPEECH_STARTED', 'MESSAGE_HISTORY_UPDATED', 'CONNECTION_CLOSED', 'SESSION_READY'].map((name) => [name, name]));
  Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } } });
  global.fetch = async (url, options) => {
    if (url.endsWith('/avatar-session')) return Response.json({ sessionToken: 'token', sessionId: 'session' });
    requestSignal = options.signal;
    return new Promise((resolve) => { finishReply = () => resolve(new Response('An outdated answer.')); });
  };
  try {
    const component = load('src/app/r/[token]/recipient-experience.tsx', {
      '@anam-ai/js-sdk': { createClient: () => client, AnamEvent: events },
      react: { useRef: (current) => ({ current }), useState: (value) => [value, () => {}], useEffect: (effect) => { cleanup = effect(); } },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    });
    const tree = component.RecipientExperience({ firstName: null, campaignName: 'Campaign', message: 'Message', token: 'token' });
    function findStart(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'button' && node.props.children === 'Start conversation') return node;
      for (const child of [node.props?.children].flat()) { const found = findStart(child); if (found) return found; }
    }
    await findStart(tree).props.onClick();
    listeners.MESSAGE_HISTORY_UPDATED([{ id: 'first', role: 'user', content: 'What is this email about?' }]);
    assert.equal(requestSignal.aborted, false);
    listeners.USER_SPEECH_STARTED();
    assert.equal(requestSignal.aborted, true);
    finishReply();
    await new Promise(setImmediate);
    assert.deepEqual(speech, []);
  } finally {
    cleanup?.();
    global.fetch = originalFetch;
    if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator);
    else delete global.navigator;
  }
});
