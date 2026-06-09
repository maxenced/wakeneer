import { Router } from 'express';
import { generators } from 'openid-client';
import { logger } from '../logger.js';
import type { ProviderRegistry } from '../auth/oidc.js';

export function createAuthRoutes(registry: ProviderRegistry): Router {
  const router = Router();

  router.get('/login', (_req, res) => {
    const providers = Array.from(registry.keys());
    res.render('login', { providers });
  });

  router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/auth/login'));
  });

  router.get('/:provider', (req, res) => {
    const entry = registry.get(req.params.provider);
    if (!entry) {
      res.status(404).send('Unknown provider');
      return;
    }

    const state = generators.state();
    const nonce = generators.nonce();
    req.session.oidcState = state;
    req.session.oidcNonce = nonce;

    const authUrl = entry.client.authorizationUrl({
      scope: entry.config.scopes.join(' '),
      state,
      nonce,
    });

    res.redirect(authUrl);
  });

  router.get('/:provider/callback', async (req, res) => {
    const entry = registry.get(req.params.provider);
    if (!entry) {
      res.status(404).send('Unknown provider');
      return;
    }

    try {
      const params = entry.client.callbackParams(req);
      const tokenSet = await entry.client.callback(
        `${req.protocol}://${req.get('host')}/auth/${req.params.provider}/callback`,
        params,
        { state: req.session.oidcState, nonce: req.session.oidcNonce },
      );

      const claims = tokenSet.claims();
      req.session.user = {
        email: (claims.email as string) ?? '',
        displayName: (claims.name as string) ?? (claims.preferred_username as string) ?? '',
        provider: req.params.provider,
        claims: claims as Record<string, unknown>,
      };
      delete req.session.oidcState;
      delete req.session.oidcNonce;

      logger.info('User logged in', { email: req.session.user.email, provider: req.params.provider });
      res.redirect('/');
    } catch (err) {
      logger.warn('OIDC callback failed', { provider: req.params.provider, error: (err as Error).message });
      res.redirect('/auth/login');
    }
  });

  return router;
}
