import DocumentFlowConvertPage from '../document-flow/DocumentFlowConvertPage.jsx'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

export default function HtmlToPdfPage() {
  return (
    <DocumentFlowConvertPage
      title="HTML to PDF"
      subtitle="Convert a saved .html file to PDF using LibreOffice on your API (complex pages may need headless Chrome instead)."
      accept=".html,.htm,text/html"
      dropHint="Drop an .html or .htm file here"
      endpoint="/document-flow/convert-html-to-pdf"
      outputName={(f) => `${(f.name || 'page').replace(/\.(html|htm)$/i, '') || 'page'}.pdf`}
      analyticsTool={ANALYTICS_TOOL.html_to_pdf}
      validateFile={(file) => {
        const n = (file.name || '').toLowerCase()
        if (!n.endsWith('.html') && !n.endsWith('.htm')) return 'Please choose an .html file.'
        return null
      }}
    />
  )
}
