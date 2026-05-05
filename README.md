# Wakenerr

Wake-on-LAN web app with real-time status monitoring. Wake your servers from anywhere and get redirected to their services once ready.

## Deploy

### Requirements

- Docker on a machine on the same LAN as your target servers
- A Google and/or Microsoft OAuth app for authentication

### Setup

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml`:
- Set a random `sessionSecret`
- Add your OAuth provider credentials (Google: [console.cloud.google.com](https://console.cloud.google.com/apis/credentials), Microsoft: [portal.azure.com](https://portal.azure.com))
- Set `callbackBaseUrl` to your public URL (e.g. `https://wake.example.com`)
- Add allowed user emails
- Add your services (name, host IP, MAC address, service URL)

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
- `src/auth/` — Passport.js OAuth + email allowlist middleware
- `src/routes/` — Express route handlers
- `src/views/` — EJS templates
- `public/` — Static assets (CSS, client JS)
- `tests/` — Vitest test suite

### Adding an OAuth provider

1. Install the Passport strategy: `npm install passport-<provider>`
2. Add a case in `src/auth/passport.ts`
3. Add routes in `src/routes/auth.ts`
4. Add the provider config shape to the example config
