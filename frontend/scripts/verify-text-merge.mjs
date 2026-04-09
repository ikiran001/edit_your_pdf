/**
 * Quick sanity check for line merge + duplicate substring handling (no test runner in project).
 * Run: node scripts/verify-text-merge.mjs
 */
import { buildPageTextItemBlocks, mergeRunsIntoLineBlocks } from '../src/lib/textLayerManager.js'

const vw = 600
const vh = 800

let _mkIdx = 0
function mk(str, left, top, w, h, baselineY) {
  const idx = _mkIdx++
  return {
    str,
    left,
    top,
    width: w,
    height: h,
    fontSizePx: 14,
    viewportW: vw,
    viewportH: vh,
    baselineY,
    pdfTextItemIndex: idx,
    norm: { nx: 0, ny: 0, nw: 0.1, nh: 0.02, baselineN: 0.5 },
    pdf: { x: left * 0.1, y: top * 0.1, w: w * 0.1, h: h * 0.1, baseline: baselineY * 0.1, fontSize: 12 },
  }
}

let failed = false
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed = true
  }
}

// Overlap merge: "Ganesh " + "Kashid" + duplicate "Kashid" run (common pdf.js pattern)
const dupRuns = [
  mk('Ganesh ', 10, 20, 44, 14, 32),
  mk('Kashid', 54, 20, 36, 14, 32),
  mk('Kashid', 56, 20, 34, 14, 32),
]
const dupBlocks = mergeRunsIntoLineBlocks(dupRuns)
assert(dupBlocks.length === 1, `dup case: expected 1 line, got ${dupBlocks.length}`)
assert(
  !dupBlocks[0].str.includes('KashidKashid'),
  `dup case: string should not contain KashidKashid, got "${dupBlocks[0].str}"`
)
assert(
  dupBlocks[0].str.includes('Ganesh') && dupBlocks[0].str.includes('Kashid'),
  `dup case: expected Ganesh + Kashid once, got "${dupBlocks[0].str}"`
)

// Two visual lines: baselines ~25px apart → must not merge
const twoLines = [
  mk('Ganesh Kashid', 10, 18, 200, 16, 30),
  mk('LeetCode | GitHub', 10, 42, 250, 14, 54),
]
const lineBlocks = mergeRunsIntoLineBlocks(twoLines)
assert(lineBlocks.length === 2, `two lines: expected 2 blocks, got ${lineBlocks.length}`)

// Substring overlap: "Ganesh Kash" + "ashid" → "Ganesh Kashid"
const ov = [mk('Ganesh Kash', 10, 20, 90, 14, 32), mk('ashid', 98, 20, 40, 14, 32)]
const ovBlocks = mergeRunsIntoLineBlocks(ov)
assert(ovBlocks.length === 1, 'overlap: one line')
assert(ovBlocks[0].str === 'Ganesh Kashid', `overlap: got "${ovBlocks[0].str}"`)

// One pdf.js item per cell → buildPageTextItemBlocks does not merge by Y (three hit targets)
_mkIdx = 200
const tableRuns = [
  mk('$5.00', 10, 20, 48, 14, 32),
  mk('1', 100, 20, 10, 14, 32),
  mk('$5.00', 200, 20, 48, 14, 32),
]
const itemBlocks = buildPageTextItemBlocks(tableRuns, 0)
assert(itemBlocks.length === 3, `item blocks: expected 3, got ${itemBlocks.length}`)
const byLeft = [...itemBlocks].sort((a, b) => a.left - b.left)
assert(
  byLeft[0].str === '$5.00' && byLeft[1].str === '1' && byLeft[2].str === '$5.00',
  `item blocks: got ${itemBlocks.map((b) => b.str).join(' | ')}`
)
assert(
  itemBlocks.every((b) => /^p\d+-i\d+-u/.test(b.id)),
  `item blocks: ids should include pdf item index, got ${itemBlocks.map((b) => b.id).join(' ; ')}`
)

const tableMerged = mergeRunsIntoLineBlocks(tableRuns)
assert(tableMerged.length === 3, `line-merge table row: expected 3 segments, got ${tableMerged.length}`)

if (!failed) {
  console.log('OK: verify-text-merge — dup runs, two baselines, overlap, item blocks + line merge table')
} else {
  process.exit(1)
}
