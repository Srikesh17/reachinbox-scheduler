import { useState, useRef, useEffect } from 'react';
import type { User } from '../types/email.js';

interface SidebarProps {
  user: User;
  currentTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onLogout: () => void;
  scheduledCount: number;
  sentCount: number;
}

export function Sidebar({
  user,
  currentTab,
  onTabChange,
  onOpenCompose,
  onLogout,
  scheduledCount,
  sentCount,
}: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className="app-sidebar border-end bg-white d-flex flex-column p-3">
      <div className="sidebar-brand-row mb-3 px-1">
        <span className="brand-logo-text fw-bold fs-4 text-dark">Inbox</span>
      </div>

      <div className="sidebar-profile-box position-relative mb-3" ref={menuRef}>
        <div
          className="profile-info-row d-flex align-items-center gap-2 p-2 rounded cursor-pointer"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <img
            src={
              user.picture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                user.name
              )}&background=00a854&color=fff`
            }
            alt={user.name}
            className="profile-avatar-img rounded-circle"
            width={36}
            height={36}
          />
          <div className="profile-text-group d-flex flex-column overflow-hidden flex-grow-1">
            <span className="profile-name-text fw-semibold small text-dark text-truncate">
              {user.name}
            </span>
            <span className="profile-email-text text-muted text-truncate" style={{ fontSize: '11px' }}>
              {user.email}
            </span>
          </div>
          <i className="fa-solid fa-chevron-down text-muted small"></i>
        </div>

        {menuOpen && (
          <div className="profile-dropdown-menu position-absolute bg-white border rounded shadow-sm p-1 z-3 w-100">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="logout-action-btn w-100 d-flex align-items-center gap-2 p-2 text-danger border-0 bg-transparent rounded small"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      <div className="compose-btn-row mb-4">
        <button
          type="button"
          onClick={onOpenCompose}
          className="sidebar-compose-pill-btn w-100 d-flex align-items-center justify-content-center gap-2 rounded-pill fw-semibold"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Compose</span>
        </button>
      </div>

      <div className="sidebar-nav-section d-flex flex-column gap-1">
        <div className="nav-section-title text-muted text-uppercase fw-bold px-2" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
          CORE
        </div>

        <nav className="nav-items-list d-flex flex-column gap-1 mt-1">
          <button
            type="button"
            onClick={() => onTabChange('scheduled')}
            className={`nav-tab-item d-flex align-items-center justify-content-between p-2 rounded-pill border-0 ${
              currentTab === 'scheduled' ? 'active-nav-tab' : 'bg-transparent text-secondary'
            }`}
          >
            <div className="nav-tab-left d-flex align-items-center gap-2">
              <i className="fa-regular fa-clock"></i>
              <span className="small">Scheduled</span>
            </div>
            <span className="nav-tab-badge badge rounded-pill text-dark">{scheduledCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('sent')}
            className={`nav-tab-item d-flex align-items-center justify-content-between p-2 rounded-pill border-0 ${
              currentTab === 'sent' ? 'active-nav-tab' : 'bg-transparent text-secondary'
            }`}
          >
            <div className="nav-tab-left d-flex align-items-center gap-2">
              <i className="fa-solid fa-paper-plane"></i>
              <span className="small">Sent</span>
            </div>
            <span className="nav-tab-badge badge rounded-pill text-dark">{sentCount}</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
