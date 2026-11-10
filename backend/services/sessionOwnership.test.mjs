/**
 * Tests for the session ownership guard (IDOR control). Run with:
 *   node --test services/sessionOwnership.test.mjs
 *
 * readSessionOwnerUid + the anonymous branch of authorizeSessionAccess are deterministic.
 * The claimed branch depends on Firebase Admin readiness (env-specific: 401 when ready,
 * 503 when not) — both are `ok:false`, which is what we assert.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readSessionOwnerUid, authorizeSessionAccess } from './sessionOwnership.js'

function tmpSession(owner) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owns-test-'))
  if (owner !== undefined) fs.writeFileSync(path.join(dir, 'owner.json'), owner)
  return dir
}

test('readSessionOwnerUid: null for unclaimed, uid for claimed, null for corrupt', () => {
  const anon = tmpSession() // no owner.json
  const owned = tmpSession(JSON.stringify({ uid: 'user-123' }))
  const corrupt = tmpSession('{not json')
  try {
    assert.equal(readSessionOwnerUid(anon), null)
    assert.equal(readSessionOwnerUid(owned), 'user-123')
    assert.equal(readSessionOwnerUid(corrupt), null)
  } finally {
    for (const d of [anon, owned, corrupt]) fs.rmSync(d, { recursive: true, force: true })
  }
})

test('authorizeSessionAccess: unclaimed session is allowed without a bearer', async () => {
  const anon = tmpSession()
  try {
    const req = { headers: {} }
    const r = await authorizeSessionAccess(req, anon)
    assert.equal(r.ok, true)
    assert.equal(r.uid, null)
  } finally {
    fs.rmSync(anon, { recursive: true, force: true })
  }
})

test('authorizeSessionAccess: claimed session is denied without a valid bearer', async () => {
  const owned = tmpSession(JSON.stringify({ uid: 'owner-xyz' }))
  try {
    const req = { headers: {} } // no Authorization
    const r = await authorizeSessionAccess(req, owned)
    assert.equal(r.ok, false)
    assert.ok(r.status === 401 || r.status === 503, `expected 401/503, got ${r.status}`)
  } finally {
    fs.rmSync(owned, { recursive: true, force: true })
  }
})
