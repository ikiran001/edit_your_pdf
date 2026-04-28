/**
 * Verifies qpdf compression flags used by POST /compress-pdf (does not start HTTP).
 *
 *   node backend/scripts/verify-compress-pdf.mjs
 *
 * Requires: qpdf on PATH.
 *
 * Optional: SAMPLE_PDF=/absolute/path/to/file.pdf
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const sample =
  process.env.SAMPLE_PDF ||
  path.join(repoRoot, 'docs', 'pdfpilot-marketing-brochure.pdf');

function qpdfArgsMedium() {
  return [
    '--compress-streams=y',
    '--object-streams=generate',
    '--recompress-flate',
    '--compression-level=6',
  ];
}

function main() {
  if (!fs.existsSync(sample)) {
    console.error(`SKIP: sample PDF not found: ${sample}`);
    process.exit(0);
  }

  const bin =
    spawnSync('which', ['qpdf'], { encoding: 'utf8' }).stdout?.trim().split('\n')[0] || 'qpdf';
  const r0 = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  if (r0.status !== 0) {
    console.error('SKIP: qpdf not on PATH');
    process.exit(0);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-compress-'));
  const outPath = path.join(dir, 'out.pdf');
  try {
    const args = [...qpdfArgsMedium(), sample, outPath];
    const r = spawnSync(bin, args, { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout || 'qpdf failed');
      process.exit(1);
    }
    const inStat = fs.statSync(sample);
    const outStat = fs.statSync(outPath);
    const head = fs.readFileSync(outPath, { encoding: null }).subarray(0, 5).toString('utf8');
    if (!head.startsWith('%PDF')) {
      console.error('Output is not a PDF');
      process.exit(1);
    }
    const pct = Math.round((1 - outStat.size / inStat.size) * 100);
    console.log(
      `[compress] ok · ${path.basename(sample)} · ${inStat.size} → ${outStat.size} bytes (${pct}% smaller)`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
