import { useState } from 'react'
import OrganizePageCard from './OrganizePageCard.jsx'

function reorderItems(items, dragId, targetId) {
  if (!dragId || !targetId || dragId === targetId) return items
  const next = [...items]
  const a = next.findIndex((x) => x.id === dragId)
  const b = next.findIndex((x) => x.id === targetId)
  if (a < 0 || b < 0) return items
  const [m] = next.splice(a, 1)
  next.splice(b, 0, m)
  return next
}

/** Swap page at `id` with its neighbor: delta -1 = earlier (smaller page #), +1 = later */
function swapPageWithNeighbor(items, id, delta) {
  const i = items.findIndex((x) => x.id === id)
  if (i < 0) return items
  const j = i + delta
  if (j < 0 || j >= items.length) return items
  const next = [...items]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export default function OrganizePageGrid({
  pdfDoc,
  pages,
  setPages,
  disabled,
  selectedIds,
  onToggleSelect,
  multiSelectEnabled,
  onRotateLeft,
  onRotateRight,
  onDeletePage,
}) {
  const [draggingId, setDraggingId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)

  const onDragStart = (id) => {
    setDraggingId(id)
    setDropTargetId(null)
  }

  const onDragEnd = () => {
    setDraggingId(null)
    setDropTargetId(null)
  }

  const onDragOver = (id) => {
    if (draggingId && id !== draggingId) setDropTargetId(id)
  }

  const onDrop = (fromId, targetId) => {
    setPages((prev) => reorderItems(prev, fromId, targetId))
    onDragEnd()
  }

  const moveEarlier = (id) => {
    setPages((prev) => swapPageWithNeighbor(prev, id, -1))
  }

  const moveLater = (id) => {
    setPages((prev) => swapPageWithNeighbor(prev, id, 1))
  }

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
      {pages.map((item, idx) => (
        <OrganizePageCard
          key={item.id}
          pdfDoc={pdfDoc}
          item={item}
          displayIndex1Based={idx + 1}
          disabled={disabled}
          isDragging={draggingId === item.id}
          isDropTarget={dropTargetId === item.id && draggingId != null && draggingId !== item.id}
          selected={selectedIds.has(item.id)}
          onToggleSelect={onToggleSelect}
          multiSelectEnabled={multiSelectEnabled}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          canMoveEarlier={idx > 0}
          canMoveLater={idx < pages.length - 1}
          onMoveEarlier={moveEarlier}
          onMoveLater={moveLater}
          onRotateLeft={onRotateLeft}
          onRotateRight={onRotateRight}
          onDelete={onDeletePage}
        />
      ))}
    </div>
  )
}
