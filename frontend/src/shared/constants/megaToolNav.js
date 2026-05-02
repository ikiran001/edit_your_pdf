import { TOOL_REGISTRY } from './toolRegistry.js'

const toolById = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.id, t]))

/**
 * All Tools mega-menu: seven columns (reference layout). Items are either a registry tool
 * (`type: 'tool'`) or a coming-soon row (`type: 'soon'`). Optional `titleKey` overrides the label.
 *
 * @typedef {{ type: 'tool', id: string, titleKey?: string }} MegaNavToolRef
 * @typedef {{ type: 'soon', icon: string, titleKey: string }} MegaNavSoonRef
 * @typedef {MegaNavToolRef | MegaNavSoonRef} MegaNavItemRef
 * @typedef {{ labelKey: string, tint: string, items: MegaNavItemRef[] }} MegaNavGroupDef
 */

/** @type {MegaNavGroupDef[]} */
export const MEGA_NAV_GROUPS = [
  {
    labelKey: 'nav.megaOrganizePdf',
    tint: 'coral',
    items: [
      { type: 'tool', id: 'merge-pdf' },
      { type: 'tool', id: 'split-pdf' },
      { type: 'soon', icon: 'Trash2', titleKey: 'megaTool.removePages' },
      { type: 'soon', icon: 'FileDown', titleKey: 'megaTool.extractPages' },
      { type: 'tool', id: 'organize-pdf', titleKey: 'megaTool.organizePdf' },
      { type: 'tool', id: 'scan-to-pdf' },
    ],
  },
  {
    labelKey: 'nav.megaOptimizePdf',
    tint: 'emerald',
    items: [
      { type: 'tool', id: 'compress-pdf' },
      { type: 'soon', icon: 'Wrench', titleKey: 'megaTool.repairPdf' },
      { type: 'tool', id: 'ocr-pdf' },
    ],
  },
  {
    labelKey: 'nav.megaConvertToPdf',
    tint: 'sun',
    items: [
      { type: 'tool', id: 'jpg-to-pdf' },
      { type: 'tool', id: 'word-to-pdf' },
      { type: 'soon', icon: 'Presentation', titleKey: 'megaTool.powerpointToPdf' },
      { type: 'soon', icon: 'Table2', titleKey: 'megaTool.excelToPdf' },
      { type: 'soon', icon: 'FileCode', titleKey: 'megaTool.htmlToPdf' },
    ],
  },
  {
    labelKey: 'nav.megaConvertFromPdf',
    tint: 'azure',
    items: [
      { type: 'tool', id: 'pdf-to-jpg' },
      { type: 'tool', id: 'pdf-to-word' },
      { type: 'soon', icon: 'Presentation', titleKey: 'megaTool.pdfToPowerpoint' },
      { type: 'soon', icon: 'Table2', titleKey: 'megaTool.pdfToExcel' },
      { type: 'soon', icon: 'BadgeCheck', titleKey: 'megaTool.pdfToPdfA' },
    ],
  },
  {
    labelKey: 'nav.megaEditPdf',
    tint: 'violet',
    items: [
      { type: 'soon', icon: 'RotateCw', titleKey: 'megaTool.rotatePdf' },
      { type: 'tool', id: 'add-page-numbers' },
      { type: 'tool', id: 'add-watermark' },
      { type: 'soon', icon: 'Crop', titleKey: 'megaTool.cropPdf' },
      { type: 'tool', id: 'edit-pdf' },
    ],
  },
  {
    labelKey: 'nav.megaPdfSecurity',
    tint: 'navy',
    items: [
      { type: 'tool', id: 'unlock-pdf' },
      { type: 'tool', id: 'encrypt-pdf', titleKey: 'megaTool.protectPdf' },
      { type: 'tool', id: 'sign-pdf' },
      { type: 'soon', icon: 'EyeOff', titleKey: 'megaTool.redactPdf' },
      { type: 'soon', icon: 'GitCompare', titleKey: 'megaTool.comparePdf' },
    ],
  },
  {
    labelKey: 'nav.megaPdfIntelligence',
    tint: 'orchid',
    items: [
      { type: 'soon', icon: 'Sparkles', titleKey: 'megaTool.aiSummarizer' },
      { type: 'soon', icon: 'Languages', titleKey: 'megaTool.translatePdf' },
    ],
  },
]

/**
 * @param {MegaNavItemRef} item
 * @returns {{ kind: 'tool', tool: object, titleKey?: string } | { kind: 'soon', icon: string, titleKey: string } | null}
 */
export function resolveMegaNavItem(item) {
  if (item.type === 'soon') {
    return { kind: 'soon', icon: item.icon, titleKey: item.titleKey }
  }
  const tool = toolById[item.id]
  if (!tool) return null
  return { kind: 'tool', tool, titleKey: item.titleKey }
}

export { toolById }
