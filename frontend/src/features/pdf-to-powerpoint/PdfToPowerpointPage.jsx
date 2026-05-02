import DocumentFlowConvertPage from '../document-flow/DocumentFlowConvertPage.jsx'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

export default function PdfToPowerpointPage() {
  return (
    <DocumentFlowConvertPage
      title="PDF to PowerPoint"
      subtitle="Export an editable .pptx using LibreOffice on your API — results vary by PDF complexity."
      accept="application/pdf,.pdf"
      dropHint="Drop a PDF here (max ~52 MB on the server)"
      endpoint="/document-flow/convert-pdf-to-pptx"
      outputName={(f) => `${(f.name || 'document').replace(/\.pdf$/i, '') || 'document'}.pptx`}
      analyticsTool={ANALYTICS_TOOL.pdf_to_powerpoint}
      validateFile={(file) => {
        if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return 'Please choose a PDF.'
        return null
      }}
    />
  )
}
