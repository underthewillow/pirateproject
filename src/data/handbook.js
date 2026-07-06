// The Captain's Handbook — an illustrated, DM-revealable digest of Limithron's
// Guide to Naval Combat (free/public rules; cover art is The Battle of Trafalgar,
// public domain). Art extracted to /public/desk. Each chapter can be revealed to
// the crew individually by a DM (settings.handbook_revealed holds the shown ids).

// A body entry is either a string (paragraph) or { t, d } (a term + its meaning).
export const HANDBOOK = [
  {
    id: 'basics',
    title: 'How Naval Combat Works',
    art: 'battlemap.jpg',
    lead: 'Ship battles play out on a hex grid — each hex is 50 ft, and our ship fills one to three of them.',
    body: [
      `Every round — about six seconds — initiative is re-rolled: each ship rolls a d20 and adds its DEX. Only ships and lone sea-monsters roll; everyone aboard acts on their ship's turn.`,
      { t: 'The Captain', d: `At the top of the round the Captain spends the ship's Action Points to assign what she'll do. On the ship's turn she moves and the crew carry out those orders.` },
      { t: 'Checks', d: `Most actions call for a check (default DC 12). Whoever mans the matching Action Station makes the roll and adds a d4 "Sailing Die" to help.` },
    ],
  },
  {
    id: 'stats',
    title: `Reading the Ship's Stats`,
    art: 'galleon.jpg',
    lead: 'A ship uses the six familiar abilities — but at sea they mean new things.',
    body: [
      { t: 'STR', d: 'The punch of her guns, added to damage.' },
      { t: 'DEX', d: 'How nimbly she handles — initiative and coming about.' },
      { t: 'CON', d: 'How tough her hull is: her hit points.' },
      { t: 'CHA — her "Skill"', d: 'The quality of the crew and their leadership, used for attack rolls and Full Sail.' },
      { t: 'AC & Speed', d: 'AC is how hard she is to hit; Speed is how many 50-ft hexes she covers with a fair wind.' },
      `Damage is scaled down 1:5 against creatures — a blow that would deal 5 to a person deals 1 to a ship.`,
    ],
  },
  {
    id: 'wind',
    title: 'Wind & Points of Sail',
    diagram: 'facing',
    lead: 'Your point of sail is locked in at the start of your turn — mind where the wind sits.',
    body: [
      { t: 'With the Wind', d: 'Full speed — the wind is behind you (hexes 3, 4, 5).' },
      { t: 'Close to the Wind', d: 'Half speed, minimum 1 hex — the wind is off the bow (hexes 2 or 6).' },
      { t: 'In Irons', d: 'Pointed straight into the wind (hex 1) — speed 0, though you may still turn once.' },
      { t: 'Weatherly', d: 'Our ship ignores the Close-to-the-Wind penalty and keeps full speed — a great advantage in a chase.' },
    ],
  },
  {
    id: 'move',
    title: 'Moving the Ship',
    art: 'ship.jpg',
    lead: 'Sails are slow to answer, but a clever heading wins the day.',
    body: [
      `Move up to your Speed straight forward, toward the hex in front of your bow.`,
      `Rotate up to twice — each rotation is one hex-face (60°). You may never turn more than once per hex.`,
      `You must move at least one hex unless you're In Irons or Anchored.`,
    ],
  },
  {
    id: 'arc',
    title: 'Arc of Fire',
    diagram: 'arc',
    lead: 'Most guns sit along the sides — you must maneuver to bring them to bear.',
    body: [
      { t: 'Broadsides (Port & Starboard)', d: 'Your main guns. One Action Point, and each side may fire once per round.' },
      { t: 'Fore & Aft', d: 'The bow and stern guns cost two Action Points and roll one die-rank lower.' },
      `A well-timed turn can rake an enemy with both broadsides across two rounds.`,
    ],
  },
  {
    id: 'weapons',
    title: 'Our Weapons',
    art: 'galleon.jpg',
    lead: 'What we bring to a fight.',
    body: [
      { t: 'Cannons', d: '+2 to hit, 1d8+2 damage. Once per round per side, and a full round to reload.' },
      { t: 'Small Arms (muskets & pistols)', d: '+2 to hit, 1d4+2 damage. Once per round per side, with no reload.' },
      { t: 'Action cost', d: 'A broadside shot costs 1 AP; a Fore or Aft shot costs 2 and rolls one die-rank lower.' },
    ],
  },
  {
    id: 'stations',
    title: 'Action Stations',
    art: 'ship.jpg',
    lead: 'On your turn you may man one station and add a d4 Sailing Die to its check.',
    body: [
      { t: 'Captain', d: `Assigns the ship's actions; may Push the Crew (Intimidation or Persuasion) for +1 Action Point now, at −1 next round.` },
      { t: 'Pilot (Navigator)', d: 'Steers and rolls DEX to Come About for an extra turn, plus any checks to navigate hazards.' },
      { t: 'Lookout', d: `Before initiative, rolls the ship's initiative and may add or subtract their Sailing Die. A ship with a Lookout also gains +1 AC.` },
      { t: 'Bosun (Boatswain)', d: 'Raise Morale: +1 to all attacks & checks this turn, or shake off the Stressed condition.' },
      { t: 'Gunner (Gunmaster)', d: `Fires the guns using the ship's Skill + Sailing Die.` },
      { t: 'Carpenter', d: 'Repairs the hull, recovering HP, using Skill + Sailing Die.' },
      { t: 'Rigger', d: 'Goes Full Sail for +1 hex of movement, using Skill + Sailing Die.' },
    ],
  },
  {
    id: 'ramming',
    title: 'Ramming',
    art: 'battlemap.jpg',
    lead: 'Sometimes the surest gun is the ship herself.',
    body: [
      `At the start of your turn the Captain may declare a ram — it costs all Action Points.`,
      `If you end your movement with a forward face touching another ship, both ships roll their base Hit Die; the rammer adds +1 for every hex it moved this turn.`,
      `The winner deals a critical hit with its primary weapon.`,
    ],
  },
  {
    id: 'hurt',
    title: 'When the Ship is Hurt',
    art: 'ship.jpg',
    lead: 'A wounded ship fights on — but not for long.',
    body: [
      { t: 'Stressed', d: 'Below half HP (or too short-crewed), she rolls all attacks and checks with Disadvantage. The Bosun’s Raise Morale can clear it.' },
      { t: 'Derelict', d: 'At 0 HP she stops dead and can only Repair. Every further hit forces a sinking save (d20, 10+ to stay afloat; a critical hit auto-fails). A successful Repair, rolled at Disadvantage, brings her back with 1 HP.' },
    ],
  },
  {
    id: 'anchor',
    title: 'Anchoring & Boarding',
    art: 'galleon.jpg',
    lead: 'Bringing her to rest — and taking the fight to the enemy’s deck.',
    body: [
      { t: 'Drop Anchor', d: 'All Action Points: speed 0 and anchored.' },
      { t: 'Weigh Anchor', d: 'Back to half speed, no longer anchored.' },
      { t: 'Cut and Run', d: 'Cut the cable — half speed now, but she’ll drift once you stop.' },
      { t: 'Boarding', d: 'Once two ships lock together, switch to foot-combat on a 5-ft grid. That’s where the heroes settle it.' },
    ],
  },
]

