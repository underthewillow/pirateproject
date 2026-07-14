import Avatar from './Avatar'

// A crew "pill" used on the Roles board (role holders + the roster overview).
// onOpen fires on click to open the character sheet.
export default function CrewToken({ member, onOpen, showRole = false }) {
  const roles = Array.isArray(member.roles) ? member.roles : []
  // Hidden members only ever reach this component for the DM (the data layer
  // filters them out for everyone else), so the mask badge is a DM-only cue.
  const hidden = !!member.stats?.hidden
  return (
    <div className={`crew-token ${hidden ? 'concealed' : ''}`} onClick={() => onOpen?.(member)}>
      <Avatar member={member} size="sm" />
      <div>
        <div className="name">
          {hidden && <span className="hide-mask" title="Hidden from the crew">🎭</span>}
          {member.is_pc && <span className="pc-star" title="Player character">★</span>}
          {member.name}
        </div>
        {showRole && (
          roles.length > 0
            ? <div className="role-tag">{roles.join(' · ')}</div>
            : <div className="role-tag muted">unassigned</div>
        )}
      </div>
    </div>
  )
}
