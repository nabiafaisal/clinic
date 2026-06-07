import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, Download,
  LogOut, Menu, X, Stethoscope, ChevronRight, Settings
} from 'lucide-react';
import './Layout.css';

// Role-based nav — what each role can see
const NAV_ITEMS = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard',      end: true,  roles: ['superadmin','admin','reception'] },
  { to: '/patients',icon: Users,           label: 'Patients',                   roles: ['superadmin','admin','reception'] },
  { to: '/diary',   icon: BookOpen,        label: 'Visit Diary',                roles: ['superadmin','reception'] },
  { to: '/export',  icon: Download,        label: 'Export Data',                roles: ['superadmin'] },
  { to: '/users',   icon: Settings,        label: 'Manage Users',               roles: ['superadmin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

  return (
    <div className="layout">
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <div className="sidebar__logo"><Stethoscope size={20} /></div>
          <div className="sidebar__clinic">
            <span className="sidebar__clinic-name">Dr. Arshad</span>
            <span className="sidebar__clinic-sub">Mahmood Clinic</span>
          </div>
          <button className="sidebar__close" onClick={() => setOpen(false)}><X size={16} /></button>
        </div>

        <nav className="sidebar__nav">
          {visibleNav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={16} />
              <span>{label}</span>
              <ChevronRight size={12} className="sidebar__arrow" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user?.name || user?.email}</span>
              <span className={`sidebar__role sidebar__role--${user?.role}`}>{user?.role}</span>
            </div>
          </div>
          <button className="sidebar__logout" onClick={handleLogout} title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="topbar__menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
        </header>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  );
}
