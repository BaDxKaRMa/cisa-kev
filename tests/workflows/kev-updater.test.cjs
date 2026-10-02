const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');

// Test the actual inline privileged script without running an action, using
// credentials, accessing the network, or installing any project dependencies.
const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8');
const writer = workflow.split('\n  update_data:\n')[1].split('\n  deploy:\n')[0];
const script = writer.split('          script: |\n')[1]
  .split('\n').map(line => line.startsWith('            ') ? line.slice(12) : line).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction('github', 'core', 'context', 'require', 'fetch', script);
const catalog = () => ({
  catalogVersion: '2026.10.01',
  dateReleased: '2026-10-01T00:00:00Z',
  count: 1,
  vulnerabilities: [{ cveID: 'CVE-2026-1234', shortDescription: 'Example' }],
});

async function run(options = {}) {
  const remote = options.remote === undefined ? catalog() : options.remote;
  const previous = options.previous === undefined ? {
    ...catalog(), catalogVersion: '2026.09.30', dateReleased: '2026-09-30T00:00:00Z',
  } : options.previous;
  const calls = { fetch: [], get: [], blob: [], write: [], warnings: [], info: [], delays: [] };
  const github = { rest: {
    repos: {
      async getContent(args) {
        calls.get.push(args);
        return { data: options.current || { type: 'file', sha: 'current-blob-sha', encoding: 'none', content: '' } };
      },
      async createOrUpdateFileContents(args) {
        calls.write.push(args);
        if (options.writeError) throw options.writeError;
      },
    },
    git: {
      async getBlob(args) {
        calls.blob.push(args);
        return { data: {
          encoding: options.encoding || 'base64',
          content: Buffer.from(JSON.stringify(previous)).toString('base64'),
        } };
      },
    },
  } };
  const core = {
    warning: message => calls.warnings.push(message),
    info: message => calls.info.push(message),
  };
  const mockedRequire = name => {
    if (name === 'node:timers/promises') return { setTimeout: async ms => calls.delays.push(ms) };
    assert.equal(name, 'node:util', 'The privileged writer may only load Node built-ins');
    return require(name);
  };
  const fetch = async (url, init) => {
    calls.fetch.push({ url, init });
    if (options.fetchError) throw options.fetchError;
    if (options.failFirst && calls.fetch.length === 1) throw new Error('Transient outage');
    return {
      ok: options.status === undefined || options.status === 200,
      status: options.status || 200,
      text: async () => options.body === undefined ? JSON.stringify(remote) : options.body,
    };
  };
  try {
    await execute(github, core, { repo: { owner: 'example', repo: 'cisa-kev' } }, mockedRequire, fetch);
  } catch (error) {
    if (!options.expectedError) throw error;
    assert.match(error.message, options.expectedError);
    return calls;
  }
  assert.equal(options.expectedError, undefined, 'Expected the updater to reject unsafe input');
  return calls;
}

