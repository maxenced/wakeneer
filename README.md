# Wakenerr

Wake-on-LAN web app with real-time status monitoring. Wake your servers from anywhere and get redirected to their services once ready.

## Deploy

### Requirements

- Docker on a machine on the same LAN as your target servers
- An OIDC-compatible identity provider (Google, Microsoft, Keycloak, Authelia, Authentik, etc.)

### Setup

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml`:
- Set a random `sessionSecret`
- Add your OIDC provider(s): each provider needs a `name`, `discoveryUrl`, `clientId`, and `clientSecret`
- Set `callbackBaseUrl` to your public URL (e.g. `https://wake.example.com`)
- Configure authorization per provider: either an `allowedEmails` list or an `allowedClaim` (match users by a specific token claim, e.g. groups)
- Add your services (name, host IP, MAC address, service URL)

The callback URL to register with your identity provider is: `<callbackBaseUrl>/auth/<provider-name>/callback`

### Run

```bash
docker compose up -d --build
```

The container uses `network_mode: host` so WoL broadcast packets reach your LAN. The app listens on port 3000 by default.

### Logging

Set the `LOG_LEVEL` environment variable to control verbosity:

```yaml
environment:
  - LOG_LEVEL=debug  # debug | info | warn | error (default: info)
```

- `info` — logins, wake triggers, service status changes
- `debug` — all of the above + every ping/HTTP check result and WoL packet details

### Reverse proxy

Put it behind nginx/Caddy/Traefik with HTTPS. Example Caddy:

```
wake.example.com {
    reverse_proxy localhost:3000
}
```

## Contribute

### Setup

```bash
git clone <repo-url>
cd wakenerr
npm install
cp config.example.yaml config.yaml  # fill in test values
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Compile TypeScript |

### Project layout

- `src/config.ts` — YAML config loading + Zod validation
- `src/monitor/` — Background status checks (ping + HTTP)
- `src/wol/` — Wake-on-LAN magic packet sender
- `src/auth/` — Generic OIDC authentication + authorization middleware
- `src/routes/` — Express route handlers
- `src/views/` — EJS templates
- `public/` — Static assets (CSS, client JS)
- `tests/` — Vitest test suite

### Adding an OIDC provider

No code changes needed — just add a new entry under `auth.providers` in `config.yaml` with the provider's OIDC discovery URL, client credentials, and authorization rules. Any provider exposing a `.well-known/openid-configuration` endpoint works out of the box.
