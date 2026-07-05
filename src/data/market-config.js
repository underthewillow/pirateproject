// Market taxonomy: merchant types and port flairs. Purely client-side config —
// these seed one-click ports/merchants, but everything is editable in-app after.

// A merchant type maps to the catalog categories it stocks (see src/data/catalog.js
// for the category names). `mult` is the type's default markup. `provisionOnly`
// narrows the Provisions category to one kind (e.g. a Tavern sells only drink).
export const MERCHANT_TYPES = {
  provisioner: { label: 'Provisioner', emoji: '🍖', categories: ['Provisions'], mult: 1 },
  tavern:      { label: 'Tavern', emoji: '🍷', categories: ['Provisions'], provisionOnly: 'drink', mult: 1 },
  general:     { label: 'General Store', emoji: '🎒', categories: ['Gear'], mult: 1 },
  weaponsmith: { label: 'Weaponsmith', emoji: '⚔️', categories: ['Weapons'], mult: 1 },
  armorer:     { label: 'Armorer', emoji: '🛡️', categories: ['Armor'], mult: 1 },
  tinker:      { label: 'Tinker', emoji: '🔧', categories: ['Tools'], mult: 1 },
  shipwright:  { label: 'Shipwright', emoji: '⚓', categories: ['Mounts & Vehicles'], mult: 1 },
  blackmarket: {
    label: 'Black Market', emoji: '🏴‍☠️',
    categories: ['Provisions', 'Gear', 'Weapons', 'Armor', 'Tools', 'Mounts & Vehicles'],
    mult: 1.5,
  },
}

// A port flair sets a default merchant roster and an overall price tendency.
export const PORT_FLAIRS = {
  'fishing-village': {
    label: 'Fishing Village', emoji: '🎣',
    blurb: 'A sleepy harbor of nets and salt — cheap staples, few luxuries.',
    price_mult: 0.9, merchants: ['provisioner', 'general'],
  },
  'trade-hub': {
    label: 'Trade Hub', emoji: '⚖️',
    blurb: 'Competition keeps prices keen and the shelves full.',
    price_mult: 0.85, merchants: ['general', 'provisioner', 'weaponsmith', 'armorer', 'tinker'],
  },
  'capital-city': {
    label: 'Capital City', emoji: '🏛️',
    blurb: 'A great city where nearly anything can be bought — at a fair price.',
    price_mult: 1.0, merchants: ['general', 'provisioner', 'tavern', 'weaponsmith', 'armorer', 'tinker', 'shipwright'],
  },
  'pirate-cove': {
    label: 'Pirate Cove', emoji: '🏴‍☠️',
    blurb: 'A lawless anchorage. Rum flows and stolen goods change hands.',
    price_mult: 1.3, merchants: ['tavern', 'blackmarket', 'shipwright'],
  },
  'military-port': {
    label: 'Military Port', emoji: '⚔️',
    blurb: 'A fortified naval base — arms and rations, little else.',
    price_mult: 1.0, merchants: ['weaponsmith', 'armorer', 'provisioner'],
  },
  'remote-outpost': {
    label: 'Remote Outpost', emoji: '🧭',
    blurb: 'The edge of the map. Everything is shipped in at a steep markup.',
    price_mult: 1.6, merchants: ['general', 'provisioner'],
  },
}

export const MERCHANT_TYPE_KEYS = Object.keys(MERCHANT_TYPES)
export const PORT_FLAIR_KEYS = Object.keys(PORT_FLAIRS)
