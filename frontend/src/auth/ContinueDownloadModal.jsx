import SignInExperienceModal from './SignInExperienceModal.jsx'

/**
 * Edit-PDF download gate: same auth UI as header, with download-specific copy.
 */
export default function ContinueDownloadModal({ onDismiss, ...rest }) {
  return <SignInExperienceModal {...rest} variant="download" onClose={onDismiss} />
}
