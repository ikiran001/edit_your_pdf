/**
 * Tests for the session-id validator — a security control. Routes build
 * `path.join(uploadsRoot, sessionId, ...)`, so anything that is not a strict
 * UUID v4 must be rejected or it becomes a path-traversal vector.
 *
 * Run: node --test utils/sessionId.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidSessionId } from './sessionId.js'

test('accepts a well-formed UUID v4', () => {
  assert.equal(isValidSessionId('3f1d9125-9624-4671-95e0-f6f55a63ff41'), true)
  assert.equal(isValidSessionId('3F1D9125-9624-4671-95E0-F6F55A63FF41'), true) // case-insensitive
})

test('rejects path-traversal payloads', () => {
  const uuid = '3f1d9125-9624-4671-95e0-f6f55a63ff41'
  for (const bad of [
    `../${uuid}`,
    `../../${uuid}`,
    '..',
    '../',
    `${uuid}/../${uuid}`,
    `${uuid}/edited.pdf`,
    '..%2f..%2fetc', // encoded form, should also never pass
    `/etc/passwd`,
    `${uuid}\0`, // null byte
  ]) {
    assert.equal(isValidSessionId(bad), false, `should reject: ${JSON.stringify(bad)}`)
  }
})

test('rejects malformed / non-string input', () => {
  for (const bad of ['', 'not-a-uuid', '12345', null, undefined, 42, {}, [], `${'a'.repeat(36)}`]) {
    assert.equal(isValidSessionId(bad), false, `should reject: ${JSON.stringify(bad)}`)
  }
})

test('rejects a UUID with the wrong version/variant nibble', () => {
  // version nibble must be 4, variant must be 8/9/a/b
  assert.equal(isValidSessionId('3f1d9125-9624-1671-95e0-f6f55a63ff41'), false) // v1
  assert.equal(isValidSessionId('3f1d9125-9624-4671-05e0-f6f55a63ff41'), false) // variant 0
})
