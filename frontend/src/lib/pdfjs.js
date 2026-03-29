import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

// Legacy bundle polyfills Uint8Array.prototype.toHex etc. so PDFs load in older browsers
// (modern worker assumes very new runtimes and can throw hashOriginal.toHex is not a function).
GlobalWorkerOptions.workerSrc = workerUrl
