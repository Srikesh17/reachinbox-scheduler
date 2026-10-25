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
    <div className="login-screen-wrapper d-flex align-items-center justify-content-center min-vh-100 p-3 bg-light">
      <div className="login-card-container bg-white border rounded-4 p-4 shadow-sm" style={{ maxWidth: 420, width: '100%' }}>
        <h2 className="login-title text-center fw-bold text-dark mb-4">Login</h2>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="google-login-btn btn w-100 d-flex align-items-center justify-content-center gap-2 fw-semibold mb-3 py-2"
        >
          <i className="fa-brands fa-google text-danger fs-5"></i>
          <span>Login with Google</span>
        </button>

        <div className="login-divider d-flex align-items-center text-center text-muted small my-3">
          <span>or sign up through email</span>
        </div>

        <form onSubmit={handleEmailLogin} className="login-form d-flex flex-column gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ID"
            className="login-input form-control py-2"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="login-input form-control py-2"
          />

          <button
            type="submit"
            disabled={loading}
            className="submit-login-btn btn btn-success w-100 fw-semibold py-2 mt-2"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="demo-login-wrapper text-center mt-3">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="demo-login-btn btn btn-link text-success text-decoration-none small"
          >
            One-Click Demo Login (Oliver Brown)
          </button>
        </div>
      </div>
    </div>
  );
}
