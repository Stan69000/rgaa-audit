'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { _internals } = require('../src/audit');

const {
  createDebugLogger,
  validateAuditUrl,
  resolveDepthLimit,
  resolveOutputPath,
  safeWriteReport,
  normalizeAuditTargetUrl,
  stripTrackingParams,
} = _internals;

test('validateAuditUrl accepte les schémas http/https', () => {
  assert.equal(validateAuditUrl('https://example.com/path#frag'), 'https://example.com/path');
  assert.equal(validateAuditUrl('http://example.com'), 'http://example.com/');
});

test('validateAuditUrl rejette explicitement les schémas interdits', () => {
  assert.throws(() => validateAuditUrl('file:///tmp/test.html'), /Schéma interdit/);
  assert.throws(() => validateAuditUrl('data:text/html;base64,SGVsbG8='), /Schéma interdit/);
  assert.throws(() => validateAuditUrl('javascript:alert(1)'), /Schéma interdit/);
  assert.throws(() => validateAuditUrl('ftp://example.com'), /Schéma non supporté/);
});

test('validateAuditUrl safe-crawl refuse une URL de départ avec query', () => {
  assert.throws(
    () => validateAuditUrl('https://example.com/?page=2', { safeCrawl: true }),
    /safe-crawl/,
  );
});

test('resolveDepthLimit applique une limite défensive', () => {
  assert.equal(resolveDepthLimit(4), 4);
  assert.equal(resolveDepthLimit(500), 100);
  assert.equal(resolveDepthLimit(500, { safeCrawl: true }), 20);
});

test('resolveOutputPath normalise les chemins avec outputDir', () => {
  const out = resolveOutputPath('rapport.json', { outputDir: '/tmp/rgaa' });
  assert.equal(out, path.resolve('/tmp/rgaa/rapport.json'));

  const abs = resolveOutputPath('/var/tmp/rapport.json', { outputDir: '/tmp/rgaa' });
  assert.equal(abs, path.resolve('/var/tmp/rapport.json'));
});

test('safeWriteReport crée le dossier et écrit le rapport', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rgaa-audit-'));
  const reportPath = path.join(tmpDir, 'nested', 'rapport.json');

  safeWriteReport(reportPath, '{"ok":true}');

  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(fs.readFileSync(reportPath, 'utf8'), '{"ok":true}');
});

test('stripTrackingParams retire les paramètres de tracking', () => {
  const url = new URL('https://example.com/page?utm_source=newsletter&gclid=abc&id=42');
  stripTrackingParams(url.searchParams);
  assert.equal(url.searchParams.get('id'), '42');
  assert.equal(url.searchParams.has('utm_source'), false);
  assert.equal(url.searchParams.has('gclid'), false);
});

test('normalizeAuditTargetUrl rejette les schémas non autorisés', () => {
  const base = new URL('https://example.com/section/page');
  const result = normalizeAuditTargetUrl('javascript:alert(1)', {
    base,
    sectionPrefix: '/section',
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /schéma non autorisé/);
});

test('normalizeAuditTargetUrl filtre tracking/query en safe-crawl', () => {
  const base = new URL('https://example.com/section/start');
  const allowed = normalizeAuditTargetUrl('/section/a?utm_source=mail', {
    base,
    sectionPrefix: '/section',
    safeCrawl: false,
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.value, 'https://example.com/section/a');

  const blocked = normalizeAuditTargetUrl('/section/a?page=2', {
    base,
    sectionPrefix: '/section',
    safeCrawl: true,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /safe-crawl/);
});

test('createDebugLogger n’émet des logs que si activé', () => {
  const calls = [];
  const logger = createDebugLogger(true, (msg) => calls.push(msg));
  logger('message utile');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\[debug\]/);

  const silentCalls = [];
  const silent = createDebugLogger(false, (msg) => silentCalls.push(msg));
  silent('ne doit pas sortir');
  assert.equal(silentCalls.length, 0);
});
