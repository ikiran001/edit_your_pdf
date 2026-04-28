import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nativeTextRecordsAreSameSlot,
  dedupeNativeTextEditRecords,
} from './nativeTextOverlap.js'

const norm = { nx: 0.1, ny: 0.2, nw: 0.8, nh: 0.05, baselineN: 0.24 }

test('different slotIds are never the same slot even with identical norm', () => {
  const a = {
    pageIndex: 0,
    slotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    blockId: 'L1',
    norm,
    x: 10,
    y: 20,
    baseline: 30,
    text: 'hello',
  }
  const b = {
    pageIndex: 0,
    slotId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    blockId: 'L2',
    norm,
    x: 11,
    y: 21,
    baseline: 31,
    text: 'world',
  }
  assert.equal(nativeTextRecordsAreSameSlot(a, b), false)
  const out = dedupeNativeTextEditRecords([a, b])
  assert.equal(out.length, 2)
})

test('same slotId: later list order wins in slot dedupe', () => {
  const sid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const first = {
    pageIndex: 0,
    slotId: sid,
    blockId: 'L9',
    norm,
    x: 5,
    y: 5,
    baseline: 12,
    text: 'old',
  }
  const second = {
    pageIndex: 0,
    slotId: sid,
    blockId: 'L9',
    norm,
    x: 5,
    y: 5,
    baseline: 12,
    text: 'new',
  }
  const out = dedupeNativeTextEditRecords([first, second])
  assert.equal(out.length, 1)
  assert.equal(out[0].text, 'new')
})

test('legacy rows without slotId still dedupe by overlapping norm', () => {
  const a = { pageIndex: 0, norm, x: 10, y: 20, baseline: 30, text: 'v1' }
  const b = { pageIndex: 0, norm, x: 10.5, y: 20.5, baseline: 30.5, text: 'v2' }
  assert.equal(nativeTextRecordsAreSameSlot(a, b), true)
  const out = dedupeNativeTextEditRecords([a, b])
  assert.equal(out.length, 1)
})
