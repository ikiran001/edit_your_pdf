import DocumentFlowConvertPage from '../document-flow/DocumentFlowConvertPage.jsx'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

export default function PdfToExcelPage() {
  return (
    <DocumentFlowConvertPage
      title="PDF to Excel"
      subtitle="Export an .xlsx using LibreOffice on your API — layout is best-effort; scans need OCR first."
      accept="application/pdf,.pdf"
      dropHint="Drop a PDF here (max ~52 MB on the server)"
      endpoint="/document-flow/convert-pdf-to-xlsx"
      outputName={(f) => `${(f.name || 'document').replace(/\.pdf$/i, '') || 'document'}.xlsx`}
      analyticsTool={ANALYTICS_TOOL.pdf_to_excel}
      validateFile={(file) => {
        if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return 'Please choose a PDF.'
        return null
      }}
    />
  )
}
