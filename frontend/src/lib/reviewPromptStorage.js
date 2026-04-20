const KEY = 'eyp_feedback_prompt_v1'

export function setFeedbackPromptAfterDownload() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* private mode / quota */
  }
}

/** @returns {boolean} whether a post-download feedback prompt is set (does not clear). */
export function peekFeedbackPrompt() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** @returns {boolean} whether a prompt was pending (and clears it). */
export function consumeFeedbackPrompt() {
  try {
    if (sessionStorage.getItem(KEY) !== '1') return false
    sessionStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}
