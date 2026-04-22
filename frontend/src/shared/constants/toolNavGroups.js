import { TOOL_REGISTRY } from './toolRegistry.js'

const toolById = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.id, t]))

/**
 * Mega-menu columns on the toolkit home. Each `toolIds` entry must exist in {@link TOOL_REGISTRY}.
 * `tint` picks icon tile colors in the menu (see ToolkitNavMenus.jsx).
 */
export const TOOL_NAV_GROUPS = [
  {
    label: 'Organize PDF',
    tint: 'violet',
    toolIds: ['merge-pdf', 'split-pdf', 'organize-pdf'],
  },
  {
    label: 'Edit & sign',
    tint: 'rose',
    toolIds: ['edit-pdf', 'sign-pdf', 'add-watermark'],
  },
  {
    label: 'Convert & export',
    tint: 'amber',
    toolIds: [
      'compress-pdf',
      'pdf-to-jpg',
      'jpg-to-pdf',
      'scan-to-pdf',
      'word-to-pdf',
      'pdf-to-word',
      'gst-invoice',
    ],
  },
  {
    label: 'Security',
    tint: 'sky',
    toolIds: ['unlock-pdf', 'encrypt-pdf'],
  },
]

/** @param {{ label: string, toolIds: string[] }} group */
export function toolsInNavGroup(group) {
  return group.toolIds.map((id) => toolById[id]).filter(Boolean)
}
