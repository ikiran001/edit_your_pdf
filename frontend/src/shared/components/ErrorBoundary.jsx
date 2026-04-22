import { Component } from 'react'
import { BRAND_NAME } from '../constants/branding.js'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-zinc-100 p-6 text-center dark:bg-zinc-950">
          <p className="m-0 max-w-md text-lg font-medium text-zinc-800 dark:text-zinc-100">
            Something went wrong in {BRAND_NAME}.
          </p>
          <p className="m-0 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            You can reload the page. If this keeps happening, try a different browser or a smaller PDF.
          </p>
          <button
            type="button"
            className="fx-focus-ring rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 active:scale-[0.98]"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
