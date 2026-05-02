import DocumentFlowConvertPage from '../document-flow/DocumentFlowConvertPage.jsx'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

export default function PowerpointToPdfPage() {
  return (
    <DocumentFlowConvertPage
      title="PowerPoint to PDF"
      subtitle="Convert a .pptx deck to PDF using LibreOffice on your API."
      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      dropHint="Drop a .pptx file here"
      endpoint="/document-flow/convert-pptx-to-pdf"
      outputName={(f) => `${(f.name || 'slides').replace(/\.pptx$/i, '') || 'presentation'}.pdf`}
      analyticsTool={ANALYTICS_TOOL.powerpoint_to_pdf}
      validateFile={(file) => {
        if (!/\.pptx$/i.test(file.name)) return 'Please choose a .pptx file.'
        return null
      }}
    />
  )
}
