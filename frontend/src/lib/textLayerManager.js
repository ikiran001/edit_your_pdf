/**
 * Group pdf.js text runs into line-level blocks (logical horizontal lines) for iLovePDF-style UX.
 * Each block carries a merged string, union bbox in canvas + normalized + PDF space.
 */

function dominantStyleScore(r) {
  const len = r.str?.length || 0
  const fs = Number(r.pdf?.fontSize) || 0
  const w = r.sourceBold ? 4 : 0
  const i = r.sourceItalic ? 2 : 0
  const u = r.sourceUnderline ? 1 : 0
  return w + i + u + len * 1e-6 + fs * 1e-9
}

function pickDominantRunStyle(runs) {
  if (!runs?.length) {
    return {
      pdfFontFamily: 'sans-serif',
      serverFontFamily: 'Helvetica',
      sourceBold: false,
      sourceItalic: false,
      sourceUnderline: false,
      sourceColorHex: '#000000',
    }
  }
  const d = runs.reduce((best, r) => (dominantStyleScore(r) > dominantStyleScore(best) ? r : best))
  return {
    pdfFontFamily: d.pdfFontFamily || 'sans-serif',
    serverFontFamily: d.serverFontFamily || 'Helvetica',
    sourceBold: !!d.sourceBold,
    sourceItalic: !!d.sourceItalic,
    sourceUnderline: !!d.sourceUnderline,
    sourceColorHex: d.sourceColorHex || '#000000',
  }
}

/** Vertical overlap / min line height — catches same-line duplicates with low box IoU. */
function verticalOverlapRatio(a, b) {
  const ay2 = a.top + a.height
  const by2 = b.top + b.height
  const y1 = Math.max(a.top, b.top)
  const y2 = Math.min(ay2, by2)
  const ih = Math.max(0, y2 - y1)
  const h = Math.min(a.height, b.height)
  return h > 0 ? ih / h : 0
}

/**
 * pdf.js often emits two line blocks for one visible heading (duplicate geometry).
 * Merging keeps one block id and one `blockTextOverrides` entry.
 */
export function dedupeIdenticalOverlappingLineBlocks(blocks) {
  if (!blocks?.length) return []
  let list = [...blocks]
  let changed = true
  while (changed && list.length > 1) {
    changed = false
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const ta = (a.str || '').trim()
        const tb = (b.str || '').trim()
        if (!ta || ta !== tb) continue
        const iou = rectIou(a, b)
        const vy = verticalOverlapRatio(a, b)
        if (iou > 0.06 || vy > 0.45) {
          const m = mergeTwoLineBlocks(a, b)
          list = list.filter((_, k) => k !== i && k !== j)
          list.push(m)
          changed = true
          break outer
        }
      }
    }
  }
  return list
}

function rectIou(a, b) {
  const ax2 = a.left + a.width
  const ay2 = a.top + a.height
  const bx2 = b.left + b.width
  const by2 = b.top + b.height
  const x1 = Math.max(a.left, b.left)
  const y1 = Math.max(a.top, b.top)
  const x2 = Math.min(ax2, bx2)
  const y2 = Math.min(ay2, by2)
  const iw = Math.max(0, x2 - x1)
  const ih = Math.max(0, y2 - y1)
  const inter = iw * ih
  const ua = a.width * a.height + b.width * b.height - inter
  return ua <= 0 ? 0 : inter / ua
}

function mergeTwoLineBlocks(a, b) {
  const vw = a.viewportW
  const vh = a.viewportH
  const left = Math.min(a.left, b.left)
  const top = Math.min(a.top, b.top)
  const right = Math.max(a.left + a.width, b.left + b.width)
  const bottom = Math.max(a.top + a.height, b.top + b.height)
  const width = Math.max(right - left, 2)
  const height = Math.max(bottom - top, 2)
  const first = a.left <= b.left ? a : b
  const second = a.left <= b.left ? b : a
  let str
  if (first.str === second.str) str = first.str
  else {
    str = appendMergedRunText(first.str, first, {
      str: second.str,
      left: second.left,
      width: second.width,
      fontSizePx: second.fontSizePx,
    })
  }

  const lefts = [a.pdf.x, b.pdf.x]
  const rights = [a.pdf.x + a.pdf.w, b.pdf.x + b.pdf.w]
  const bottoms = [a.pdf.y, b.pdf.y]
  const tops = [a.pdf.y + a.pdf.h, b.pdf.y + b.pdf.h]
  const pdf = {
    x: Math.min(...lefts),
    y: Math.min(...bottoms),
    w: Math.max(...rights) - Math.min(...lefts),
    h: Math.max(...tops) - Math.min(...bottoms),
    baseline: b.pdf.baseline,
    fontSize: Math.max(a.pdf.fontSize, b.pdf.fontSize),
  }
  const fontSizePx = Math.min(200, Math.max(9, height * 0.82))
  const norm = {
    nx: left / vw,
    ny: top / vh,
    nw: width / vw,
    nh: height / vh,
    baselineN: b.norm.baselineN,
  }
  const mergedRuns = [...(a.runs || []), ...(b.runs || [])]
  return {
    str,
    left,
    top,
    width,
    height,
    fontSizePx,
    viewportW: vw,
    viewportH: vh,
    norm,
    pdf,
    runs: mergedRuns,
    ...pickDominantRunStyle(mergedRuns),
  }
}

