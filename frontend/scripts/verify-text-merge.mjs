/**
 * Quick sanity check for line merge + duplicate substring handling (no test runner in project).
 * Run: node scripts/verify-text-merge.mjs
 */
import { mergeRunsIntoLineBlocks } from '../src/lib/textLayerManager.js'

const vw = 600
const vh = 800

function mk(str, left, top, w, h, baselineY) {
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
    norm: { nx: 0, ny: 0, nw: 0.1, nh: 0.02, baselineN: 0.5 },
    pdf: { x: 0, y: 0, w: 1, h: 1, baseline: 0, fontSize: 12 },
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

if (!failed) {
  console.log('OK: verify-text-merge — duplicate runs, two baselines, char overlap')
} else {
  process.exit(1)
}
