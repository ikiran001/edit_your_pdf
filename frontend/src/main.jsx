import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n/i18n.js'
import './lib/firebase.js'
import { initAnalytics, initSessionRecording } from './lib/analytics.js'
import { initClarity } from './lib/clarity.js'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AuthModalProvider } from './auth/AuthModalContext.jsx'
import { SubscriptionProvider } from './subscription/SubscriptionContext.jsx'
import './lib/pdfjs.js'
import './index.css'
import App from './App.jsx'

initAnalytics()
initSessionRecording()
initClarity()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <AuthModalProvider>
            <SubscriptionProvider>
              <App />
            </SubscriptionProvider>
          </AuthModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
)
