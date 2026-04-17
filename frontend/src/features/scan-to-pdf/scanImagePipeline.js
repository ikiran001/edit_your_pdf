/**
 * Client-side scan cleanup: margin crop (bright paper), optional contrast stretch, size cap.
 * Full perspective warp would need OpenCV/wasm — not bundled here to keep the toolkit fast.
 */

/** @param {Uint8ClampedArray} data @param {number} w @param {number} h */
function luminanceAt(data, w, x, y) {
  const i = (y * w + x) * 4
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Row is “empty margin” when almost all pixels are very bright (paper / desk). */
function rowMostlyWhite(data, w, y, threshold = 245) {
  let minL = 255
  const step = Math.max(1, Math.floor(w / 200))
  for (let x = 0; x < w; x += step) {
    const L = luminanceAt(data, w, x, y)
    if (L < minL) minL = L
  }
  return minL >= threshold
}

function colMostlyWhite(data, w, h, x, threshold = 245) {
  let minL = 255
  const step = Math.max(1, Math.floor(h / 200))
  for (let y = 0; y < h; y += step) {
    const L = luminanceAt(data, w, x, y)
    if (L < minL) minL = L
  }
  return minL >= threshold
}

/**
 * @param {ImageData} imageData
 * @returns {{ left: number, top: number, right: number, bottom: number }} inclusive pixel bounds
 */
function detectContentBounds(imageData) {
  const { width: w, height: h, data } = imageData
  let top = 0
  while (top < h && rowMostlyWhite(data, w, top)) top++
  let bottom = h - 1
  while (bottom > top && rowMostlyWhite(data, w, bottom)) bottom--
  let left = 0
  while (left < w && colMostlyWhite(data, w, h, left)) left++
  let right = w - 1
  while (right > left && colMostlyWhite(data, w, h, right)) right--

  if (top >= bottom || left >= right) {
    return { left: 0, top: 0, right: w - 1, bottom: h - 1 }
  }
  const padX = Math.max(4, Math.round(w * 0.01))
  const padY = Math.max(4, Math.round(h * 0.01))
  return {
    left: Math.max(0, left - padX),
    top: Math.max(0, top - padY),
    right: Math.min(w - 1, right + padX),
    bottom: Math.min(h - 1, bottom + padY),
  }
}

/**
 * Per-channel intensity bounds by trimming `tailPct`% from darkest and brightest bins.
 * @param {Uint8ClampedArray} data RGBA
 * @param {0|1|2} channel
 */
function channelPercentileBounds(data, channel, tailPct) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i + channel]]++
  }
  const total = data.length / 4
  const need = Math.max(1, Math.floor((total * tailPct) / 100))
  let acc = 0
  let lo = 0
  while (lo < 255) {
    acc += hist[lo]
    if (acc >= need) break
    lo++
  }
  acc = 0
  let hi = 255
  while (hi > 0) {
    acc += hist[hi]
    if (acc >= need) break
    hi--
  }
  if (hi <= lo + 8) return { lo: 0, hi: 255 }
  return { lo, hi }
}

/**
 * Stretch each RGB channel after trimming 5% tails — lifts shadows, tames glare.
 * @param {ImageData} imageData mutated in place
 */
function enhanceContrast(imageData) {
  const { data } = imageData
  const rB = channelPercentileBounds(data, 0, 5)
  const gB = channelPercentileBounds(data, 1, 5)
  const bB = channelPercentileBounds(data, 2, 5)
  const stretch = (v, lo, hi) => {
    const d = hi - lo || 1
    return Math.min(255, Math.max(0, Math.round(((v - lo) * 255) / d)))
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = stretch(data[i], rB.lo, rB.hi)
    data[i + 1] = stretch(data[i + 1], gB.lo, gB.hi)
    data[i + 2] = stretch(data[i + 2], bB.lo, bB.hi)
  }
}

function scaleBoundsToFull(bounds, srcW, srcH, fullW, fullH) {
  const sx = fullW / srcW
  const sy = fullH / srcH
  const left = Math.max(0, Math.floor(bounds.left * sx))
  const top = Math.max(0, Math.floor(bounds.top * sy))
  const right = Math.min(fullW - 1, Math.ceil(bounds.right * sx))
  const bottom = Math.min(fullH - 1, Math.ceil(bounds.bottom * sy))
  return { left, top, right, bottom }
}

/**
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {{ autoCrop?: boolean, enhance?: boolean, maxLongEdge?: number }} [options]
 * @returns {Promise<Blob>}
 */
export function processCanvasToJpegBlob(sourceCanvas, options = {}) {
  const { autoCrop = true, enhance = true, maxLongEdge = 2200 } = options
  const W = sourceCanvas.width
  const H = sourceCanvas.height
  if (W < 2 || H < 2) {
    return new Promise((resolve, reject) => {
      sourceCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Empty canvas'))), 'image/jpeg', 0.88)
    })
  }

  const analysisLong = Math.max(W, H)
  const analysisScale = analysisLong > 720 ? 720 / analysisLong : 1
  const aw = Math.max(2, Math.round(W * analysisScale))
  const ah = Math.max(2, Math.round(H * analysisScale))

  const analysis = document.createElement('canvas')
  analysis.width = aw
  analysis.height = ah
  const actx = analysis.getContext('2d', { willReadFrequently: true })
  if (!actx) {
    return new Promise((resolve, reject) => {
      sourceCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No canvas context'))), 'image/jpeg', 0.88)
    })
  }
  actx.drawImage(sourceCanvas, 0, 0, aw, ah)
  const aData = actx.getImageData(0, 0, aw, ah)

  let crop = { left: 0, top: 0, right: W - 1, bottom: H - 1 }
  if (autoCrop) {
    const b = detectContentBounds(aData)
    crop = scaleBoundsToFull(b, aw, ah, W, H)
  }

  const cw = Math.max(2, crop.right - crop.left + 1)
  const ch = Math.max(2, crop.bottom - crop.top + 1)
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cw
  cropCanvas.height = ch
  const cctx = cropCanvas.getContext('2d', { willReadFrequently: true })
  if (!cctx) {
    return new Promise((resolve, reject) => {
      sourceCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No crop context'))), 'image/jpeg', 0.88)
    })
  }
  cctx.drawImage(sourceCanvas, crop.left, crop.top, cw, ch, 0, 0, cw, ch)

  let outW = cw
  let outH = ch
  const long = Math.max(outW, outH)
  if (long > maxLongEdge) {
    const s = maxLongEdge / long
    outW = Math.max(2, Math.round(cw * s))
    outH = Math.max(2, Math.round(ch * s))
  }

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d', { willReadFrequently: true })
  if (!octx) {
    return new Promise((resolve, reject) => {
      cropCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No out context'))), 'image/jpeg', 0.88)
    })
  }
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(cropCanvas, 0, 0, outW, outH)

  if (enhance) {
    const id = octx.getImageData(0, 0, outW, outH)
    enhanceContrast(id)
    octx.putImageData(id, 0, 0)
  }

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('JPEG encode failed'))
    }, 'image/jpeg', 0.88)
  })
}

/**
 * @param {Blob} imageBlob e.g. from camera canvas
 */
export async function processScannedImageBlob(imageBlob, options = {}) {
  const bmp = await createImageBitmap(imageBlob)
  try {
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not read image')
    ctx.drawImage(bmp, 0, 0)
    return await processCanvasToJpegBlob(c, options)
  } finally {
    bmp.close?.()
  }
}
