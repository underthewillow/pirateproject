import Avatar from './Avatar'

// A draggable crew "pill". The Draggable wrapper is applied by the parent tab
// (so the same token works in the Crew and Roles boards). onOpen fires on click
// but not while dragging (dnd-kit uses an activation distance).
export default function CrewToken({ member, onOpen, showRole = false }) {
  return (
    <div className="crew-token" onClick={() => onOpen?.(member)}>
      <Avatar member={member} size="sm" />
      <div>
        <div className="name">{member.name}</div>
        {showRole && member.role && <div className="role-tag">{member.role}</div>}
        {showRole && !member.role && <div className="role-tag muted">unassigned</div>}
      </div>
    </div>
  )
}
