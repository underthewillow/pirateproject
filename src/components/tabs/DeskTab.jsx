import { useState } from 'react'
import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'

// Player-facing sailing & naval-combat rules distilled from Limithron's Guide
// to Naval Combat (DM-only material left out).
const LESSONS = [
  {
    t: 'How Ship Combat Works',
    c: [
      'Naval combat plays out on a hex grid — each hex is 50 ft, and our Schooner takes up one to three hexes.',
      'Every round (about 6 seconds) initiative is re-rolled: each ship rolls a d20 and adds its DEX. Only ships (and lone sea monsters) roll — everyone aboard acts on the ship’s turn.',
      'At the top of the round the Captain spends the ship’s Action Points to assign what it will do. On the ship’s turn it moves and the crew carry those orders out.',
      'Most ship actions call for a check (default DC 12). Whoever mans the matching Action Station makes the roll and adds a d4 "Sailing Die" to help.',
    ],
  },
  {
    t: 'Reading the Ship’s Stats',
    c: [
      'STR — the punch of her guns (added to damage). DEX — how nimbly she handles (initiative & coming about). CON — how tough her hull is (hit points).',
      'CHA is her "Skill" — the quality of the crew and their leadership (used for attack rolls and Full Sail). AC is how hard she is to hit; Speed is how many 50-ft hexes she covers in a turn with fair wind.',
      'Damage is scaled down 1:5 versus normal creatures — a hit that would deal 5 to a person deals 1 to a ship.',
    ],
  },
  {
    t: 'Wind & Points of Sail',
    c: [
      'Your point of sail is locked in at the start of your turn:',
      'With the Wind — full speed. Close to the Wind — half speed (minimum 1 hex). In Irons (pointed straight into the wind) — speed 0, though you may still turn once.',
      'Weatherly: The Salty Regret ignores the Close-to-the-Wind penalty and keeps her full speed — our great advantage in a chase.',
    ],
  },
  {
    t: 'Moving the Ship',
    c: [
      'Move up to your Speed straight forward, and rotate up to twice — each rotation is one hex-face (60°). You may never turn more than once per hex, and you must move at least 1 hex unless In Irons or Anchored.',
    ],
  },
  {
    t: 'Arc of Fire',
    c: [
      'Guns are grouped by side: Fore (bow), Broadside Port, Broadside Starboard, and Aft (stern). Most cannons sit along the sides, so you must maneuver to bring a broadside to bear.',
      'You may fire each side once per round — so a well-timed turn can rake an enemy with both broadsides across two rounds.',
    ],
  },
  {
    t: 'Our Weapons',
    c: [
      'Cannons — +2 to hit, 1d8+2 damage. Once per round per side, and they take 1 full round to reload.',
      'Small Arms (muskets & pistols) — +2 to hit, 1d4+2 damage. Once per round per side, with no reload.',
      'A Broadside shot costs 1 Action Point. A Fore or Aft shot costs 2 and rolls one die-rank lower.',
    ],
  },
  {
    t: 'Action Stations (your jobs in a fight)',
    c: [
      'On your turn you may take one Action Station and add a d4 Sailing Die to its check:',
      'Captain — assigns the ship’s actions; may Push the Crew (Intimidation/Persuasion) for +1 Action Point now, at the cost of −1 next round.',
      'Pilot (our Navigator) — steers and rolls DEX to Come About (an extra turn), plus any checks to navigate hazards.',
      'Lookout — before initiative, rolls the ship’s initiative and may add or subtract their Sailing Die; a ship with a Lookout also gains +1 AC.',
      'Bosun (our Boatswain) — Raise Morale: either +1 to all the ship’s attacks & checks this turn, or shake off the Stressed condition.',
      'Gunner (our Gunmaster) — fires the guns using the ship’s Skill + Sailing Die.',
      'Carpenter — Repairs the hull (recover HP) using Skill + Sailing Die.',
      'Rigger — goes Full Sail for +1 hex of movement, using Skill + Sailing Die.',
    ],
  },
  {
    t: 'Ramming',
    c: [
      'At the start of your turn the Captain may declare a ram (it costs all Action Points). If you end your movement with a forward face touching another ship, both ships roll their base Hit Die; the rammer adds +1 for every hex it moved this turn. The winner deals a critical hit with its primary weapon.',
    ],
  },
  {
    t: 'When the Ship is Hurt',
    c: [
      'Stressed — below half HP (or too short-crewed), the ship rolls all attacks and checks with Disadvantage. The Bosun’s Raise Morale can clear it.',
      'Derelict — at 0 HP she stops dead (speed 0) and can only Repair. Every further hit forces a sinking save (d20, 10+ to stay afloat; a critical hit auto-fails). A successful Repair (rolled at Disadvantage) brings her back with 1 HP.',
    ],
  },
  {
    t: 'Anchoring & Boarding',
    c: [
      'Drop Anchor (all Action Points): speed 0 and anchored. Weigh Anchor: back to half speed, no longer anchored. Cut and Run: cut the cable free — half speed now, but she’ll drift once you stop.',
      'Boarding — once two ships lock together, we switch to normal foot-combat on a 5-ft grid. That’s where the heroes settle it.',
    ],
  },
]

export default function DeskTab() {
  const { settings, setSetting, canEdit } = useData()
  const [open, setOpen] = useState(() => new Set())
  const toggle = (i) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  return (
    <div>
      <h2 className="section-title">Captain Ruby Tooth's Desk</h2>
      <p className="muted" style={{ marginTop: 0 }}>The log and the lessons — everything a hand needs to sail and fight the ship.</p>

      <div className="sb-section-title">Sailing Log</div>
      <div className="card journal-body" style={{ whiteSpace: 'pre-wrap' }}>
        <Editable
          as="div"
          multiline
          placeholder="Record the voyage — headings, weather, ports, and hard-won lessons…"
          value={settings?.sailing_log || ''}
          onCommit={(v) => setSetting('sailing_log', v)}
        />
      </div>
      {!canEdit && <p className="muted" style={{ fontSize: 13 }}>Unlock editing (top of the page) to add to the log.</p>}

      <div className="sb-section-title" style={{ marginTop: 22 }}>Lessons — Sailing &amp; Naval Combat</div>
      <div className="list">
        {LESSONS.map((l, i) => {
          const isOpen = open.has(i)
          return (
            <div className="card" key={i}>
              <button className="row-between sb-click" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }} onClick={() => toggle(i)}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{l.t}</strong>
                <span className="muted">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div style={{ marginTop: 8 }}>
                  {l.c.map((p, j) => <p key={j} style={{ margin: '0 0 8px' }}>{p}</p>)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
