import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchCurrentUser,
  logoutUser,
  fetchScheduledEmails,
  fetchSentEmails,
  fetchEmailStats,
} from './lib/api.js';
import type { User, EmailItem, EmailStats } from './types/email.js';
import { LoginCard } from './components/LoginCard.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { EmailTable } from './components/EmailTable.js';
import { ComposeModal } from './components/ComposeModal.js';
import { EmailDetailModal } from './components/EmailDetailModal.js';

function getInitialTab(): 'scheduled' | 'sent' {
  if (typeof window !== 'undefined' && window.location.pathname.includes('/sent')) {
    return 'sent';
  }
  return 'scheduled';
}

function getInitialView(): 'list' | 'compose' | 'detail' {
  if (typeof window !== 'undefined') {
    if (window.location.pathname.includes('/compose')) return 'compose';
    if (window.location.pathname.includes('/email/')) return 'detail';
  }
  return 'list';
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [currentTab, setCurrentTab] = useState<'scheduled' | 'sent'>(getInitialTab);
  const [activeView, setActiveView] = useState<'list' | 'compose' | 'detail'>(getInitialView);

  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [stats, setStats] = useState<EmailStats>({ scheduled: 0, sent: 0, failed: 0 });

  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateRoute = useCallback((path: string, replace = false) => {
    if (typeof window !== 'undefined') {
      if (replace) {
        window.history.replaceState({}, '', path);
      } else if (window.location.pathname !== path) {
        window.history.pushState({}, '', path);
      }
    }
  }, []);

  const loadAllEmails = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const [scheduledList, sentList, statsData] = await Promise.all([
        fetchScheduledEmails(),
        fetchSentEmails(),
        fetchEmailStats(),
      ]);

      setScheduledEmails(scheduledList);
      setSentEmails(sentList);
      setStats(statsData);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to fetch email data'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const authData = urlParams.get('auth_data');
      if (authData) {
        try {
          const raw = atob(authData.replace(/-/g, '+').replace(/_/g, '/'));
          const parsed = JSON.parse(raw);
          if (parsed && parsed.email) {
            localStorage.setItem('reachinbox_user', JSON.stringify(parsed));
            localStorage.setItem('reachinbox_token', authData);
            setUser(parsed);
            updateRoute('/dashboard', true);
          }
        } catch {}
      } else {
        const cached = localStorage.getItem('reachinbox_user');
        if (cached) {
          try {
            const parsedUser = JSON.parse(cached);
            setUser(parsedUser);
            if (window.location.pathname === '/' || window.location.pathname === '/login') {
              updateRoute('/dashboard', true);
            }
          } catch {}
        }
      }
    }

    fetchCurrentUser()
      .then((currUser) => {
        if (currUser) {
          setUser(currUser);
          localStorage.setItem('reachinbox_user', JSON.stringify(currUser));
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            updateRoute('/dashboard', true);
          }
        } else {
          const cached = localStorage.getItem('reachinbox_user');
          if (!cached) {
            setUser(null);
            updateRoute('/login', true);
          }
        }
      })
      .catch(() => {
        const cached = localStorage.getItem('reachinbox_user');
        if (!cached) {
          setUser(null);
          updateRoute('/login', true);
        }
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, [updateRoute]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login') {
        return;
      }
      if (path.includes('/compose')) {
        setActiveView('compose');
        setSelectedEmail(null);
      } else if (path.includes('/sent')) {
        setActiveView('list');
        setCurrentTab('sent');
        setSelectedEmail(null);
      } else if (path.includes('/email/')) {
        setActiveView('detail');
      } else {
        setActiveView('list');
        setCurrentTab('scheduled');
        setSelectedEmail(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (user) {
      void loadAllEmails();
    }
  }, [user, loadAllEmails]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {}
    localStorage.removeItem('reachinbox_user');
    localStorage.removeItem('reachinbox_token');
    setUser(null);
    setSelectedEmail(null);
    setActiveView('list');
    updateRoute('/login');
  };

  const handleScheduledSuccess = (count: number) => {
    setToastMessage(`Successfully scheduled ${count} email(s)!`);
    setTimeout(() => setToastMessage(null), 5000);
    setActiveView('list');
    setCurrentTab('scheduled');
    updateRoute('/dashboard/scheduled');
    void loadAllEmails();
  };

  const currentList = currentTab === 'scheduled' ? scheduledEmails : sentEmails;

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) {
      return currentList;
    }
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (em) =>
        em.recipient.toLowerCase().includes(q) ||
        em.subject.toLowerCase().includes(q) ||
        em.body.toLowerCase().includes(q)
    );
  }, [currentList, searchQuery]);

  if (authChecking) {
    return (
      <div className="center-full-screen-loader">
        <div className="loading-spinner-ring" />
        <span className="splash-loading-text">Loading ReachInbox...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-root-layout">
        {errorMessage && (
          <div className="app-toast-alert error-toast">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="toast-close-btn"
            >
              ×
            </button>
          </div>
        )}
        <LoginCard
          onLoginSuccess={(loggedUser) => {
            setUser(loggedUser);
            setErrorMessage(null);
            updateRoute('/dashboard');
          }}
          onError={(msg) => setErrorMessage(msg)}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-shell-layout">
      {toastMessage && (
        <div className="app-toast-alert success-toast">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="toast-close-btn"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="app-toast-alert error-toast">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="toast-close-btn"
          >
            ×
          </button>
        </div>
      )}

      <Sidebar
        user={user}
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setActiveView('list');
          setSelectedEmail(null);
          updateRoute(tab === 'sent' ? '/dashboard/sent' : '/dashboard/scheduled');
        }}
        onOpenCompose={() => {
          setActiveView('compose');
          setSelectedEmail(null);
          updateRoute('/dashboard/compose');
        }}
        onLogout={handleLogout}
        scheduledCount={stats.scheduled}
        sentCount={stats.sent}
      />

      <main className="dashboard-main-content">
        {activeView === 'compose' ? (
          <ComposeModal
            currentUser={user}
            onClose={() => {
              setActiveView('list');
              updateRoute(currentTab === 'sent' ? '/dashboard/sent' : '/dashboard/scheduled');
            }}
            onScheduled={handleScheduledSuccess}
            onError={(msg) => setErrorMessage(msg)}
          />
        ) : activeView === 'detail' && selectedEmail ? (
          <EmailDetailModal
            email={selectedEmail}
            onBack={() => {
              setActiveView('list');
              setSelectedEmail(null);
              updateRoute(currentTab === 'sent' ? '/dashboard/sent' : '/dashboard/scheduled');
            }}
          />
        ) : (
          <div className="dashboard-inbox-view">
            <Header
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={() => void loadAllEmails(true)}
              isRefreshing={isRefreshing}
            />

            <EmailTable
              currentTab={currentTab}
              emails={filteredEmails}
              isLoading={isLoading}
              onSelectEmail={(email) => {
                setSelectedEmail(email);
                setActiveView('detail');
                updateRoute(`/dashboard/email/${email.id}`);
              }}
              onComposeClick={() => {
                setActiveView('compose');
                updateRoute('/dashboard/compose');
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
