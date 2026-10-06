'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const proxyaddr = require('proxy-addr');

test('proxy address matching preserves IPv4 and mapped IPv4 CIDR boundaries', () => {
  for (const subnets of [
    ['192.0.2.0/24'],
    ['192.0.2.0/24', '2001:db8::/32'],
    ['::ffff:192.0.2.0/120'],
    ['::ffff:192.0.2.0/120', '2001:db8::/32'],
  ]) {
    const trust = proxyaddr.compile(subnets);
    assert.equal(trust('192.0.2.10'), true);
    assert.equal(trust('::ffff:192.0.2.10'), true);
    assert.equal(trust('192.0.3.10'), false);
    assert.equal(trust('::ffff:192.0.3.10'), false);
  }
});

test('native IPv6 ranges do not trust IPv4 or mapped IPv4 candidates', () => {
  for (const subnets of [['::/1'], ['::/1', '2001:db8::/32']]) {
    const trust = proxyaddr.compile(subnets);
    assert.equal(trust('2001:db8::1'), true);
    assert.equal(trust('192.0.2.10'), false);
    assert.equal(trust('::ffff:192.0.2.10'), false);
    assert.equal(trust('not-an-address'), false);
  }
});

test('forwarded address resolution stops at the first untrusted proxy', () => {
  const request = {
    socket: { remoteAddress: '::ffff:127.0.0.1' },
    headers: { 'x-forwarded-for': '198.51.100.20, 192.0.2.10' },
  };

  assert.equal(proxyaddr(request, proxyaddr.compile(['loopback'])), '192.0.2.10');
  assert.equal(
    proxyaddr(request, proxyaddr.compile(['loopback', '192.0.2.0/24'])),
    '198.51.100.20'
  );
});

test('Express defaults ignore forwarded client addresses when trust proxy is disabled', () => {
  const app = express();
  const request = Object.assign(Object.create(app.request), {
    app,
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': '198.51.100.20' },
  });

  assert.equal(app.get('trust proxy'), false);
  assert.equal(request.ip, '127.0.0.1');
  assert.deepEqual(request.ips, []);
});