test('writes only the KEV path on main using the current SHA and public unauthenticated fetch', async () => {
  const calls = await run();
  assert.equal(calls.write.length, 1);
  assert.deepEqual(calls.get, [{ owner: 'example', repo: 'cisa-kev', path: 'data/known_exploited_vulnerabilities.json', ref: 'main', headers: { accept: 'application/vnd.github.object+json' } }]);
  assert.deepEqual(calls.blob, [{ owner: 'example', repo: 'cisa-kev', file_sha: 'current-blob-sha' }]);
  assert.deepEqual(calls.write[0], {
    owner: 'example', repo: 'cisa-kev', path: 'data/known_exploited_vulnerabilities.json',
    branch: 'main', sha: 'current-blob-sha', message: 'chore: update KEV data [skip ci]',
    content: Buffer.from(JSON.stringify(catalog(), null, 2)).toString('base64'),
    committer: { name: 'github-actions[bot]', email: '41898282+github-actions[bot]@users.noreply.github.com' },
  });
  assert.equal(calls.fetch[0].url, 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  assert.deepEqual(calls.fetch[0].init.headers, { 'User-Agent': 'cisa-kev-dashboard/0.1' });
  assert.ok(calls.fetch[0].init.signal instanceof AbortSignal);
});

test('unchanged catalog, including reordered keys, produces no commit', async () => {
  const previous = catalog();
  const { count, ...other } = previous;
  const calls = await run({ previous, remote: { count, ...other } });
  assert.equal(calls.write.length, 0);
});

test('large existing catalogs use Git blobs rather than empty Contents content', async () => {
  const previous = catalog();
  previous.vulnerabilities[0].shortDescription = 'x'.repeat(1024 * 1024 + 1);
  const calls = await run({ previous });
  assert.equal(calls.blob.length, 1);
  assert.equal(calls.write.length, 1);
});

test('preserves Python-style ASCII JSON encoding', async () => {
  const remote = catalog();
  remote.vulnerabilities[0].shortDescription = 'Caf\u00e9 \ud83d\udd12 \u007f';
  const calls = await run({ remote });
  const written = Buffer.from(calls.write[0].content, 'base64').toString('utf8');
  assert.ok(written.includes('Caf\\u00e9 \\ud83d\\udd12 \\u007f'));
  assert.deepEqual(JSON.parse(written), remote);
});

for (const [label, transform] of [
  ['null catalog', () => null],
  ['array catalog', () => []],
  ['missing catalog version', value => { delete value.catalogVersion; return value; }],
  ['invalid date', value => ({ ...value, dateReleased: 'invalid' })],
  ['non-integer count', value => ({ ...value, count: '1' })],
  ['empty catalog', value => ({ ...value, count: 0, vulnerabilities: [] })],
  ['count mismatch', value => ({ ...value, count: 2 })],
  ['missing vulnerabilities', value => { delete value.vulnerabilities; return value; }],
  ['invalid CVE', value => ({ ...value, vulnerabilities: [{ cveID: '../../script.js' }] })],
  ['duplicate CVEs', value => ({ ...value, count: 2, vulnerabilities: [value.vulnerabilities[0], value.vulnerabilities[0]] })],
]) {
  test(`rejects ${label} before using repository APIs`, async () => {
    const calls = await run({ remote: transform(catalog()), expectedError: /invalid CISA KEV catalog/ });
    assert.equal(calls.get.length, 0);
    assert.equal(calls.write.length, 0);
  });
}

test('refuses an older catalog even if its contents differ', async () => {
  const calls = await run({ previous: { ...catalog(), dateReleased: '2026-10-02T00:00:00Z' }, expectedError: /older CISA data/ });
  assert.equal(calls.write.length, 0);
});

test('allows legitimate removals in a newer catalog', async () => {
  const previous = { ...catalog(), count: 2, dateReleased: '2026-09-30T00:00:00Z' };
  previous.vulnerabilities.push({ cveID: 'CVE-2026-5678' });
  const calls = await run({ previous });
  assert.equal(calls.write.length, 1);
});

for (const [label, options] of [
  ['network outage', { fetchError: new Error('Network unavailable') }],
  ['HTTP error', { status: 503 }],
  ['invalid JSON', { body: '<html>Unavailable</html>' }],
  ['oversized response', { body: ' '.repeat(10 * 1024 * 1024 + 1) }],
]) {
  test(`${label} retries three times and preserves committed data`, async () => {
    const calls = await run(options);
    assert.equal(calls.fetch.length, 3);
    assert.deepEqual(calls.delays, [1000, 2000]);
    assert.equal(calls.warnings.length, 1);
    assert.equal(calls.get.length, 0);
    assert.equal(calls.write.length, 0);
  });
}

test('recovers from a transient fetch failure', async () => {
  const calls = await run({ failFirst: true });
  assert.equal(calls.fetch.length, 2);
  assert.equal(calls.write.length, 1);
});

test('fails safely on a concurrent-update conflict without retrying or forcing', async () => {
  const calls = await run({ writeError: new Error('409 Conflict'), expectedError: /409 Conflict/ });
  assert.equal(calls.write.length, 1);
  assert.equal(calls.write[0].sha, 'current-blob-sha');
  assert.equal(calls.write[0].force, undefined);
});

test('rejects an unexpected non-file target', async () => {
  const calls = await run({ current: { type: 'symlink', sha: 'unexpected' }, expectedError: /regular file/ });
  assert.equal(calls.blob.length, 0);
  assert.equal(calls.write.length, 0);
});

test('rejects an unexpected Git blob encoding', async () => {
  const calls = await run({ encoding: 'utf-8', expectedError: /Unexpected catalog encoding/ });
  assert.equal(calls.write.length, 0);
});
