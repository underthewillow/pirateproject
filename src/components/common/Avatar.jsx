import { assetUrl } from '../../lib/asset'

// A crew portrait: shows the character's image if set, otherwise their
// initials on a coloured disc.
export default function Avatar({ member, size = '', onClick, title }) {
  const initials = (member?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const style = member?.image_url
    ? { backgroundImage: `url("${assetUrl(member.image_url)}")` }
    : { background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), transparent 60%), ${member?.color || '#6b4a2b'}` }
  return (
    <div
      className={`avatar ${size}`}
      style={style}
      onClick={onClick}
      title={title || member?.name}
      role={onClick ? 'button' : undefined}
    >
      {!member?.image_url && initials}
    </div>
  )
}
