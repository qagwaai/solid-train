'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');
const contentType = require('content-type');
const contentDisposition = require('content-disposition');

async function serve(t, app) {
  const server = http.createServer(app);
  t.after(
    () =>
      new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return (route, options = {}) =>
    fetch(`http://127.0.0.1:${address.port}${route}`, {
      ...options,
      signal: AbortSignal.timeout(5000),
    });
}

test('Express preserves Content-Type parameters when adding the response charset', async (t) => {
  const app = express();
  app.get('/', (req, res) => res.set('Content-Type', 'text/plain; foo=bar').send('hello'));
  const request = await serve(t, app);
  const response = await request('/');

  assert.equal(response.status, 200);
  const header = contentType.parse(response.headers.get('content-type'));
  assert.equal(header.type, 'text/plain');
  assert.equal(header.parameters.foo, 'bar');
  assert.equal(header.parameters.charset, 'utf-8');
  assert.equal(await response.text(), 'hello');
});

test('Express chunked responses omit Content-Length and retain ETag generation', async (t) => {
  const app = express();
  app.get('/', (req, res) => res.set('Transfer-Encoding', 'chunked').send('hello'));
  const request = await serve(t, app);
  const response = await request('/');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('transfer-encoding'), 'chunked');
  assert.equal(response.headers.get('content-length'), null);
  assert.ok(response.headers.get('etag'));
  assert.equal(await response.text(), 'hello');
});

test('Express attachment headers preserve ASCII and Unicode filename semantics', async (t) => {
  const app = express();
  const filenames = ['report.csv', '\u0394-report.csv'];
  app.get('/:index', (req, res) =>
    res.attachment(filenames[Number(req.params.index)]).send('data')
  );
  const request = await serve(t, app);

  for (const [index, filename] of filenames.entries()) {
    const response = await request(`/${index}`);
    assert.equal(response.status, 200);
    const header = contentDisposition.parse(response.headers.get('content-disposition'));
    assert.equal(header.type, 'attachment');
    assert.equal(header.parameters.filename, filename);
    assert.equal(await response.text(), 'data');
  }
});

test('Express JSON parsing accepts valid bodies and explicitly rejects malformed or oversized bodies', async (t) => {
  const app = express();
  app.use(express.json({ limit: '32b' }));
  app.post('/', (req, res) => res.json(req.body));
  app.use((error, req, res, next) => res.status(error.status).json({ type: error.type }));
  const request = await serve(t, app);

  for (const [body, status, expected] of [
    ['{"value":42}', 200, { value: 42 }],
    ['{"value":', 400, { type: 'entity.parse.failed' }],
    [JSON.stringify({ value: 'x'.repeat(64) }), 413, { type: 'entity.too.large' }],
  ]) {
    const response = await request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
    });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), expected);
  }
});
