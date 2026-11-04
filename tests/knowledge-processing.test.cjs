/* eslint-disable @typescript-eslint/no-require-imports -- This CommonJS harness injects offline dependencies into transpiled modules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const run = vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename: file });
  run((name) => name in mocks ? mocks[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}

function harness({ text, failEmbeddingCall } = {}) {
  const embeddingCalls = [];
  const inserts = [];
  const documentUpdates = [];
  const chunkDeletes = [];
  const db = {
    knowledgeDocument: {
      findUnique: async () => ({ id: 'doc', blobUrl: 'blob', contentType: 'text/plain' }),
      update: async ({ data }) => { documentUpdates.push(data); },
    },
    knowledgeChunk: { deleteMany: async () => { chunkDeletes.push(true); } },
    $executeRaw: async (strings, ...values) => { inserts.push({ sql: strings.join('?'), values }); },
  };
  const knowledge = load('src/lib/knowledge-processing.ts', {
    '@vercel/blob': { get: async () => ({ statusCode: 200, stream: new Blob([text]).stream() }) },
    mammoth: {},
    'pdf-parse/lib/pdf-parse': () => {},
    openai: class {
      embeddings = { create: async ({ input }) => {
        embeddingCalls.push(input.length);
        if (failEmbeddingCall === embeddingCalls.length) throw new Error('rate limited');
        // Return out of order to verify results are matched by index.
        return { data: input.map((_, index) => ({ index, embedding: Array(1536).fill(index / 1000) })).reverse() };
      } };
    },
    '@/lib/db': { getDb: () => db },
  });
  return { knowledge, embeddingCalls, inserts, documentUpdates, chunkDeletes };
}

const longText = Array.from({ length: 2000 }, (_, i) => `Sentence number ${i} about the campaign.`).join(' ');

test('large documents are embedded in batches with progress after each batch', async () => {
  process.env.OPENAI_API_KEY = 'offline-test';
  const h = harness({ text: longText });
  const result = await h.knowledge.processKnowledgeDocument('doc');
  assert.equal(result.ok, true);
  const total = h.embeddingCalls.reduce((sum, size) => sum + size, 0);
  assert.ok(h.embeddingCalls.length > 1, 'expected multiple embedding batches');
  assert.ok(h.embeddingCalls.every((size) => size <= 96));
  assert.equal(h.inserts.length, h.embeddingCalls.length, 'one INSERT statement per batch');
  assert.match(h.inserts[0].sql, /unnest/);
  const progress = h.documentUpdates.map((data) => data.processedChunkCount).filter((value) => value > 0);
  assert.deepEqual(progress.at(-1), total);
  assert.equal(h.documentUpdates.find((data) => data.chunkCount).chunkCount, total);
  assert.equal(h.documentUpdates.at(-1).status, 'READY');
  // Sequences in the second batch continue where the first ended.
  assert.equal(h.inserts[1].values[1][0], 96);
});

test('a failing batch marks the document FAILED, removes partial chunks, and does not throw', async () => {
  process.env.OPENAI_API_KEY = 'offline-test';
  const h = harness({ text: longText, failEmbeddingCall: 2 });
  const result = await h.knowledge.processKnowledgeDocument('doc');
  assert.equal(result.ok, false);
  assert.equal(h.documentUpdates.at(-1).status, 'FAILED');
  assert.match(h.documentUpdates.at(-1).processingError, /rate limited/);
  assert.equal(h.chunkDeletes.length, 2, 'cleared before processing and after failure');
});

test('bounded worker pool processes every claimed document', async () => {
  process.env.OPENAI_API_KEY = 'offline-test';
  const h = harness({ text: 'Short campaign brochure text.' });
  const result = await h.knowledge.processKnowledgeDocuments(['a', 'b', 'c']);
  assert.deepEqual({ ...result }, { processed: 3, failed: 0 });
});