// Interactive diagram hotspots (percent coords over the image). Hovering/tapping
// a spot shows its caption.
export const DIAGRAMS = {
  facing: {
    img: 'facing.jpg',
    caption: 'Tap a heading to see how the wind treats it.',
    spots: [
      { x: 50, y: 13, label: '1', text: 'In Irons — bow into the wind. Speed 0, but you may still turn once.' },
      { x: 77, y: 31, label: '2', text: 'Close to the wind — half speed (minimum 1 hex).' },
      { x: 77, y: 69, label: '3', text: 'With the wind — full speed.' },
      { x: 50, y: 88, label: '4', text: 'With the wind — full speed.' },
      { x: 23, y: 69, label: '5', text: 'With the wind — full speed.' },
      { x: 23, y: 31, label: '6', text: 'Close to the wind — half speed (minimum 1 hex).' },
    ],
  },
  arc: {
    img: 'arc.jpg',
    caption: 'Tap an arc to see how those guns fire.',
    spots: [
      { x: 50, y: 22, label: 'Fore', text: 'Fore (bow) guns — 2 Action Points, and roll one die-rank lower.' },
      { x: 19, y: 50, label: 'Port', text: 'Port broadside — your main guns. 1 AP, once per round this side.' },
      { x: 81, y: 50, label: 'Starboard', text: 'Starboard broadside — your main guns. 1 AP, once per round this side.' },
      { x: 50, y: 82, label: 'Aft', text: 'Aft (stern) guns — 2 Action Points, and roll one die-rank lower.' },
    ],
  },
}
