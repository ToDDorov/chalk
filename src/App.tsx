import { NavLink, Route, Routes } from 'react-router-dom';
import WeekScreen from './screens/WeekScreen';
import WorkoutScreen from './screens/WorkoutScreen';
import HistoryScreen from './screens/HistoryScreen';
import PlanScreen from './screens/PlanScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

const TABS = [
  { to: '/', label: 'Week', icon: 'M4 6h16M4 6v13h16V6M8 3v4M16 3v4M4 11h16' },
  { to: '/history', label: 'History', icon: 'M5 6h14M5 12h14M5 18h9' },
  { to: '/progress', label: 'Progress', icon: 'M4 19h16M6 15l4-5 3 3 5-7' },
  { to: '/plan', label: 'Plan', icon: 'M7 4h10v16H7zM10 9h4M10 13h4' },
  { to: '/settings', label: 'Settings', icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4' },
];

export default function App() {
  return (
    <div className="app">
      <main className="screen">
        <Routes>
          <Route path="/" element={<WeekScreen />} />
          <Route path="/workout/:id" element={<WorkoutScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
