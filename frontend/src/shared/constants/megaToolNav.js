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
      { type: 'tool', id: 'remove-pages', titleKey: 'megaTool.removePages' },
      { type: 'tool', id: 'extract-pages', titleKey: 'megaTool.extractPages' },
      { type: 'tool', id: 'organize-pdf', titleKey: 'megaTool.organizePdf' },
      { type: 'tool', id: 'scan-to-pdf' },
    ],
  },
  {
    labelKey: 'nav.megaOptimizePdf',
    tint: 'emerald',
    items: [
      { type: 'tool', id: 'compress-pdf' },
      { type: 'tool', id: 'repair-pdf', titleKey: 'megaTool.repairPdf' },
      { type: 'tool', id: 'ocr-pdf' },
    ],
  },
  {
    labelKey: 'nav.megaConvertToPdf',
    tint: 'sun',
    items: [
      { type: 'tool', id: 'jpg-to-pdf' },
      { type: 'tool', id: 'word-to-pdf' },
      { type: 'tool', id: 'powerpoint-to-pdf', titleKey: 'megaTool.powerpointToPdf' },
      { type: 'tool', id: 'excel-to-pdf', titleKey: 'megaTool.excelToPdf' },
      { type: 'tool', id: 'html-to-pdf', titleKey: 'megaTool.htmlToPdf' },
    ],
  },
  {
    labelKey: 'nav.megaConvertFromPdf',
    tint: 'azure',
    items: [
      { type: 'tool', id: 'pdf-to-jpg' },
      { type: 'tool', id: 'pdf-to-word' },
      { type: 'tool', id: 'pdf-to-powerpoint', titleKey: 'megaTool.pdfToPowerpoint' },
      { type: 'tool', id: 'pdf-to-excel', titleKey: 'megaTool.pdfToExcel' },
      { type: 'tool', id: 'pdf-to-pdfa', titleKey: 'megaTool.pdfToPdfA' },
    ],
  },
  {
    labelKey: 'nav.megaEditPdf',
    tint: 'violet',
    items: [
      { type: 'tool', id: 'rotate-pdf', titleKey: 'megaTool.rotatePdf' },
      { type: 'tool', id: 'add-page-numbers' },
      { type: 'tool', id: 'add-watermark' },
      { type: 'tool', id: 'crop-pdf', titleKey: 'megaTool.cropPdf' },
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
      { type: 'tool', id: 'redact-pdf', titleKey: 'megaTool.redactPdf' },
      { type: 'tool', id: 'compare-pdf', titleKey: 'megaTool.comparePdf' },
    ],
  },
  {
    labelKey: 'nav.megaPdfIntelligence',
    tint: 'orchid',
    items: [
      { type: 'tool', id: 'ai-pdf-summarizer', titleKey: 'megaTool.aiSummarizer' },
      { type: 'tool', id: 'translate-pdf', titleKey: 'megaTool.translatePdf' },
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
