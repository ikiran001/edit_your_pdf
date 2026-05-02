import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import ErrorBoundary from '../shared/components/ErrorBoundary.jsx'
import PrivateRoute from '../auth/PrivateRoute.jsx'
import { pageView } from '../lib/analytics.js'
import { docTitleForPath } from '../shared/constants/branding.js'
import { ClientToolDownloadAuthProvider } from '../auth/ClientToolDownloadAuthContext.jsx'
import SkipToContent from '../shared/components/SkipToContent.jsx'

const ToolkitHomePage = lazy(() => import('../features/toolkit-home/ToolkitHomePage.jsx'))
const EditPdfPage = lazy(() => import('../features/edit-pdf/EditPdfPage.jsx'))
const MergePdfPage = lazy(() => import('../features/merge-pdf/MergePdfPage.jsx'))
const SplitPdfPage = lazy(() => import('../features/split-pdf/SplitPdfPage.jsx'))
const CompressPdfPage = lazy(() => import('../features/compress-pdf/CompressPdfPage.jsx'))
const PdfToJpgPage = lazy(() => import('../features/pdf-to-jpg/PdfToJpgPage.jsx'))
const PdfToPngPage = lazy(() => import('../features/pdf-to-png/PdfToPngPage.jsx'))
const PdfToTextPage = lazy(() => import('../features/pdf-to-text/PdfToTextPage.jsx'))
const JpgToPdfPage = lazy(() => import('../features/jpg-to-pdf/JpgToPdfPage.jsx'))
const ScanToPdfPage = lazy(() => import('../features/scan-to-pdf/ScanToPdfPage.jsx'))
const SignPdfPage = lazy(() => import('../features/sign-pdf/SignPdfPage.jsx'))
const FillPdfPage = lazy(() => import('../features/fill-pdf/FillPdfPage.jsx'))
const FlattenPdfPage = lazy(() => import('../features/flatten-pdf/FlattenPdfPage.jsx'))
const UnlockPdfPage = lazy(() => import('../features/unlock-pdf/UnlockPdfPage.jsx'))
const OcrPdfPage = lazy(() => import('../features/ocr-pdf/OcrPdfPage.jsx'))
const EncryptPdfPage = lazy(() => import('../features/encrypt-pdf/EncryptPdfPage.jsx'))
const OrganizePdfPage = lazy(() => import('../features/organize-pdf/OrganizePdfPage.jsx'))
const PageNumbersPdfPage = lazy(() => import('../features/add-page-numbers/PageNumbersPdfPage.jsx'))
const WatermarkPdfPage = lazy(() => import('../features/add-watermark/WatermarkPdfPage.jsx'))
const WordToPdfPage = lazy(() => import('../features/word-to-pdf/WordToPdfPage.jsx'))
const PdfToWordPage = lazy(() => import('../features/pdf-to-word/PdfToWordPage.jsx'))
const GstInvoicePage = lazy(() => import('../features/gst-invoice/GstInvoicePage.jsx'))
const PlannedToolPage = lazy(() => import('../features/placeholder/PlannedToolPage.jsx'))
const CropPdfPage = lazy(() => import('../features/crop-pdf/CropPdfPage.jsx'))
const ComparePdfPage = lazy(() => import('../features/compare-pdf/ComparePdfPage.jsx'))
const PowerpointToPdfPage = lazy(() => import('../features/powerpoint-to-pdf/PowerpointToPdfPage.jsx'))
const ExcelToPdfPage = lazy(() => import('../features/excel-to-pdf/ExcelToPdfPage.jsx'))
const HtmlToPdfPage = lazy(() => import('../features/html-to-pdf/HtmlToPdfPage.jsx'))
const PdfToExcelPage = lazy(() => import('../features/pdf-to-excel/PdfToExcelPage.jsx'))
const PdfToPowerpointPage = lazy(() => import('../features/pdf-to-powerpoint/PdfToPowerpointPage.jsx'))
const TranslatePdfPage = lazy(() => import('../features/translate-pdf/TranslatePdfPage.jsx'))
const RedactPdfPage = lazy(() => import('../features/redact-pdf/RedactPdfPage.jsx'))
const MyDocumentsPage = lazy(() => import('../features/my-documents/MyDocumentsPage.jsx'))
const SubscriptionBillingPage = lazy(() => import('../features/account/SubscriptionBillingPage.jsx'))
const TermsOfServicePage = lazy(() => import('../features/legal/TermsOfServicePage.jsx'))
const FeedbackPage = lazy(() => import('../features/feedback/FeedbackPage.jsx'))
const AdminFeedbackPage = lazy(() => import('../features/feedback/AdminFeedbackPage.jsx'))

