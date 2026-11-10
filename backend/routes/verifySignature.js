import { Router } from 'express';
import multer from 'multer';
import forge from 'node-forge';
import verifyPDF from 'pdf-signature-reader';
import { guardPdfPageCount } from '../utils/pdfLimits.js';

const MAX_BYTES = 25 * 1024 * 1024;

const router = Router();

const mem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file');

function pdfHeadOk(buf) {
  const head = buf.subarray(0, Math.min(5, buf.length)).toString('latin1');
  return head.startsWith('%PDF');
}

function mapSignature(sig) {
  const client = sig.meta?.certs?.find((c) => c.clientCertificate) || sig.meta?.certs?.[0];
  return {
    signer: client?.issuedTo?.commonName || sig.meta?.signatureMeta?.name || 'Unknown signer',
    issuedBy: client?.issuedBy?.commonName || null,
    integrity: sig.integrity,
    authenticity: sig.authenticity,
    expired: sig.expired,
    validFrom: client?.validityPeriod?.notBefore || null,
    validTo: client?.validityPeriod?.notAfter || null,
    reason: sig.meta?.signatureMeta?.reason || null,
    location: sig.meta?.signatureMeta?.location || null,
  };
}

// The end-entity cert is the one no other cert is issued by (its subject is
// nobody's issuer). Falls back to the first cert if the chain is unusual.
function leafCert(certs) {
  const issuerCNs = new Set(certs.map((c) => c.issuer.getField('CN')?.value).filter(Boolean));
  return certs.find((c) => {
    const cn = c.subject.getField('CN')?.value;
    return cn && !issuerCNs.has(cn);
  }) || certs[0];
}

// Best-effort signer list straight from each /Contents <hex> PKCS#7 blob, used
// when the full verifier cannot (e.g. the file was altered after signing).
function extractSigners(buf) {
  const text = buf.toString('latin1');
  const re = /\/Contents\s*<([0-9A-Fa-f]+)>/g;
  const signers = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const der = Buffer.from(m[1], 'hex').toString('latin1');
      const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der, { parseAllBytes: false }));
      const certs = p7.certificates || [];
      if (!certs.length) continue;
      const leaf = leafCert(certs);
      signers.push({
        signer: leaf.subject.getField('CN')?.value || 'Unknown signer',
        issuedBy: leaf.issuer.getField('CN')?.value || null,
        validFrom: leaf.validity?.notBefore || null,
        validTo: leaf.validity?.notAfter || null,
      });
    } catch {
      // not a parseable signature blob — skip it
    }
  }
  return signers;
}

// True when a signed ByteRange reaches past the end of the file, which means
// the document was shrunk/truncated/re-saved after signing.
function byteRangeBeyondEof(buf) {
  const text = buf.toString('latin1');
  const re = /\/ByteRange\s*\[\s*\d+\s+\d+\s+(\d+)\s+(\d+)\s*\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (Number(m[1]) + Number(m[2]) > buf.length) return true;
  }
  return false;
}

// Fallback when pdf-signature-reader cannot verify: decide whether the PDF is
// unsigned, or signed-but-unverifiable, and report signer + reason honestly.
function analyzeUnverified(buf) {
  const text = buf.toString('latin1');
  if (!/\/SubFilter\s*\/(adbe\.pkcs7|ETSI\.CAdES)/i.test(text)) {
    return { signed: false };
  }
  return {
    signed: true,
    verified: false,
    integrity: false,
    unreadable: true,
    note: byteRangeBeyondEof(buf)
      ? 'The signature does not match this file — the document appears to have been modified or is incomplete since it was signed.'
      : 'This PDF is signed, but its signature could not be fully verified here.',
    signatures: extractSigners(buf),
  };
}

/**
 * POST /verify-signature — multipart: field `file` (PDF).
 * Reports each embedded digital signature and whether the document was
 * modified since signing (integrity). Trust is validated against the
 * signature's own certificate chain only, not an external CA store.
 */
router.post('/verify-signature', (req, res) => {
  mem(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No PDF file' });
    }
    if (!pdfHeadOk(req.file.buffer)) {
      return res.status(400).json({ error: 'Not a valid PDF' });
    }

    const guard = await guardPdfPageCount(req.file.buffer);
    if (!guard.ok) return res.status(guard.status).json(guard.body);

    let result;
    try {
      result = verifyPDF(req.file.buffer);
    } catch (e) {
      // verifyPDF throws (before its own try/catch) for missing/unsupported
      // signatures — fall back to our own best-effort analysis.
      return res.json(analyzeUnverified(req.file.buffer));
    }

    // verifyPDF swallows internal parse failures into { message } with no
    // signatures array — treat that as unverifiable, not a hard error.
    if (!Array.isArray(result?.signatures)) {
      console.warn('[verify-signature] unverifiable:', result?.message);
      return res.json(analyzeUnverified(req.file.buffer));
    }

    res.json({
      signed: true,
      verified: result.verified,
      integrity: result.integrity,
      authenticity: result.authenticity,
      expired: result.expired,
      signatures: result.signatures.map(mapSignature),
    });
  });
});

export default router;
