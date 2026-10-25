import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  picture: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: UserSession;
    oauthState?: string;
  }
}

export const authRouter = Router();

const oauthClient = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  config.googleCallbackUrl
);

authRouter.get('/google', (req: Request, res: Response) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    res.status(503).json({
      error: 'Google OAuth credentials are not configured in backend .env',
    });
    return;
  }

  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  req.session.oauthState = state;

  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  res.redirect(authUrl);
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      state !== req.session.oauthState
    ) {
      res.status(400).send('Invalid OAuth callback request. Please try logging in again.');
      return;
    }

    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.id_token) {
      throw new Error('Google did not return an id_token');
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new Error('Google account email is missing');
    }

    req.session.user = {
      id: payload.sub,
      name: payload.name || payload.email,
      email: payload.email,
      picture: payload.picture || '',
    };
    delete req.session.oauthState;

    req.session.save((err) => {
      if (err) {
        res.status(500).send('Session persistence error');
        return;
      }
      res.redirect(config.frontendUrl);
    });
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    res.redirect(`${config.frontendUrl}?error=oauth_failed`);
  }
});

authRouter.post('/demo', (req: Request, res: Response) => {
  req.session.user = {
    id: 'usr_oliver_brown',
    name: 'Oliver Brown',
    email: 'oliver.brown@domain.io',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  };

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: 'Could not create demo session' });
      return;
    }
    res.json({ user: req.session.user });
  });
});

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email ID is required.' });
    return;
  }

  const namePart = email.split('@')[0] || 'User';
  const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  req.session.user = {
    id: `usr_${Date.now()}`,
    name: displayName,
    email: email.trim().toLowerCase(),
    picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a854&color=fff`,
  };

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: 'Could not create session' });
      return;
    }
    res.json({ user: req.session.user });
  });
});

authRouter.get('/me', (req: Request, res: Response) => {
  res.json({ user: req.session.user || null });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
