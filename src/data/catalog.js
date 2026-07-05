import srd from './srd-equipment.json'

// The market catalog = a curated food/drink list (for the feeding mechanic, since
// the 5e SRD equipment list has no servings/drink data) merged with the bundled
// SRD 5.1 gear. All costs are in gp. SRD content is under CC-BY-4.0 (WotC SRD 5.1);
// see src/data/srd-equipment.json.

// Curated provisions — canonical PHB "Food, Drink & Lodging" prices, plus the
// `servings` each unit yields so the Provisions tracker can feed the crew.
export const PROVISIONS = [
  { index: 'rations-1-day', name: 'Rations (1 day)', provision: 'food', servings: 1, cost_gp: 0.5, desc: 'Dry foods suitable for extended travel: jerky, dried fruit, hardtack, and nuts.' },
  { index: 'bread-loaf', name: 'Bread, loaf', provision: 'food', servings: 1, cost_gp: 0.02, desc: 'A crusty loaf.' },
  { index: 'meat-chunk', name: 'Meat, chunk', provision: 'food', servings: 1, cost_gp: 0.3, desc: 'A portion of fresh or cured meat.' },
  { index: 'cheese-hunk', name: 'Cheese, hunk', provision: 'food', servings: 1, cost_gp: 0.1, desc: 'A wedge of hard cheese that keeps well.' },
  { index: 'ale-mug', name: 'Ale, mug', provision: 'drink', servings: 1, cost_gp: 0.04, desc: 'A mug of common ale.' },
  { index: 'ale-gallon', name: 'Ale, keg (gallon)', provision: 'drink', servings: 8, cost_gp: 0.2, desc: 'A gallon keg of ale — about eight mugs.' },
  { index: 'wine-common', name: 'Wine, common (pitcher)', provision: 'drink', servings: 4, cost_gp: 0.2, desc: 'A pitcher of ordinary table wine.' },
  { index: 'wine-fine', name: 'Wine, fine (bottle)', provision: 'drink', servings: 4, cost_gp: 10, desc: 'A bottle of fine vintage.' },
].map((p) => ({ ...p, category: 'Provisions' }))

// Rations exists in the SRD too; keep the provisions version (it carries servings).
const EXCLUDE = new Set(PROVISIONS.map((p) => p.index))

export const CATALOG = [...PROVISIONS, ...srd.filter((i) => !EXCLUDE.has(i.index))]

export const CATEGORIES = ['Provisions', 'Gear', 'Weapons', 'Armor', 'Tools', 'Mounts & Vehicles']

// Fast lookup by SRD/catalog index.
export const CATALOG_BY_INDEX = Object.fromEntries(CATALOG.map((i) => [i.index, i]))
