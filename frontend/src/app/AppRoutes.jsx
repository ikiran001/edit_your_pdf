import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import ErrorBoundary from '../shared/components/ErrorBoundary.jsx'
import PrivateRoute from '../auth/PrivateRoute.jsx'
import { pageView, recordSessionRoute } from '../lib/analytics.js'
import { applyRouteHead } from '../shared/utils/routeHead.js'
import { rescanReveal } from '../shared/utils/scrollReveal.js'
import { ClientToolDownloadAuthProvider } from '../auth/ClientToolDownloadAuthContext.jsx'
import SkipToContent from '../shared/components/SkipToContent.jsx'
import AnimatedBackground from '../shared/components/AnimatedBackground.jsx'

/**
 * lazy() that recovers from stale-chunk 404s. After a new deploy, an already-open
 * tab (or cached index.html) references old hashed chunk filenames that no longer
 * exist → "Failed to fetch dynamically imported module". We reload once to pull
 * the fresh index.html + new chunks. The 10s guard prevents an infinite loop if
 * the import genuinely fails for another reason, and re-arms for future deploys.
 */
function lazyWithReload(factory) {
  return lazy(() =>
    factory().catch((err) => {
      try {
        const key = 'eyp-chunk-reload-at'
        const last = Number(sessionStorage.getItem(key) || 0)
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(key, String(Date.now()))
          window.location.reload()
          return new Promise(() => {}) // hang until the reload takes over
        }
      } catch {
        /* sessionStorage blocked — fall through to the error boundary */
      }
      throw err
    })
  )
}

const ToolkitHomePage = lazyWithReload(() => import('../features/toolkit-home/ToolkitHomePage.jsx'))
const EditPdfPage = lazyWithReload(() => import('../features/edit-pdf/EditPdfPage.jsx'))
const MergePdfPage = lazyWithReload(() => import('../features/merge-pdf/MergePdfPage.jsx'))
const SplitPdfPage = lazyWithReload(() => import('../features/split-pdf/SplitPdfPage.jsx'))
const CompressPdfPage = lazyWithReload(() => import('../features/compress-pdf/CompressPdfPage.jsx'))
const PdfToJpgPage = lazyWithReload(() => import('../features/pdf-to-jpg/PdfToJpgPage.jsx'))
const PdfToPngPage = lazyWithReload(() => import('../features/pdf-to-png/PdfToPngPage.jsx'))
const PdfToTextPage = lazyWithReload(() => import('../features/pdf-to-text/PdfToTextPage.jsx'))
const JpgToPdfPage = lazyWithReload(() => import('../features/jpg-to-pdf/JpgToPdfPage.jsx'))
const ScanToPdfPage = lazyWithReload(() => import('../features/scan-to-pdf/ScanToPdfPage.jsx'))
const SignPdfPage = lazyWithReload(() => import('../features/sign-pdf/SignPdfPage.jsx'))
const FillPdfPage = lazyWithReload(() => import('../features/fill-pdf/FillPdfPage.jsx'))
const FlattenPdfPage = lazyWithReload(() => import('../features/flatten-pdf/FlattenPdfPage.jsx'))
const UnlockPdfPage = lazyWithReload(() => import('../features/unlock-pdf/UnlockPdfPage.jsx'))
const OcrPdfPage = lazyWithReload(() => import('../features/ocr-pdf/OcrPdfPage.jsx'))
const EncryptPdfPage = lazyWithReload(() => import('../features/encrypt-pdf/EncryptPdfPage.jsx'))
const OrganizePdfPage = lazyWithReload(() => import('../features/organize-pdf/OrganizePdfPage.jsx'))
const PageNumbersPdfPage = lazyWithReload(() => import('../features/add-page-numbers/PageNumbersPdfPage.jsx'))
const WatermarkPdfPage = lazyWithReload(() => import('../features/add-watermark/WatermarkPdfPage.jsx'))
const WordToPdfPage = lazyWithReload(() => import('../features/word-to-pdf/WordToPdfPage.jsx'))
const PdfToWordPage = lazyWithReload(() => import('../features/pdf-to-word/PdfToWordPage.jsx'))
const GstInvoicePage = lazyWithReload(() => import('../features/gst-invoice/GstInvoicePage.jsx'))
const RepairPdfPage = lazyWithReload(() => import('../features/repair-pdf/RepairPdfPage.jsx'))
const CropPdfPage = lazyWithReload(() => import('../features/crop-pdf/CropPdfPage.jsx'))
const ComparePdfPage = lazyWithReload(() => import('../features/compare-pdf/ComparePdfPage.jsx'))
const PowerpointToPdfPage = lazyWithReload(() => import('../features/powerpoint-to-pdf/PowerpointToPdfPage.jsx'))
const ExcelToPdfPage = lazyWithReload(() => import('../features/excel-to-pdf/ExcelToPdfPage.jsx'))
const HtmlToPdfPage = lazyWithReload(() => import('../features/html-to-pdf/HtmlToPdfPage.jsx'))
const PdfToExcelPage = lazyWithReload(() => import('../features/pdf-to-excel/PdfToExcelPage.jsx'))
const PdfToPowerpointPage = lazyWithReload(() => import('../features/pdf-to-powerpoint/PdfToPowerpointPage.jsx'))
const TranslatePdfPage = lazyWithReload(() => import('../features/translate-pdf/TranslatePdfPage.jsx'))
const ChatWithPdfPage = lazyWithReload(() => import('../features/chat-with-pdf/ChatWithPdfPage.jsx'))
const RedactPdfPage = lazyWithReload(() => import('../features/redact-pdf/RedactPdfPage.jsx'))
const PlannedToolPage = lazyWithReload(() => import('../features/placeholder/PlannedToolPage.jsx'))
const MyDocumentsPage = lazyWithReload(() => import('../features/my-documents/MyDocumentsPage.jsx'))
const SubscriptionBillingPage = lazyWithReload(() => import('../features/account/SubscriptionBillingPage.jsx'))
const TermsOfServicePage = lazyWithReload(() => import('../features/legal/TermsOfServicePage.jsx'))
const FeedbackPage = lazyWithReload(() => import('../features/feedback/FeedbackPage.jsx'))
const AdminFeedbackPage = lazyWithReload(() => import('../features/feedback/AdminFeedbackPage.jsx'))
const BlogIndexPage = lazyWithReload(() => import('../features/blog/BlogIndexPage.jsx'))
const BlogPostPage = lazyWithReload(() => import('../features/blog/BlogPostPage.jsx'))

function RouteFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <span className="flex items-center gap-1.5" aria-hidden>
        <span className="fx-loader-dot h-2.5 w-2.5 rounded-full bg-indigo-500 dark:bg-cyan-400" />
        <span className="fx-loader-dot h-2.5 w-2.5 rounded-full bg-fuchsia-500 dark:bg-fuchsia-400" style={{ animationDelay: '0.15s' }} />
        <span className="fx-loader-dot h-2.5 w-2.5 rounded-full bg-cyan-500 dark:bg-amber-300" style={{ animationDelay: '0.3s' }} />
      </span>
      <p className="text-sm">{t('common.loading')}</p>
    </div>
  )
}

function RouteAnalytics() {
  const loc = useLocation()
  useEffect(() => {
    applyRouteHead(loc.pathname)
    recordSessionRoute(loc.pathname)
    // applyRouteHead has set the correct per-route document.title (incl. blog posts).
    pageView(loc.pathname, document.title)
    // Pick up any `.fx-reveal` elements the new page just rendered.
    const id = setTimeout(rescanReveal, 80)
    return () => clearTimeout(id)
  }, [loc.pathname])
  return null
}

/** Fades each route in on navigation (keyed by pathname). */
function PageFade({ children }) {
  const loc = useLocation()
  return (
    <div key={loc.pathname} className="fx-page-in motion-reduce:animate-none">
      {children}
    </div>
  )
}

export default function AppRoutes() {
  const raw = import.meta.env.BASE_URL || '/'
  const basename = raw === '/' ? undefined : raw.replace(/\/$/, '')
  return (
    <BrowserRouter basename={basename}>
      <AnimatedBackground />
      <SkipToContent />
      <ClientToolDownloadAuthProvider>
        <ErrorBoundary>
          <RouteAnalytics />
          <Suspense fallback={<RouteFallback />}>
            <PageFade>
            <Routes>
              <Route path="/" element={<ToolkitHomePage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/blog" element={<BlogIndexPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
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
              <Route path="/tools/e-sign" element={<SignPdfPage />} />
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
              <Route path="/tools/repair-pdf" element={<RepairPdfPage />} />
              <Route path="/tools/powerpoint-to-pdf" element={<PowerpointToPdfPage />} />
              <Route path="/tools/excel-to-pdf" element={<ExcelToPdfPage />} />
              <Route path="/tools/html-to-pdf" element={<HtmlToPdfPage />} />
              <Route path="/tools/pdf-to-powerpoint" element={<PdfToPowerpointPage />} />
              <Route path="/tools/pdf-to-excel" element={<PdfToExcelPage />} />
              <Route path="/tools/pdf-to-pdfa" element={<PlannedToolPage />} />
              <Route path="/tools/redact-pdf" element={<RedactPdfPage />} />
              <Route path="/tools/translate-pdf" element={<TranslatePdfPage />} />
              <Route path="/tools/chat-with-pdf" element={<ChatWithPdfPage />} />
            </Routes>
            </PageFade>
          </Suspense>
        </ErrorBoundary>
      </ClientToolDownloadAuthProvider>
    </BrowserRouter>
  )
}
