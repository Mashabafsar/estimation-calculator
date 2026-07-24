import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  Layers,
  LogOut,
  Moon,
  Sun,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/estimates', label: 'Estimates', icon: FileSpreadsheet },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/templates', label: 'Templates', icon: Layers },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-full flex bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <aside className="w-60 shrink-0 border-r border-[var(--color-line)] bg-[var(--color-panel)] flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-accent)] text-white dark:text-teal-950 grid place-items-center">
              <Briefcase size={16} />
            </div>
            <div>
              <div className="font-semibold tracking-tight">Estimation</div>
              <div className="text-[11px] text-[var(--color-muted)]">Profitability OS</div>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]',
                )
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--color-line)] space-y-3">
          <div className="text-xs text-[var(--color-muted)]">
            <div className="font-semibold text-[var(--color-ink)]">
              {user?.firstName} {user?.lastName}
            </div>
            <div>{user?.role.replaceAll('_', ' ')}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={toggle} type="button">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="btn btn-ghost flex-1" onClick={logout} type="button">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
