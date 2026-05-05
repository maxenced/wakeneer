import { Router } from 'express';
import passport from 'passport';

interface ProviderConfig {
  type: string;
}

export function createAuthRoutes(providers: ProviderConfig[]): Router {
  const router = Router();

  router.get('/login', (req, res) => {
    res.render('login', { providers: providers.map((p) => p.type) });
  });

  router.get('/google', passport.authenticate('google', { scope: ['email', 'profile'] }));
  router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => res.redirect('/'),
  );

  router.get('/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));
  router.get(
    '/microsoft/callback',
    passport.authenticate('microsoft', { failureRedirect: '/auth/login' }),
    (req, res) => res.redirect('/'),
  );

  router.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/auth/login'));
  });

  return router;
}
