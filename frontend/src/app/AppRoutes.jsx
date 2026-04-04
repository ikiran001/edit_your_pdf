import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import ToolkitHomePage from '../features/toolkit-home/ToolkitHomePage.jsx'
import EditPdfPage from '../features/edit-pdf/EditPdfPage.jsx'
import MergePdfPage from '../features/merge-pdf/MergePdfPage.jsx'
import SplitPdfPage from '../features/split-pdf/SplitPdfPage.jsx'
import CompressPdfPage from '../features/compress-pdf/CompressPdfPage.jsx'
import PdfToJpgPage from '../features/pdf-to-jpg/PdfToJpgPage.jsx'
import JpgToPdfPage from '../features/jpg-to-pdf/JpgToPdfPage.jsx'
import SignPdfPage from '../features/sign-pdf/SignPdfPage.jsx'
import UnlockPdfPage from '../features/unlock-pdf/UnlockPdfPage.jsx'
import ComingSoonToolPage from '../features/placeholder/ComingSoonToolPage.jsx'
import { pageView } from '../lib/analytics.js'
import { docTitleForPath } from '../shared/constants/branding.js'

function RouteAnalytics() {
  const loc = useLocation()
  useEffect(() => {
    const t = docTitleForPath(loc.pathname)
    document.title = t
    pageView(loc.pathname, t)
  }, [loc.pathname])
  return null
}

export default function AppRoutes() {
  const raw = import.meta.env.BASE_URL || '/'
  const basename = raw === '/' ? undefined : raw.replace(/\/$/, '')
  return (
    <BrowserRouter basename={basename}>
      <RouteAnalytics />
      <Routes>
        <Route path="/" element={<ToolkitHomePage />} />
        <Route path="/tools/edit-pdf" element={<EditPdfPage />} />
        <Route path="/tools/merge-pdf" element={<MergePdfPage />} />
        <Route path="/tools/split-pdf" element={<SplitPdfPage />} />
        <Route path="/tools/compress-pdf" element={<CompressPdfPage />} />
        <Route path="/tools/pdf-to-jpg" element={<PdfToJpgPage />} />
        <Route path="/tools/jpg-to-pdf" element={<JpgToPdfPage />} />
        <Route path="/tools/sign-pdf" element={<SignPdfPage />} />
        <Route path="/tools/unlock-pdf" element={<UnlockPdfPage />} />
        <Route
          path="/tools/pdf-to-word"
          element={
            <ComingSoonToolPage title="PDF to Word">
              High-fidelity PDF→DOCX needs a server converter. This repo will add an isolated
              backend route when ready, without touching the Edit PDF pipeline.
            </ComingSoonToolPage>
          }
        />
        <Route
          path="/tools/word-to-pdf"
          element={
            <ComingSoonToolPage title="Word to PDF">
              DOCX→PDF is best done with LibreOffice or a document API on the server. A future
              `features/word-to-pdf` service will call that API only.
            </ComingSoonToolPage>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
