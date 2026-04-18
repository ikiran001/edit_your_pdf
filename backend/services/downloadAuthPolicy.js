/**
 * @returns {boolean}
 */
export function isDownloadAuthEnabled() {
  const v = (process.env.DOWNLOAD_AUTH_ENABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * When download auth is on, allow exactly one anonymous download per session using upload-issued token.
 * @returns {boolean}
 */
export function isFirstAnonymousDownloadEnabled() {
  const v = (process.env.DOWNLOAD_FIRST_ANONYMOUS || 'true').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}