/** Merge overlapping line blocks (duplicate pdf.js items / near-duplicates). */
export function dedupeOverlappingLineBlocks(blocks) {
  if (!blocks?.length) return []
  let list = [...blocks]
  let changed = true
  while (changed && list.length > 1) {
    changed = false
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const iou = rectIou(list[i], list[j])
        if (iou > 0.18) {
          const m = mergeTwoLineBlocks(list[i], list[j])
          list = list.filter((_, k) => k !== i && k !== j)
          list.push(m)
          changed = true
          break outer
        }
      }
    }
  }
  return list
}

/**
 * Join adjacent run strings; remove duplicate suffix/prefix overlaps common in pdf.js output.
 */
function appendMergedRunText(prevStr, prevRun, curRun) {
  const cur = curRun.str
  if (!cur?.length) return prevStr
  if (prevStr === cur) return prevStr
  if (prevStr.endsWith(cur)) return prevStr
  if (cur.startsWith(prevStr)) return cur
  const maxOv = Math.min(prevStr.length, cur.length)
  for (let k = maxOv; k >= 1; k--) {
    if (prevStr.slice(-k) === cur.slice(0, k)) {
      return prevStr + cur.slice(k)
    }
  }
  const gapPx = curRun.left - (prevRun.left + prevRun.width)
  const spaceThreshold = Math.max(2, prevRun.fontSizePx * 0.12)
  const sep = gapPx > spaceThreshold ? ' ' : ''
  return prevStr + sep + cur
}

/**
 * pdf.js puts table cells on one baseline with large horizontal gaps; without splitting, the whole row
 * becomes one block ("Base Pay … 1,600,000 …") and one giant editor. Word gaps stay below this threshold.
 */
function horizontalColumnGapThresholdPx(lineRuns) {
  const fs = Math.max(9, ...lineRuns.map((r) => Number(r.fontSizePx) || 0))
  return Math.max(10, fs * 0.28)
}

/**
 * Split same-baseline runs into blocks. Uses bbox gap; when PDFs overlap runs, also uses left-edge jump.
 * Runs from `tabularRowPartsFromString` carry `atomicLineSegment` and never merge with neighbors.
 */
function segmentRunsByGapAndJump(sorted) {
  if (sorted.length === 1) return [sorted]
  const floorThr = horizontalColumnGapThresholdPx(sorted)
  const segments = []
  let seg = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = seg[seg.length - 1]
    const cur = sorted[i]
    const fs = Math.max(9, Number(prev.fontSizePx) || 9)
    const leadGap = cur.left - (prev.left + prev.width)
    const startJump = cur.left - prev.left
    const gapSplit = leadGap > floorThr
    const jumpSplit =
      startJump > Math.max(11, fs * 1.15) && startJump > (prev.width || 1) * 0.22
    if (gapSplit || jumpSplit) {
      segments.push(seg)
      seg = [cur]
    } else {
      seg.push(cur)
    }
  }
  segments.push(seg)
  return segments
}

/** @param {Array<Record<string, unknown>>} lineRuns */
function segmentLineRunsByTableGaps(lineRuns) {
  if (!lineRuns?.length) return []
  const sorted = [...lineRuns].sort((a, b) => a.left - b.left)
  if (sorted.length === 1) return [sorted]

  const allAtomic = sorted.every((r) => r.atomicLineSegment)
  if (allAtomic) return sorted.map((r) => [r])

  const out = []
  let buf = []
  const flushBuf = () => {
    if (buf.length) {
      out.push(...segmentRunsByGapAndJump(buf))
      buf = []
    }
  }
  for (const r of sorted) {
    if (r.atomicLineSegment) {
      flushBuf()
      out.push([r])
    } else {
      buf.push(r)
    }
  }
  flushBuf()
  return out.length ? out : [sorted]
}

