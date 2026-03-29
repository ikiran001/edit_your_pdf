import { useCallback, useReducer } from 'react'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Undo/redo over a per-page map: { [pageIndex: string]: annotation[] }.
 */
function historyReducer(state, action) {
  switch (action.type) {
    case 'commit': {
      const next =
        typeof action.payload === 'function'
          ? action.payload(state.present)
          : action.payload
      return {
        past: [...state.past, clone(state.present)],
        present: next,
        future: [],
      }
    }
    case 'undo': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      }
    }
    case 'reset':
      return { past: [], present: action.payload ?? {}, future: [] }
    default:
      return state
  }
}

export function usePagesHistory(initialPresent = {}) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialPresent,
    future: [],
  })

  const commit = useCallback((payload) => {
    dispatch({ type: 'commit', payload })
  }, [])

  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const reset = useCallback((payload) => dispatch({ type: 'reset', payload }), [])

  return {
    pagesItems: state.present,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
  }
}
