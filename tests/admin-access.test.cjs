/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads the transpiled TypeScript module. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

const access = load('src/lib/admin-access.ts');

test('only listed emails are admins, case- and whitespace-insensitive', () => {
  const list = ' Owner@Example.com , teammate@example.com ';
  assert.equal(access.isAdminEmail('owner@example.com', list), true);
  assert.equal(access.isAdminEmail('TEAMMATE@example.com', list), true);
  assert.equal(access.isAdminEmail('stranger@example.com', list), false);
  assert.equal(access.isAdminEmail(undefined, list), false);
});

test('an empty allow-list lets nobody in', () => {
  assert.equal(access.isAdminEmail('owner@example.com', ''), false);
  assert.equal(access.isAdminEmail('owner@example.com', ' , '), false);
});

test('post-login redirects stay on this site', () => {
  assert.equal(access.safeCallbackPath('/campaigns/abc?saved=1'), '/campaigns/abc?saved=1');
  assert.equal(access.safeCallbackPath('http://localhost:3000/campaigns?x=1', 'localhost:3000'), '/campaigns?x=1');
  for (const unsafe of ['https://evil.example/campaigns', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined, '/login?x=1', 'http://localhost:3000.evil.example/']) {
    assert.equal(access.safeCallbackPath(unsafe, 'localhost:3000'), '/');
  }
  assert.equal(access.safeCallbackPath('http://localhost:3000/campaigns'), '/', 'absolute URLs need a known host');
});

test('every exported server action checks the admin session first', () => {
  const actionFiles = fs.readdirSync('src/app', { recursive: true })
    .map((file) => path.join('src/app', String(file)))
    .filter((file) => /actions\.ts$/.test(file));
  assert.ok(actionFiles.length >= 5);
  for (const file of actionFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const actions = [...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n(.*)/g)];
    assert.ok(actions.length > 0, `${file} has actions`);
    for (const [, name, firstLine] of actions) {
      assert.match(firstLine, /await requireAdmin\(\);/, `${file}: ${name} must call requireAdmin() first`);
    }
  }
});

test('recipient invitation routes stay public in the proxy matcher', () => {
  const proxy = fs.readFileSync('src/proxy.ts', 'utf8');
  const pattern = proxy.match(/matcher: \["(.+)"\]/)[1].replace(/\\\\/g, '\\');
  const regex = new RegExp(`^${pattern}$`);
  for (const publicPath of ['/r/token123', '/api/recipient-links/t/avatar-session', '/api/auth/callback/google', '/login']) {
    assert.equal(regex.test(publicPath), false, `${publicPath} must be public`);
  }
  for (const adminPath of ['/', '/campaigns', '/campaigns/abc', '/recipients', '/recipients/new']) {
    assert.equal(regex.test(adminPath), true, `${adminPath} must be protected`);
  }
});
