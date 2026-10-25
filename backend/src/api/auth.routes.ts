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

function resolveFrontendOrigin(inputUrl?: string | null): string {
  if (!inputUrl) {
    return config.frontendUrl;
  }
  try {
    const parsed = new URL(inputUrl);
    if (parsed.hostname.includes('vercel.app')) {
      return parsed.origin;
    }
    if (!config.isProduction && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return parsed.origin;
    }
  } catch {}
  return config.frontendUrl;
}

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

  const rawRedirect =
    (typeof req.query.redirect_to === 'string' && req.query.redirect_to) ||
    req.headers.referer ||
    config.frontendUrl;

  const returnTo = resolveFrontendOrigin(rawRedirect);
  const statePayload = {
    nonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
    returnTo,
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
  req.session.oauthState = state;

  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  res.redirect(authUrl);
});

authRouter.get(['/google/callback', '/callback'], async (req: Request, res: Response) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    if (typeof code !== 'string') {
      res.status(400).send('Invalid OAuth callback request. Missing authorization code.');
      return;
    }

    let returnTo = config.frontendUrl;
    if (typeof state === 'string') {
      try {
        const decoded = Buffer.from(state, 'base64url').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed?.returnTo) {
          returnTo = resolveFrontendOrigin(parsed.returnTo);
        }
      } catch {}
    }

    if (config.isProduction && (returnTo.includes('localhost') || returnTo.includes('127.0.0.1'))) {
      returnTo = 'https://reachinbox-scheduler-theta-nine.vercel.app';
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

    const userPayload: UserSession = {
      id: payload.sub,
      name: payload.name || payload.email,
      email: payload.email,
      picture: payload.picture || '',
    };

    req.session.user = userPayload;
    delete req.session.oauthState;

    const token = Buffer.from(JSON.stringify(userPayload)).toString('base64url');

    req.session.save((err) => {
      if (err) {
        res.status(500).send('Session persistence error');
        return;
      }
      const targetUrl = new URL(returnTo);
      targetUrl.pathname = '/dashboard';
      targetUrl.searchParams.set('auth_data', token);
      res.redirect(targetUrl.toString());
    });
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    let errorReturnTo = config.frontendUrl;
    if (typeof req.query.state === 'string') {
      try {
        const decoded = Buffer.from(req.query.state, 'base64url').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed?.returnTo) {
          errorReturnTo = resolveFrontendOrigin(parsed.returnTo);
        }
      } catch {}
    }
    if (config.isProduction && (errorReturnTo.includes('localhost') || errorReturnTo.includes('127.0.0.1'))) {
      errorReturnTo = 'https://reachinbox-scheduler-theta-nine.vercel.app';
    }
    const targetUrl = new URL(errorReturnTo);
    targetUrl.pathname = '/login';
    targetUrl.searchParams.set('error', 'oauth_failed');
    res.redirect(targetUrl.toString());
  }
});

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email ID is required.' });
    return;
  }

  const namePart = email.split('@')[0] || 'User';
  const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  const userPayload: UserSession = {
    id: `usr_${Date.now()}`,
    name: displayName,
    email: email.trim().toLowerCase(),
    picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a854&color=fff`,
  };

  req.session.user = userPayload;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: 'Could not create session' });
      return;
    }
    const token = Buffer.from(JSON.stringify(userPayload)).toString('base64url');
    res.json({ user: req.session.user, token });
  });
});

authRouter.get('/me', (req: Request, res: Response) => {
  if (req.session?.user) {
    const token = Buffer.from(JSON.stringify(req.session.user)).toString('base64url');
    res.json({ user: req.session.user, token });
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const json = Buffer.from(token, 'base64url').toString('utf-8');
      const user = JSON.parse(json);
      if (user && user.email) {
        res.json({ user, token });
        return;
      }
    } catch {}
  }

  res.json({ user: null });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.clearCookie('reachinbox.sid');
    res.status(204).end();
  });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.user) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const json = Buffer.from(token, 'base64url').toString('utf-8');
      const user = JSON.parse(json);
      if (user && user.email) {
        req.session = (req.session || {}) as typeof req.session;
        req.session.user = user;
        return next();
      }
    } catch {}
  }

  res.status(401).json({ error: 'Authentication required' });
}
