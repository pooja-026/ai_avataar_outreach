/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness injects an in-memory database into the transpiled module. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename: file })((name) => mocks[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

// Minimal in-memory stand-in for the Prisma calls used, evaluating each
// conditional update atomically like Postgres does for a single row.
function memoryDb() {
  const links = new Map();
  const sessions = new Map();
  const matches = (row, where) => Object.entries(where).every(([key, condition]) => {
    if (key === 'id') return row.id === condition;
    if (key === 'OR') return condition.some((option) => matches(row, option));
    if (condition === null) return row[key] === null;
    if ('lt' in condition) return row[key] < condition.lt;
    if ('gt' in condition) return row[key] > condition.gt;
    if ('lte' in condition) return row[key] !== null && row[key] <= condition.lte;
    throw new Error(`unsupported condition ${key}`);
  });
  const apply = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
      else if (value && typeof value === 'object' && 'decrement' in value) row[key] -= value.decrement;
      else row[key] = value;
    }
  };
  const table = (rows) => ({
    updateMany: async ({ where, data }) => {
      await new Promise((resolve) => setImmediate(resolve)); // let concurrent calls interleave
      const row = rows.get(where.id);
      if (!row || !matches(row, where)) return { count: 0 };
      apply(row, data);
      return { count: 1 };
    },
    findUnique: async ({ where }) => rows.get(where.id) ?? null,
  });
  return { links, sessions, db: { recipientLink: table(links), avatarSession: table(sessions) } };
}

function setup(env = {}) {
  for (const key of ['LIMIT_SESSIONS_PER_LINK', 'LIMIT_REPLIES_PER_SESSION', 'LIMIT_SESSION_MINUTES', 'LIMIT_REPLY_INTERVAL_MS']) delete process.env[key];
  Object.assign(process.env, env);
  const memory = memoryDb();
  const limits = load('src/lib/rate-limits.ts', { '@/lib/db': { getDb: () => memory.db } });
  return { ...memory, limits };
}

test('a link allows only the configured number of avatar sessions, even under concurrency', async () => {
  const { links, limits } = setup({ LIMIT_SESSIONS_PER_LINK: '3' });
  links.set('link', { id: 'link', sessionCount: 0 });
  const results = await Promise.all(Array.from({ length: 10 }, () => limits.claimAvatarSessionSlot('link')));
  assert.equal(results.filter(Boolean).length, 3);
  assert.equal(links.get('link').sessionCount, 3);
});

test('a failed provider call gives the session slot back', async () => {
  const { links, limits } = setup({ LIMIT_SESSIONS_PER_LINK: '1' });
  links.set('link', { id: 'link', sessionCount: 0 });
  assert.equal(await limits.claimAvatarSessionSlot('link'), true);
  await limits.releaseAvatarSessionSlot('link');
  assert.equal(await limits.claimAvatarSessionSlot('link'), true);
  await limits.releaseAvatarSessionSlot('link');
  await limits.releaseAvatarSessionSlot('link');
  assert.equal(links.get('link').sessionCount, 0, 'never goes negative');
});

test('replies are capped per session and a burst is told apart from exhaustion', async () => {
  const { sessions, limits } = setup({ LIMIT_REPLIES_PER_SESSION: '2', LIMIT_REPLY_INTERVAL_MS: '1000' });
  const start = new Date('2026-11-06T10:00:00Z');
  sessions.set('s', { id: 's', createdAt: start, replyCount: 0, lastReplyAt: null });
  const session = sessions.get('s');
  const at = (ms) => new Date(start.getTime() + ms);
  assert.equal(await limits.claimReplySlot(session, at(1_000)), 'ok');
  assert.equal(await limits.claimReplySlot(session, at(1_500)), 'burst', 'within the interval');
  assert.equal(await limits.claimReplySlot(session, at(2_100)), 'ok');
  assert.equal(await limits.claimReplySlot(session, at(9_000)), 'exhausted', 'reply allowance used');
});

test('concurrent replies cannot exceed the interval rule', async () => {
  const { sessions, limits } = setup();
  const now = new Date();
  sessions.set('s', { id: 's', createdAt: now, replyCount: 0, lastReplyAt: null });
  const results = await Promise.all(Array.from({ length: 8 }, () => limits.claimReplySlot(sessions.get('s'), now)));
  assert.deepEqual(results.filter((result) => result === 'ok').length, 1);
});

test('old sessions are exhausted without touching the database', async () => {
  const { limits } = setup({ LIMIT_SESSION_MINUTES: '30' });
  const createdAt = new Date('2026-11-06T10:00:00Z');
  const result = await limits.claimReplySlot({ id: 'missing', createdAt }, new Date(createdAt.getTime() + 31 * 60_000));
  assert.equal(result, 'exhausted');
});

test('invalid limit settings fall back to safe defaults', () => {
  const { limits } = setup({ LIMIT_SESSIONS_PER_LINK: 'abc', LIMIT_REPLIES_PER_SESSION: '-4' });
  assert.deepEqual({ ...limits.usageLimits() }, { sessionsPerLink: 5, repliesPerSession: 60, sessionMinutes: 30, replyIntervalMs: 1000 });
});
