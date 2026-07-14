// Crew standing tiers, stored on the crew member as stats.rank. Someone newly
// met starts at a disposition (neutral by default, or hostile/friendly); from
// there the DM can move them up to passenger, recruit, and finally Black Knot
// crew (the tattoo initiation). Ordered low → high.
export const RANKS = [
  { key: 'hostile', label: 'Hostile' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'passenger', label: 'Passenger' },
  { key: 'recruit', label: 'New Recruit' },
  { key: 'crew', label: 'Black Knot Crew' },
]
export const RANK_KEYS = RANKS.map((r) => r.key)
const DEFAULT_RANK = 'neutral'
export const rankKey = (m) => {
  const k = m?.stats?.rank
  return RANK_KEYS.includes(k) ? k : DEFAULT_RANK
}
export const rankLabel = (k) => (RANKS.find((r) => r.key === k) || RANKS.find((r) => r.key === DEFAULT_RANK)).label
