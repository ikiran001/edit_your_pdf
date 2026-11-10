/** UUID v4 (as minted by the `uuid` package): version nibble = 4, variant = 8/9/a/b. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Session IDs are server-generated UUID v4s. Validate a request-supplied id before
 * using it in any filesystem path: an unvalidated value such as "../<other-session>"
 * would otherwise escape the uploads root (path traversal — cross-session read and
 * write). Routes that build `path.join(uploadsRoot, sessionId, ...)` MUST gate on this.
 */
export function isValidSessionId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}
