import { Router } from 'express';
import multer from 'multer';
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
      // verifyPDF throws (before its own try/catch) when there is no signature
      // field or the signature type is unsupported — treat both as "not signed".
      if (e?.type === 'TYPE_PARSE' || e?.type === 'UNSUPPORTED_SUBFILTER') {
        return res.json({ signed: false });
      }
      console.warn('[verify-signature] verify failed:', e?.message);
      return res.status(422).json({ error: 'Could not read signatures from this PDF.' });
    }

    if (!Array.isArray(result?.signatures)) {
      return res.status(422).json({ error: result?.message || 'Could not verify signatures.' });
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
