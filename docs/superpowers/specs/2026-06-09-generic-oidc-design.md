# Generic OIDC Authentication (Drop Passport)

## Goal

Complete the migration from hardcoded Google/Microsoft Passport strategies to a generic OIDC flow using `openid-client` v5 directly. Any OIDC-compliant provider (Authelia, Keycloak, Google, Microsoft, etc.) should work by specifying a `discoveryUrl` in config.

## Config Schema (already in place)

```yaml
auth:
  providers:
    - name: "authelia"
      discoveryUrl: "https://auth.example.com/.well-known/openid-configuration"
      clientId: "wakeonlan"
      clientSecret: "secret"
      scopes: ["openid", "email", "profile", "groups"]
      authorization:
        allowedEmails: ["user@example.com"]
        # OR
        allowedClaim:
          name: "groups"
          values: ["wakeonlan-users"]
  callbackBaseUrl: "http://localhost:3000"
```

The Zod schema in `src/config.ts` already validates this shape. No config changes needed.

## Architecture

### Provider Discovery at Startup

A new module `src/auth/oidc.ts` handles provider initialization:

1. For each provider in config, call `Issuer.discover(discoveryUrl)` to fetch the OIDC metadata.
2. Create a `Client` instance with the provider's `clientId` and `clientSecret`.
3. Store in a `Map<string, { client: Client, config: ProviderConfig }>` keyed by provider `name`.
4. If any provider fails discovery, log the error and exit the process (fail-fast).

Exported interface:
- `initProviders(providers: ProviderConfig[], callbackBaseUrl: string): Promise<ProviderRegistry>`
- `ProviderRegistry.get(name: string): { client, config } | undefined`

### Auth Flow

1. **GET `/auth/login`** — renders login page listing provider names.
2. **GET `/auth/:provider`** — looks up provider in registry, generates authorization URL with configured scopes + `redirect_uri`, stores `state` and `nonce` in session, redirects.
3. **GET `/auth/:provider/callback`** — validates `state`, exchanges authorization code for token set via `client.callback()`, extracts ID token claims.
4. **Session storage** — `req.session.user = { email, displayName, provider, claims }` where `claims` is the full decoded ID token payload (needed for `allowedClaim` checks).
5. **GET `/auth/logout`** — destroys session, redirects to `/auth/login`.

### Authorization Middleware

`src/auth/middleware.ts` exports:

- `isAuthenticated(req, res, next)` — checks `req.session.user` exists, redirects to login if not.
- `isAllowed(authorization: AuthorizationConfig)` — returns middleware that checks:
  - If `allowedEmails` is configured: user's email must be in the list.
  - If `allowedClaim` is configured: the named claim from `req.session.user.claims` must include at least one of the configured values (array intersection).
  - Either check passing grants access (OR logic).
  - If neither passes: 403 → render `denied` view.

### Session Management

Express session is already used (for Passport serialization). After removing Passport, sessions continue to work the same way — we just write/read `req.session.user` directly instead of going through `passport.serializeUser`.

## Files

| File | Action |
|------|--------|
| `src/auth/passport.ts` | Delete |
| `src/auth/oidc.ts` | Create — provider discovery, authorization URL generation, callback token exchange |
| `src/auth/middleware.ts` | Rewrite — session-based auth check + dual-mode authorization |
| `src/routes/auth.ts` | Rewrite — dynamic `:provider` routes, no passport.authenticate |
| `src/server.ts` | Remove passport references, wire OIDC provider init |
| `src/index.ts` | Call `initProviders()` before starting server |
| `src/views/login.ejs` | Render provider `name` fields instead of hardcoded type strings |
| `package.json` | Remove `passport`, `passport-google-oauth20`, `passport-microsoft`, `@types/passport` |
| `tests/` | Update auth tests for new flow |

## Dependencies

**Remove:**
- `passport`
- `passport-google-oauth20`
- `passport-microsoft` (if still listed)
- `@types/passport`
- `@types/passport-google-oauth20` (if present)

**Keep:**
- `openid-client` ^5.7.1
- `express-session` (already a dep)

## Error Handling

- Provider discovery failure at startup → log error, `process.exit(1)`.
- Unknown provider name in route → 404.
- OIDC callback error (invalid state, token exchange failure) → log warning, redirect to login.
- Missing email claim in ID token → treat as empty string, will fail authorization check.

## Security Considerations

- `state` parameter stored in session and validated on callback to prevent CSRF.
- `nonce` included in authorization request and validated in ID token.
- Session secret already required in config.
- HTTPS enforcement is the deployer's responsibility (reverse proxy).
