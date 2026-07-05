// Fixed set of RBAC permission roles. Distinct from the `roles` table (ship
// station content edited via drag-and-drop in RolesTab.jsx) — station role
// keys are named to match so a future feature can derive a user's station
// permissions from their linked character's assigned stations.
export const GENERAL_ROLES = ['admin', 'dm', 'crew_member']

export const STATION_ROLES = [
  'captain',
  'boatswain',
  'quartermaster',
  'navigator',
  'gunmaster',
  'master_at_arms',
  'cook',
  'surgeon',
  'rigger',
  'carpenter',
  'lookout',
]

export const ALL_ROLES = [...GENERAL_ROLES, ...STATION_ROLES]

export const ROLE_LABELS = {
  admin: 'Admin',
  dm: 'DM',
  crew_member: 'Crew Member',
  captain: 'Captain',
  boatswain: 'Boatswain',
  quartermaster: 'Quartermaster',
  navigator: 'Navigator',
  gunmaster: 'Gunmaster',
  master_at_arms: 'Master at Arms',
  cook: 'Cook',
  surgeon: 'Surgeon',
  rigger: 'Rigger',
  carpenter: 'Carpenter',
  lookout: 'Lookout',
}
