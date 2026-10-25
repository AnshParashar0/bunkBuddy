import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/discover', label: 'Discover', icon: '🧭' },
  { to: '/bunk', label: 'Bunk', icon: '⚡', main: true },
  { to: '/chats', label: 'Chats', icon: '💬' },
  { to: '/profile', label: 'Profile', icon: '🙂' },
];

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="page">{children}</main>
      <nav className="nav" aria-label="Main">
        {items.map(i => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `nav-item${i.main ? ' nav-main' : ''}${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden>{i.icon}</span>
            <span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
