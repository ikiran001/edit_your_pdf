import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TOOL_REGISTRY } from '../../shared/constants/toolRegistry.js'
import ComingSoonToolPage from './ComingSoonToolPage.jsx'

const toolByPath = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.path, t]))

export default function PlannedToolPage() {
  const { pathname } = useLocation()
  const path = (pathname || '/').replace(/\/$/, '') || '/'
  const { t } = useTranslation()
  const tool = toolByPath[path]
  const title = tool ? t(`tool.${tool.id}.title`, { defaultValue: tool.title }) : t('plannedTool.unknownTitle')

  return (
    <ComingSoonToolPage title={title}>
      {tool ? t(`tool.${tool.id}.plannedBody`, { defaultValue: t('plannedTool.defaultBody') }) : t('plannedTool.defaultBody')}
    </ComingSoonToolPage>
  )
}
