/**
 * Verifies qpdf encrypt/decrypt roundtrip (same primitive as POST /unlock-pdf).
 * Does not start the HTTP server.
 *
 *   node backend/scripts/verify-unlock-pdf.mjs
 *
 * Requires: qpdf on PATH (brew install qpdf / apt install qpdf).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const sample = path.join(repoRoot, 'test-artifacts', 'sample-upload.pdf');

function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `exit ${code}`));
    });
    if (input !== undefined) {
      child.stdin.end(input);
    }
  });
}

async function main() {
  try {
    await run('qpdf', ['--version']);
  } catch {
    console.log('SKIP: qpdf not on PATH — install qpdf to run unlock verification.');
    process.exit(0);
  }

  if (!fs.existsSync(sample)) {
    throw new Error(`Missing sample PDF: ${sample}`);
  }

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'verify-unlock-'));
  const enc = path.join(dir, 'enc.pdf');
  const dec = path.join(dir, 'dec.pdf');
  const bad = path.join(dir, 'bad.pdf');
  const pwFile = path.join(dir, 'pw.txt');
  const wrongPw = path.join(dir, 'wrong.txt');

  const goodPass = 'test-unlock-9xK';
  await fs.promises.writeFile(pwFile, goodPass, { mode: 0o600 });
  await fs.promises.writeFile(wrongPw, 'wrong-password', { mode: 0o600 });

  await run('qpdf', ['--encrypt', goodPass, goodPass, '256', '--', sample, enc]);

  let wrongFailed = false;
  try {
    await run('qpdf', [`--password-file=${wrongPw}`, '--decrypt', enc, bad]);
  } catch {
    wrongFailed = true;
  }
  if (!wrongFailed) {
    throw new Error('Expected wrong password to fail qpdf --decrypt');
  }
  console.log('case: wrong password → error (OK)');

  await run('qpdf', [`--password-file=${pwFile}`, '--decrypt', enc, dec]);

  const { stdout } = await run('qpdf', ['--show-encryption', dec]);
  if (/not encrypted/i.test(stdout)) {
    console.log('case: correct password → not encrypted (OK)');
  } else if (!/encrypt/i.test(stdout) || /R=0/i.test(stdout)) {
    console.log('case: correct password → encryption removed (OK)\n', stdout.trim());
  } else {
    throw new Error(`Unexpected --show-encryption output:\n${stdout}`);
  }

  const st = await fs.promises.stat(dec);
  if (st.size < 100) throw new Error('Decrypted file unexpectedly small');
  console.log('case: output size reasonable (OK) bytes=', st.size);

  await fs.promises.rm(dir, { recursive: true, force: true });
  console.log('All unlock/qpdf checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
