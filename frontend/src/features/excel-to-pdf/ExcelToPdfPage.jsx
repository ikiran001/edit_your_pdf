import DocumentFlowConvertPage from '../document-flow/DocumentFlowConvertPage.jsx'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

export default function ExcelToPdfPage() {
  return (
    <DocumentFlowConvertPage
      title="Excel to PDF"
      subtitle="Convert an .xlsx spreadsheet to PDF using LibreOffice on your API."
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      dropHint="Drop an .xlsx file here"
      endpoint="/document-flow/convert-xlsx-to-pdf"
      outputName={(f) => `${(f.name || 'sheet').replace(/\.xlsx$/i, '') || 'spreadsheet'}.pdf`}
      analyticsTool={ANALYTICS_TOOL.excel_to_pdf}
      validateFile={(file) => {
        if (!/\.xlsx$/i.test(file.name)) return 'Please choose an .xlsx file.'
        return null
      }}
    />
  )
}
