import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import router from './verifySignature.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALTERED_FIXTURE = path.join(__dirname, '../test-fixtures/signed-altered-byterange.pdf');
const VALID_FIXTURE = path.join(__dirname, '../../test-artifacts/signed-valid.pdf');

async function postPdf(buffer) {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  try {
    const port = server.address().port;
    const fd = new FormData();
    fd.append('file', new Blob([buffer], { type: 'application/pdf' }), 'f.pdf');
    const res = await fetch(`http://localhost:${port}/verify-signature`, { method: 'POST', body: fd });
    return res.json();
  } finally {
    server.close();
  }
}

test('valid signed PDF passes the integrity (green) check', async () => {
  const body = await postPdf(fs.readFileSync(VALID_FIXTURE));
  assert.equal(body.signed, true);
  assert.equal(body.integrity, true);
  assert.ok(!body.unreadable);
  assert.equal(body.signatures[0].signer, 'EYP Valid Signer');
});

test('reports a plain PDF as not signed', async () => {
  const unsigned = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const body = await postPdf(unsigned);
  assert.deepEqual(body, { signed: false });
});

// Uses a real signed PDF whose ByteRange points past the end of the file
// (re-saved after signing) — kept out of git, so skip when it is absent.
test('signed PDF with out-of-range ByteRange is reported, not crashed', { skip: !fs.existsSync(ALTERED_FIXTURE) }, async () => {
  const body = await postPdf(fs.readFileSync(ALTERED_FIXTURE));
  assert.equal(body.signed, true);
  assert.equal(body.unreadable, true);
  assert.equal(body.integrity, false);
  assert.match(body.note, /modified|incomplete/i);
  assert.ok(body.signatures.length >= 1, 'extracts at least one signer');
  assert.equal(body.signatures[0].signer, 'SUNIL PRAKASH KAPADNIS');
});
