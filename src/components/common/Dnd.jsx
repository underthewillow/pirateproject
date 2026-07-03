import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// Thin wrappers over @dnd-kit so every tab drags & drops the same way.
export function Draggable({ id, data, children, className = '', disabled = false, style: extra }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
    disabled,
  })
  const style = {
    ...extra,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 999 : undefined,
    cursor: disabled ? 'default' : 'grab',
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'dragging' : ''}`}
      {...(disabled ? {} : listeners)}
      {...attributes}
    >
      {children}
    </div>
  )
}

export function Droppable({ id, data, children, className = '', overClassName = 'over' }) {
  const { setNodeRef, isOver } = useDroppable({ id, data })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? overClassName : ''}`}>
      {children}
    </div>
  )
}
