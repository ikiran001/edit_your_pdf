/**
 * Global cap on concurrent heavy native-process jobs (qpdf / Ghostscript / LibreOffice /
 * ocrmypdf). `express-rate-limit` is per-IP; this bounds the TOTAL simultaneous CPU/RAM
 * use across all clients so a burst (or many IPs) can't exhaust a small instance.
 *
 * Over the cap we fail fast with 503 + Retry-After rather than queueing, to avoid an
 * unbounded backlog of memory-heavy requests. Tune with MAX_CONCURRENT_HEAVY_JOBS.
 */
const MAX = Number.parseInt(process.env.MAX_CONCURRENT_HEAVY_JOBS || '', 10) || 4;

let active = 0;

export function heavyJobLimiter(req, res, next) {
  if (active >= MAX) {
    res.setHeader('Retry-After', '10');
    return res.status(503).json({
      ok: false,
      error: 'server_busy',
      message: 'The server is busy processing other files. Please try again in a few seconds.',
    });
  }
  active += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    active -= 1;
  };
  res.on('finish', release);
  res.on('close', release);
  next();
}

/** Current in-flight heavy-job count (for /health diagnostics or tests). */
export function activeHeavyJobs() {
  return active;
}
