/**
 * Tests for the HTML sanitizer that blocks LibreOffice SSRF / local-file reads on the
 * html→pdf route. Run: node --test utils/sanitizeHtmlForConversion.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeHtmlForConversion } from './sanitizeHtmlForConversion.js'

test('neutralizes the cloud-metadata SSRF image reference', () => {
  const out = sanitizeHtmlForConversion(
    '<img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/">'
  )
  assert.ok(!out.includes('169.254.169.254'), 'metadata URL must be stripped')
  assert.ok(out.includes('src=""'), 'external src should be blanked')
})

test('strips external resources across protocols and forms', () => {
  for (const payload of [
    '<img src="https://evil.example/x.png">',
    '<img src="//evil.example/x.png">', // protocol-relative
    '<img src="file:///etc/passwd">',
    '<link rel="stylesheet" href="http://evil.example/x.css">',
    '<style>@import url("http://evil.example/x.css");</style>',
    '<div style="background:url(http://evil.example/x.png)">',
    '<iframe src="http://evil.example/"></iframe>',
    '<script src="http://evil.example/x.js"></script>',
  ]) {
    const out = sanitizeHtmlForConversion(payload)
    assert.ok(!/evil\.example/.test(out), `must strip external ref in: ${payload} -> ${out}`)
  }
})

test('leaves safe local/relative/data references intact', () => {
  const html = '<img src="logo.png"><img src="data:image/png;base64,AAAA"><a href="#top">x</a>'
  const out = sanitizeHtmlForConversion(html)
  assert.ok(out.includes('src="logo.png"'), 'relative path kept')
  assert.ok(out.includes('data:image/png;base64,AAAA'), 'data URI kept')
  assert.ok(out.includes('href="#top"'), 'anchor kept')
})

test('handles empty / nullish input without throwing', () => {
  assert.equal(sanitizeHtmlForConversion(''), '')
  assert.equal(sanitizeHtmlForConversion(null), '')
  assert.equal(sanitizeHtmlForConversion(undefined), '')
})
