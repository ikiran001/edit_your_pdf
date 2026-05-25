import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, RefreshCw, Send, Sparkles } from 'lucide-react'
import ToolPageShell from '../../shared/components/ToolPageShell.jsx'
import FileDropzone from '../../shared/components/FileDropzone.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useAuthModal } from '../../auth/AuthModalContext.jsx'
import { apiUrl } from '../../lib/apiBase.js'
import { useToolEngagement } from '../../hooks/useToolEngagement.js'
import {
  trackErrorOccurred,
  trackFileUploaded,
  trackToolCompleted,
} from '../../lib/analytics.js'
import { ANALYTICS_TOOL } from '../../shared/constants/analyticsTools.js'

const TOOL = ANALYTICS_TOOL.chat_with_pdf
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export default function ChatWithPdfPage() {
  const { user, loading: authLoading } = useAuth()
  const { openAuth } = useAuthModal()
  const [sessionId, setSessionId] = useState(null)
  const [filename, setFilename] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState(null)
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const recognitionRef = useRef(null)
  const inputBeforeDictationRef = useRef('')

  const SpeechRecognitionCtor = useMemo(() => {
    if (typeof window === 'undefined') return null
    return window.SpeechRecognition || window.webkitSpeechRecognition || null
  }, [])
  const speechSupported = Boolean(SpeechRecognitionCtor)

  useToolEngagement(TOOL, true)

  useEffect(() => () => {
    try {
      recognitionRef.current?.abort?.()
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const onPdf = useCallback(async (files) => {
    const file = files?.[0]
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`PDF must be under ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(apiUrl('/upload'), { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Upload failed (${res.status})`)
      }
      const data = await res.json()
      if (!data?.sessionId) throw new Error('Upload failed (no session).')
      setSessionId(data.sessionId)
      setFilename(file.name)
      setMessages([])
      trackFileUploaded({ tool: TOOL, file_size: file.size / 1024 })
    } catch (e) {
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'upload_failed')
      setError(e?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || !sessionId || thinking) return
    if (authLoading) {
      setError('Still checking sign-in… try again in a moment.')
      return
    }
    if (!user) {
      if (listening) {
        try {
          recognitionRef.current?.stop?.()
        } catch {
          /* ignore */
        }
      }
      setError(null)
      openAuth('signin')
      return
    }
    if (listening) {
      try {
        recognitionRef.current?.stop?.()
      } catch {
        /* ignore */
      }
    }
    setError(null)
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch(apiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          history: messages,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      const reply = String(body?.reply || '').trim() || '(no answer)'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      trackToolCompleted(TOOL, true)
    } catch (e) {
      console.error(e)
      trackErrorOccurred(TOOL, e?.message || 'chat_failed')
      setError(e?.message || 'Chat request failed.')
      setMessages((prev) => prev.slice(0, -1))
      setInput(text)
    } finally {
      setThinking(false)
    }
  }, [input, sessionId, thinking, messages, listening, user, authLoading, openAuth])

  const toggleDictation = useCallback(() => {
    if (!speechSupported || thinking) return
    if (listening) {
      try {
        recognitionRef.current?.stop?.()
      } catch {
        /* ignore */
      }
      return
    }
    let rec
    try {
      rec = new SpeechRecognitionCtor()
    } catch (e) {
      setError(e?.message || 'Voice input failed to start.')
      return
    }
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    inputBeforeDictationRef.current = input ? input.replace(/\s+$/, '') + ' ' : ''
    rec.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      const combined = (inputBeforeDictationRef.current + finalText + interim).replace(/\s+/g, ' ').trimStart()
      setInput(combined)
      if (finalText) {
        inputBeforeDictationRef.current = (inputBeforeDictationRef.current + finalText).replace(/\s+$/, '') + ' '
      }
    }
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission denied. Enable it for this site and try again.')
      } else if (event.error === 'no-speech') {
        /* silent; let UI return to idle */
      } else if (event.error !== 'aborted') {
        setError(`Voice input error: ${event.error}`)
      }
    }
    rec.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = rec
    setError(null)
    setListening(true)
    try {
      rec.start()
    } catch (e) {
      setListening(false)
      recognitionRef.current = null
      setError(e?.message || 'Voice input failed to start.')
    }
  }, [SpeechRecognitionCtor, speechSupported, thinking, listening, input])

  const resetDoc = useCallback(() => {
    try {
      recognitionRef.current?.abort?.()
    } catch {
      /* ignore */
    }
    setListening(false)
    setSessionId(null)
    setFilename(null)
    setMessages([])
    setInput('')
    setError(null)
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <ToolPageShell
      title="Chat with PDF"
      subtitle="Ask questions about your PDF. The text is extracted on the server and sent to an AI model so you can converse with the document."
    >
      {!sessionId ? (
        <>
          <FileDropzone
            accept="application/pdf,.pdf"
            disabled={uploading}
            busy={uploading}
            onFiles={onPdf}
            label={uploading ? 'Uploading…' : 'Drop a PDF here, or click to browse'}
            hint="We extract selectable text and use it as context for the chat. For scans, run OCR PDF first."
          />
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
              {error}
            </div>
          )}
          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
            Your document text is sent to the configured AI provider (OpenAI). It is not stored beyond
            the temporary session used by the editor. Don't upload PDFs you are not comfortable sharing
            with a third-party AI provider.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 text-indigo-500 shrink-0" />
              <span className="truncate font-medium">{filename || 'Document'}</span>
            </div>
            <button
              type="button"
              onClick={resetDoc}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="size-3" />
              New PDF
            </button>
          </div>

          <div
            ref={scrollRef}
            className="min-h-[24rem] max-h-[60vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/30"
          >
            {messages.length === 0 && !thinking && (
              <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500 dark:text-zinc-400">
                Ask a question about your PDF — e.g. <em>"Summarize this document"</em> or{' '}
                <em>"What does page 2 say about pricing?"</em>
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <li
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                        : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    }`}
                  >
                    {m.content}
                  </div>
                </li>
              ))}
              {thinking && (
                <li className="flex justify-start">
                  <div className="rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 animate-pulse rounded-full bg-zinc-400" />
                      <span className="size-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:120ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:240ms]" />
                    </span>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={listening ? 'Listening… speak now' : 'Ask about this PDF…'}
              disabled={thinking}
              className="flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={toggleDictation}
                disabled={thinking}
                aria-pressed={listening}
                title={listening ? 'Stop voice input' : 'Speak your question'}
                className={`inline-flex items-center justify-center rounded-2xl border px-3 py-3 text-sm shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  listening
                    ? 'animate-pulse border-red-500 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-950/50 dark:text-red-300'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-400'
                }`}
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                <span className="sr-only">{listening ? 'Stop voice input' : 'Voice input'}</span>
              </button>
            )}
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <Send className="size-4" />
              Send
            </button>
          </form>
        </div>
      )}
    </ToolPageShell>
  )
}
