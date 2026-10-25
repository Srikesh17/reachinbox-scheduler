import { useState } from 'react';
import type { FormEvent } from 'react';
import { API_BASE, loginDemoUser, loginEmailUser } from '../lib/api.js';
import type { User } from '../types/email.js';

interface LoginCardProps {
  onLoginSuccess: (user: User) => void;
  onError: (msg: string) => void;
}

export function LoginCard({ onLoginSuccess, onError }: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      onError('Please enter an Email ID');
      return;
    }
    setLoading(true);
    try {
      const user = await loginEmailUser(email, password);
      onLoginSuccess(user);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const user = await loginDemoUser();
      onLoginSuccess(user);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        <h1 className="login-title">Login</h1>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="google-login-btn"
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Login with Google</span>
        </button>

        <div className="login-divider">
          <span>or sign up through email</span>
        </div>

        <form onSubmit={handleEmailLogin} className="login-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ID"
            className="login-input"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="login-input"
          />

          <button
            type="submit"
            disabled={loading}
            className="submit-login-btn"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="demo-login-wrapper">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="demo-login-btn"
          >
            One-Click Demo Login (Oliver Brown)
          </button>
        </div>
      </div>
    </div>
  );
}
