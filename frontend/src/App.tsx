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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [currentTab, setCurrentTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [activeView, setActiveView] = useState<'list' | 'compose' | 'detail'>('list');

  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [stats, setStats] = useState<EmailStats>({ scheduled: 0, sent: 0, failed: 0 });

  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch {}
      } else {
        const cached = localStorage.getItem('reachinbox_user');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {}
        }
      }
    }

    fetchCurrentUser()
      .then((currUser) => {
        if (currUser) {
          setUser(currUser);
          localStorage.setItem('reachinbox_user', JSON.stringify(currUser));
        } else {
          const cached = localStorage.getItem('reachinbox_user');
          if (!cached) {
            setUser(null);
          }
        }
      })
      .catch(() => {
        const cached = localStorage.getItem('reachinbox_user');
        if (!cached) {
          setUser(null);
        }
      })
      .finally(() => {
        setAuthChecking(false);
      });
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
  };

  const handleScheduledSuccess = (count: number) => {
    setToastMessage(`Successfully scheduled ${count} email(s)!`);
    setTimeout(() => setToastMessage(null), 5000);
    setActiveView('list');
    setCurrentTab('scheduled');
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
        }}
        onOpenCompose={() => {
          setActiveView('compose');
          setSelectedEmail(null);
        }}
        onLogout={handleLogout}
        scheduledCount={stats.scheduled}
        sentCount={stats.sent}
      />

      <main className="dashboard-main-content">
        {activeView === 'compose' ? (
          <ComposeModal
            currentUser={user}
            onClose={() => setActiveView('list')}
            onScheduled={handleScheduledSuccess}
            onError={(msg) => setErrorMessage(msg)}
          />
        ) : activeView === 'detail' && selectedEmail ? (
          <EmailDetailModal
            email={selectedEmail}
            onBack={() => {
              setActiveView('list');
              setSelectedEmail(null);
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
              }}
              onComposeClick={() => setActiveView('compose')}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
