import HomeTab from '../components/tabs/HomeTab'
import ShipTab from '../components/tabs/ShipTab'
import CrewTab from '../components/tabs/CrewTab'
import RolesTab from '../components/tabs/RolesTab'
import InventoryTab from '../components/tabs/InventoryTab'
import FundsTab from '../components/tabs/FundsTab'
import MapTab from '../components/tabs/MapTab'
import QuestsTab from '../components/tabs/QuestsTab'
import JournalTab from '../components/tabs/JournalTab'
import RollLogTab from '../components/tabs/RollLogTab'
import DeskTab from '../components/tabs/DeskTab'

// Adding a new section later = add one entry here + one component file.
export const TABS = [
  { key: 'home', label: 'The Helm', icon: '🏴‍☠️', component: HomeTab },
  { key: 'ship', label: 'The Ship', icon: '⚓', component: ShipTab },
  { key: 'crew', label: 'The Crew', icon: '☠', component: CrewTab },
  { key: 'roles', label: 'Crew Roles', icon: '🎖', component: RolesTab },
  { key: 'inventory', label: 'Inventory', icon: '📦', component: InventoryTab },
  { key: 'funds', label: 'Funds & Ledger', icon: '💰', component: FundsTab },
  { key: 'map', label: 'The Map', icon: '🗺', component: MapTab },
  { key: 'quests', label: 'Posterboard', icon: '📜', component: QuestsTab },
  { key: 'journal', label: 'Journal', icon: '📖', component: JournalTab },
  { key: 'rolllog', label: 'Roll Log', icon: '🎲', component: RollLogTab },
  { key: 'desk', label: 'Ruby Tooth’s Desk', icon: '🧭', component: DeskTab },
]
