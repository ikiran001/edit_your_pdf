import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTextDraftNormSize } from './textDraftLayout.js'

test('no floor: clamps to min nw and caps', () => {
  const r = resolveTextDraftNormSize({
    wantWpx: 10,
    wantHpx: 40,
    W: 800,
    H: 1000,
    nx: 0,
    ny: 0,
    nwFloor: undefined,
    minNw: 0.018,
    minNh: 0.016,
  })
  assert.equal(r.nw, 0.018)
  assert.ok(r.nh >= 0.016 && r.nh <= 1 - 0.02)
})

test('nw floor keeps width when measured is smaller', () => {
  const r = resolveTextDraftNormSize({
    wantWpx: 80,
    wantHpx: 24,
    W: 800,
    H: 1000,
    nx: 0.1,
    ny: 0.1,
    nwFloor: 0.25,
    minNw: 0.018,
    minNh: 0.016,
  })
  assert.equal(r.nw, 0.25)
})

test('nw floor allows growth when measured is larger', () => {
  const r = resolveTextDraftNormSize({
    wantWpx: 400,
    wantHpx: 24,
    W: 800,
    H: 1000,
    nx: 0,
    ny: 0,
    nwFloor: 0.1,
    minNw: 0.018,
    minNh: 0.016,
  })
  assert.equal(r.nw, 0.5)
})
