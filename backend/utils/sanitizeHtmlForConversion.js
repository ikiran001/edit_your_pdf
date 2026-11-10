/**
 * Neutralize external references in user-uploaded HTML before LibreOffice renders it to
 * PDF. LibreOffice resolves `<img src="http://169.254.169.254/...">`, `file://`, UNC
 * paths, `@import`, etc., which turns the HTML→PDF endpoint into an SSRF / local-file-read
 * primitive. We strip active/remote-fetching tags and blank out any attribute or CSS url()
 * that points off-box. Relative references and data: URIs are left intact.
 *
 * Defense-in-depth only: the robust fix is to run the conversion worker with no outbound
 * network access (see deploy notes). This reduces the attack surface in code regardless.
 */
const EXTERNAL = /^\s*(?:(?:https?|file|ftp|gopher|dict|ldap):|\/\/|\\\\)/i;

export function sanitizeHtmlForConversion(html) {
  let s = String(html == null ? '' : html);

  // Drop tags that fetch or execute external resources outright.
  s = s.replace(/<\s*(script|link|base|object|embed|iframe|frame|meta|applet)\b[^>]*>/gi, '');
  s = s.replace(/<\/\s*(script|object|iframe|applet)\s*>/gi, '');

  // Blank out resource-loading attributes whose value points off-box.
  s = s.replace(
    /\b(src|href|background|poster|data|srcset|action|formaction|xlink:href)\s*=\s*(['"])([\s\S]*?)\2/gi,
    (m, attr, q, val) => (EXTERNAL.test(val) ? `${attr}=${q}${q}` : m)
  );

  // Blank out external CSS url(...) references.
  s = s.replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (m, _q, val) =>
    EXTERNAL.test(val) ? 'url()' : m
  );

  // Drop @import rules targeting external stylesheets.
  s = s.replace(/@import\b[^;]*;?/gi, (m) => (EXTERNAL.test(m.replace(/@import\s*(url\()?\s*['"]?/i, '')) ? '' : m));

  return s;
}
