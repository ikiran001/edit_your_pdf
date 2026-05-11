import { spawn } from 'child_process';

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Spawn `bin` with `args`, buffer stdout+stderr into a single string, and resolve on exit code 0.
 * If the child runs longer than `timeoutMs`, it is SIGKILLed and the promise rejects with `code: 'TIMEOUT'`.
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {{ timeoutMs?: number, env?: NodeJS.ProcessEnv, timeoutMessage?: string }} [opts]
 * @returns {Promise<{ stderr: string }>}
 */
export function runProcess(bin, args, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const env = opts.env ?? process.env;
  const timeoutMessage = opts.timeoutMessage ?? `${bin} timed out after ${Math.round(timeoutMs / 1000)}s`;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...env },
    });

    let stderr = '';
    let settled = false;

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      finish(() =>
        reject(Object.assign(new Error(timeoutMessage), { code: 'TIMEOUT', stderr }))
      );
    }, timeoutMs);

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => finish(() => reject(err)));
    child.on('close', (code) => {
      if (code === 0) finish(() => resolve({ stderr }));
      else
        finish(() =>
          reject(
            Object.assign(new Error(stderr.trim() || `${bin} exited with code ${code}`), {
              exitCode: code,
              stderr,
            })
          )
        );
    });
  });
}
