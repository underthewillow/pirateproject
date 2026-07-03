import Avatar from './Avatar'

// A draggable crew "pill". The Draggable wrapper is applied by the parent tab
// (so the same token works in the Crew and Roles boards). onOpen fires on click
// but not while dragging (dnd-kit uses an activation distance).
export default function CrewToken({ member, onOpen, showRole = false }) {
  const roles = Array.isArray(member.roles) ? member.roles : []
  return (
    <div className="crew-token" onClick={() => onOpen?.(member)}>
      <Avatar member={member} size="sm" />
      <div>
        <div className="name">{member.name}</div>
        {showRole && (
          roles.length > 0
            ? <div className="role-tag">{roles.join(' · ')}</div>
            : <div className="role-tag muted">unassigned</div>
        )}
      </div>
    </div>
  )
}
