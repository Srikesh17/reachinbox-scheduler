import { useState, useRef, useEffect } from 'react';
import { Clock, Send, ChevronDown, Plus, LogOut } from 'lucide-react';
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
    <aside className="app-sidebar">
      <div className="sidebar-brand-row">
        <span className="brand-logo-text">QNB</span>
      </div>

      <div className="sidebar-profile-box" ref={menuRef}>
        <div
          className="profile-info-row"
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
            className="profile-avatar-img"
          />
          <div className="profile-text-group">
            <span className="profile-name-text">{user.name}</span>
            <span className="profile-email-text">{user.email}</span>
          </div>
          <ChevronDown size={16} className="profile-chevron-icon" />
        </div>

        {menuOpen && (
          <div className="profile-dropdown-menu">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="logout-action-btn"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      <div className="compose-btn-row">
        <button
          type="button"
          onClick={onOpenCompose}
          className="sidebar-compose-pill-btn"
        >
          <Plus size={16} />
          <span>Compose</span>
        </button>
      </div>

      <div className="sidebar-nav-section">
        <div className="nav-section-title">CORE</div>

        <nav className="nav-items-list">
          <button
            type="button"
            onClick={() => onTabChange('scheduled')}
            className={`nav-tab-item ${
              currentTab === 'scheduled' ? 'active-nav-tab' : ''
            }`}
          >
            <div className="nav-tab-left">
              <Clock size={17} />
              <span>Scheduled</span>
            </div>
            <span className="nav-tab-badge">{scheduledCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('sent')}
            className={`nav-tab-item ${
              currentTab === 'sent' ? 'active-nav-tab' : ''
            }`}
          >
            <div className="nav-tab-left">
              <Send size={17} />
              <span>Sent</span>
            </div>
            <span className="nav-tab-badge">{sentCount}</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