function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-slate-500">
      <span className="inline-block size-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden />
      <p className="text-sm">{t('common.loading')}</p>
    </div>
  )
}

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
          <Suspense fallback={<RouteFallback />}>
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
              <Route path="/tools/extract-pages" element={<SplitPdfPage />} />
              <Route path="/tools/compress-pdf" element={<CompressPdfPage />} />
              <Route path="/tools/pdf-to-jpg" element={<PdfToJpgPage />} />
              <Route path="/tools/pdf-to-png" element={<PdfToPngPage />} />
              <Route path="/tools/pdf-to-text" element={<PdfToTextPage />} />
              <Route path="/tools/jpg-to-pdf" element={<JpgToPdfPage />} />
              <Route path="/tools/scan-to-pdf" element={<ScanToPdfPage />} />
              <Route path="/tools/sign-pdf" element={<SignPdfPage />} />
              <Route path="/tools/fill-pdf" element={<FillPdfPage />} />
              <Route path="/tools/flatten-pdf" element={<FlattenPdfPage />} />
              <Route path="/tools/unlock-pdf" element={<UnlockPdfPage />} />
              <Route path="/tools/ocr-pdf" element={<OcrPdfPage />} />
              <Route path="/tools/encrypt-pdf" element={<EncryptPdfPage />} />
              <Route path="/tools/organize-pdf" element={<OrganizePdfPage />} />
              <Route path="/tools/remove-pages" element={<OrganizePdfPage />} />
              <Route path="/tools/rotate-pdf" element={<OrganizePdfPage />} />
              <Route path="/tools/add-page-numbers" element={<PageNumbersPdfPage />} />
              <Route path="/tools/add-watermark" element={<WatermarkPdfPage />} />
              <Route path="/tools/pdf-to-word" element={<PdfToWordPage />} />
              <Route path="/tools/word-to-pdf" element={<WordToPdfPage />} />
              <Route path="/tools/gst-invoice" element={<GstInvoicePage />} />
              <Route path="/tools/crop-pdf" element={<CropPdfPage />} />
              <Route path="/tools/compare-pdf" element={<ComparePdfPage />} />
              <Route path="/tools/repair-pdf" element={<PlannedToolPage />} />
              <Route path="/tools/powerpoint-to-pdf" element={<PowerpointToPdfPage />} />
              <Route path="/tools/excel-to-pdf" element={<ExcelToPdfPage />} />
              <Route path="/tools/html-to-pdf" element={<HtmlToPdfPage />} />
              <Route path="/tools/pdf-to-powerpoint" element={<PdfToPowerpointPage />} />
              <Route path="/tools/pdf-to-excel" element={<PdfToExcelPage />} />
              <Route path="/tools/pdf-to-pdfa" element={<PlannedToolPage />} />
              <Route path="/tools/redact-pdf" element={<RedactPdfPage />} />
              <Route path="/tools/ai-pdf-summarizer" element={<PlannedToolPage />} />
              <Route path="/tools/translate-pdf" element={<TranslatePdfPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </ClientToolDownloadAuthProvider>
    </BrowserRouter>
  )
}