/** @param {Array<Record<string, unknown>>} lineRuns */
function lineRunsToBlock(lineRuns) {
  const vw = lineRuns[0].viewportW
  const vh = lineRuns[0].viewportH
  const left = Math.min(...lineRuns.map((x) => x.left))
  const top = Math.min(...lineRuns.map((x) => x.top))
  const right = Math.max(...lineRuns.map((x) => x.left + x.width))
  const bottom = Math.max(...lineRuns.map((x) => x.top + x.height))
  const width = Math.max(right - left, 2)
  const height = Math.max(bottom - top, 2)

  let str = lineRuns[0].str
  for (let j = 1; j < lineRuns.length; j++) {
    str = appendMergedRunText(str, lineRuns[j - 1], lineRuns[j])
  }

  const lefts = lineRuns.map((r) => r.pdf.x)
  const rights = lineRuns.map((r) => r.pdf.x + r.pdf.w)
  const bottoms = lineRuns.map((r) => r.pdf.y)
  const tops = lineRuns.map((r) => r.pdf.y + r.pdf.h)
  const pdf = {
    x: Math.min(...lefts),
    y: Math.min(...bottoms),
    w: Math.max(...rights) - Math.min(...lefts),
    h: Math.max(...tops) - Math.min(...bottoms),
    baseline: lineRuns[lineRuns.length - 1].pdf.baseline,
    fontSize: Math.max(...lineRuns.map((r) => r.pdf.fontSize)),
  }

  const fontSizePx = Math.min(200, Math.max(9, height * 0.82))
  const last = lineRuns[lineRuns.length - 1]
  const baselineN = last.norm.baselineN

  const norm = {
    nx: left / vw,
    ny: top / vh,
    nw: width / vw,
    nh: height / vh,
    baselineN,
  }

  return {
    id: `L${left.toFixed(0)}T${top.toFixed(0)}`,
    str,
    left,
    top,
    width,
    height,
    fontSizePx,
    viewportW: vw,
    viewportH: vh,
    norm,
    pdf,
    runs: lineRuns,
    ...pickDominantRunStyle(lineRuns),
  }
}

/** @param {Array<Record<string, unknown>>} runs */
export function mergeRunsIntoLineBlocks(runs) {
  if (!runs?.length) return []

  const sorted = [...runs].sort((a, b) => {
    const ba = typeof a.baselineY === 'number' ? a.baselineY : a.top + a.height * 0.85
    const bb = typeof b.baselineY === 'number' ? b.baselineY : b.top + b.height * 0.85
    return ba - bb || a.left - b.left
  })
  const lines = []
  let current = [sorted[0]]
  let lineBaseline = typeof sorted[0].baselineY === 'number' ? sorted[0].baselineY : sorted[0].top + sorted[0].height * 0.85

  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i]
    const by = typeof r.baselineY === 'number' ? r.baselineY : r.top + r.height * 0.85
    const lineH = Math.max(...current.map((x) => x.height), r.height, 8)
    const maxDelta = Math.max(2.5, Math.min(10, lineH * 0.32))
    if (Math.abs(by - lineBaseline) <= maxDelta) {
      current.push(r)
    } else {
      lines.push(current)
      current = [r]
      lineBaseline = by
    }
  }
  lines.push(current)

  const blocks = []
  for (const lineRuns of lines) {
    const segments = segmentLineRunsByTableGaps(lineRuns)
    for (const seg of segments) {
      blocks.push(lineRunsToBlock(seg))
    }
  }
  return blocks
}

/**
 * One pipeline: line-merge → overlap dedupe → stable ids per page.
 * @param {Array<Record<string, unknown>>} runs
 * @param {number} pageIndex
 */
export function buildPageTextBlocks(runs, pageIndex = 0) {
  const merged = mergeRunsIntoLineBlocks(runs || [])
  const deduped = dedupeOverlappingLineBlocks(merged)
  const dedupedText = dedupeIdenticalOverlappingLineBlocks(deduped)
  return dedupedText.map((b) => {
    const { pdf } = b
    const bx = Math.round((pdf?.x ?? 0) * 100) / 100
    const by = Math.round((pdf?.y ?? 0) * 100) / 100
    const bb = Math.round((pdf?.baseline ?? 0) * 100) / 100
    const bw = Math.round((pdf?.w ?? 0) * 100) / 100
    const id = `p${pageIndex}-u${bx}_${by}_${bb}_w${bw}`
    return { ...b, id }
  })
}

export function hitTestTextBlockNearest(blocks, px, py, pad = 6) {
  if (!blocks?.length) return null
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (
      px >= b.left - pad &&
      px <= b.left + b.width + pad &&
      py >= b.top - pad &&
      py <= b.top + b.height + pad
    ) {
      return b
    }
  }
  let best = null
  let bestD = Infinity
  const maxSlop = 56
  for (const b of blocks) {
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    const d = Math.hypot(px - cx, py - cy)
    const reach = Math.hypot(b.width, b.height) / 2 + maxSlop
    if (d < bestD && d <= reach) {
      bestD = d
      best = b
    }
  }
  return best
}
