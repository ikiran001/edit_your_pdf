import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAnalytics } from './lib/analytics.js'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './lib/pdfjs.js'
import './index.css'
import App from './App.jsx'

initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
