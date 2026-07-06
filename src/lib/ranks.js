// Crew standing tiers. A soul climbs passenger → new recruit → Black Knot crew,
// the last step being the Black Knot tattoo initiation. Stored on the crew
// member as stats.rank.
export const RANKS = [
  { key: 'passenger', label: 'Passenger' },
  { key: 'recruit', label: 'New Recruit' },
  { key: 'crew', label: 'Black Knot Crew' },
]
export const RANK_KEYS = RANKS.map((r) => r.key)
export const rankKey = (m) => {
  const k = m?.stats?.rank
  return RANK_KEYS.includes(k) ? k : 'recruit'
}
export const rankLabel = (k) => (RANKS.find((r) => r.key === k) || RANKS[1]).label
