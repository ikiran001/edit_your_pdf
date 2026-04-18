import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/firebase.js'
import { initAnalytics } from './lib/analytics.js'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import './lib/pdfjs.js'
import './index.css'
import App from './App.jsx'

initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
