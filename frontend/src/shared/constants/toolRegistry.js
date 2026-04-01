/** Toolkit cards + paths. Each tool: src/features/<id>/ */
export const TOOL_REGISTRY = [
  { id: 'edit-pdf', path: '/tools/edit-pdf', title: 'Edit PDF', description: 'Change text, annotate, highlight, draw.', implemented: true, icon: 'FileEdit' },
  { id: 'pdf-to-jpg', path: '/tools/pdf-to-jpg', title: 'PDF to JPG', description: 'Export pages as JPEG. ZIP or single files.', implemented: true, icon: 'ImageDown' },
  { id: 'jpg-to-pdf', path: '/tools/jpg-to-pdf', title: 'JPG to PDF', description: 'Combine images. Drag to reorder.', implemented: true, icon: 'Images' },
  {
    id: 'sign-pdf',
    path: '/tools/sign-pdf',
    title: 'Sign PDF',
    description: 'Place a draggable signature on the preview, then download.',
    implemented: true,
    icon: 'PenLine',
  },
  { id: 'unlock-pdf', path: '/tools/unlock-pdf', title: 'Unlock PDF', description: 'Remove password in the browser.', implemented: true, icon: 'LockOpen' },
  { id: 'pdf-to-word', path: '/tools/pdf-to-word', title: 'PDF to Word', description: 'DOC/DOCX export via server (planned).', implemented: false, icon: 'FileType2' },
  { id: 'word-to-pdf', path: '/tools/word-to-pdf', title: 'Word to PDF', description: 'DOC/DOCX to PDF (planned).', implemented: false, icon: 'FileText' },
]
