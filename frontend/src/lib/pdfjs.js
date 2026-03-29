import { GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

// pdf.js must load its worker from a real URL (Vite serves this from node_modules).
GlobalWorkerOptions.workerSrc = workerUrl
