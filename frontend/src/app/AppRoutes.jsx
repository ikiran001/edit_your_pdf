import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import ErrorBoundary from '../shared/components/ErrorBoundary.jsx'
import ToolkitHomePage from '../features/toolkit-home/ToolkitHomePage.jsx'
import EditPdfPage from '../features/edit-pdf/EditPdfPage.jsx'
import MergePdfPage from '../features/merge-pdf/MergePdfPage.jsx'
import SplitPdfPage from '../features/split-pdf/SplitPdfPage.jsx'
import CompressPdfPage from '../features/compress-pdf/CompressPdfPage.jsx'
import PdfToJpgPage from '../features/pdf-to-jpg/PdfToJpgPage.jsx'
import JpgToPdfPage from '../features/jpg-to-pdf/JpgToPdfPage.jsx'
import ScanToPdfPage from '../features/scan-to-pdf/ScanToPdfPage.jsx'
import SignPdfPage from '../features/sign-pdf/SignPdfPage.jsx'
import UnlockPdfPage from '../features/unlock-pdf/UnlockPdfPage.jsx'
import OcrPdfPage from '../features/ocr-pdf/OcrPdfPage.jsx'
import EncryptPdfPage from '../features/encrypt-pdf/EncryptPdfPage.jsx'
import OrganizePdfPage from '../features/organize-pdf/OrganizePdfPage.jsx'
import PageNumbersPdfPage from '../features/add-page-numbers/PageNumbersPdfPage.jsx'
import WatermarkPdfPage from '../features/add-watermark/WatermarkPdfPage.jsx'
import WordToPdfPage from '../features/word-to-pdf/WordToPdfPage.jsx'
import PdfToWordPage from '../features/pdf-to-word/PdfToWordPage.jsx'
import GstInvoicePage from '../features/gst-invoice/GstInvoicePage.jsx'
import MyDocumentsPage from '../features/my-documents/MyDocumentsPage.jsx'
import SubscriptionBillingPage from '../features/account/SubscriptionBillingPage.jsx'
import TermsOfServicePage from '../features/legal/TermsOfServicePage.jsx'
import FeedbackPage from '../features/feedback/FeedbackPage.jsx'
import AdminFeedbackPage from '../features/feedback/AdminFeedbackPage.jsx'
import PrivateRoute from '../auth/PrivateRoute.jsx'
import { pageView } from '../lib/analytics.js'
import { docTitleForPath } from '../shared/constants/branding.js'
import { ClientToolDownloadAuthProvider } from '../auth/ClientToolDownloadAuthContext.jsx'
import SkipToContent from '../shared/components/SkipToContent.jsx'

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
      <SkipToContent />
      <ClientToolDownloadAuthProvider>
        <ErrorBoundary>
          <RouteAnalytics />
          <Routes>
        <Route path="/" element={<ToolkitHomePage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/admin/feedback" element={<AdminFeedbackPage />} />
        <Route
          path="/my-documents"
          element={
            <PrivateRoute>
              <MyDocumentsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/account/subscription"
          element={
            <PrivateRoute>
              <SubscriptionBillingPage />
            </PrivateRoute>
          }
        />
        <Route path="/tools/edit-pdf/editor" element={<EditPdfPage />} />
        <Route path="/tools/edit-pdf" element={<EditPdfPage />} />
        <Route path="/tools/merge-pdf" element={<MergePdfPage />} />
        <Route path="/tools/split-pdf" element={<SplitPdfPage />} />
        <Route path="/tools/compress-pdf" element={<CompressPdfPage />} />
        <Route path="/tools/pdf-to-jpg" element={<PdfToJpgPage />} />
        <Route path="/tools/jpg-to-pdf" element={<JpgToPdfPage />} />
        <Route path="/tools/scan-to-pdf" element={<ScanToPdfPage />} />
        <Route path="/tools/sign-pdf" element={<SignPdfPage />} />
        <Route path="/tools/unlock-pdf" element={<UnlockPdfPage />} />
        <Route path="/tools/ocr-pdf" element={<OcrPdfPage />} />
        <Route path="/tools/encrypt-pdf" element={<EncryptPdfPage />} />
        <Route path="/tools/organize-pdf" element={<OrganizePdfPage />} />
        <Route path="/tools/add-page-numbers" element={<PageNumbersPdfPage />} />
        <Route path="/tools/add-watermark" element={<WatermarkPdfPage />} />
        <Route path="/tools/pdf-to-word" element={<PdfToWordPage />} />
        <Route path="/tools/word-to-pdf" element={<WordToPdfPage />} />
        <Route path="/tools/gst-invoice" element={<GstInvoicePage />} />
          </Routes>
        </ErrorBoundary>
      </ClientToolDownloadAuthProvider>
    </BrowserRouter>
  )
}
