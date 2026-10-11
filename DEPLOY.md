# Deploying techm-construction (Mazzant Construction PoC) on astrikos.xyz

Follows `deployment_context (1).md` (the authoritative convention). Two processes, one public subdomain each.

> Note: the ports below were chosen explicitly and do **not** follow the odd-pair `33NN`/`43NN` convention
> (3333 / 4333). Add this row to the port registry (section 6 of the guide) before deploying.

## Process table

| Tier | Port | Subdomain | pm2 name | Cloudflare |
| --- | --- | --- | --- | --- |
| Frontend (static SPA, `app/dist`) | **3333** | `techm-construction.astrikos.xyz` | `techm-construction_3333` | Orange (proxied) |
| Backend (REST + websocket `/ws`, one port) | **4333** | `techm-construction-api.astrikos.xyz` | `techm-construction_be_4333` | **Gray** (DNS only) |

Public URLs are served on `:8443` by nginx. Backend listens on `process.env.PORT` (4333) and serves REST **and**
websocket (`/ws`) on that single port.

## Prerequisites

- Node.js 20+
- `npm i -g pm2 serve`
- nginx with wildcard cert at `/etc/certs/astrikos.xyz/` (already in place for other POCs)

## Build and start

```bash
# clone
git clone <repo-url> techm-construction && cd techm-construction

# Frontend: Vite inlines app/.env.production (VITE_API_URL / VITE_SOCKET_URL) at BUILD time
cd app
npm ci && npm run build                                   # -> app/dist
pm2 start serve --name "techm-construction_3333" -- ./dist -s -p 3333
cd ..

# Backend: one runtime dependency (ws)
cd server
npm ci --omit=dev
PORT=4333 pm2 start index.js --name "techm-construction_be_4333"
cd ..

pm2 save
```

(Equivalent single command from the repo root: `pm2 start ecosystem.config.cjs && pm2 save`. It uses pm2's built-in
static server for the frontend, so pick **either** that **or** the two guide-form commands above, not both.)

Update later: `git pull`, `cd app && npm ci && npm run build`, `cd ../server && npm ci --omit=dev`,
`pm2 restart techm-construction_3333 techm-construction_be_4333`.

## nginx

`/etc/nginx/conf/astriverse.conf` needs this **once, at the top of the file** (skip if already there):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

`/etc/nginx/conf/astrikos.conf` - frontend:

```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name techm-construction.astrikos.xyz;
    location / {
        add_header 'Access-Control-Allow-Origin' '*' always;
        proxy_pass http://127.0.0.1:3333;
    }
}
```

`/etc/nginx/conf/astriverse.conf` - backend (ONE block serves REST and websocket):

```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name techm-construction-api.astrikos.xyz;
    location / {
        proxy_pass http://127.0.0.1:4333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }
}
```

Apply: `sudo nginx -t && sudo systemctl reload nginx`

The backend sends `Access-Control-Allow-Origin: *` itself (and answers OPTIONS preflight), so nginx adds no CORS
headers for it - do not add any, or the header gets duplicated.

## Cloudflare DNS

- `techm-construction.astrikos.xyz` -> **Orange** (proxied)
- `techm-construction-api.astrikos.xyz` -> **Gray** (DNS only; it carries websockets)

## Verify

```bash
curl -k https://techm-construction.astrikos.xyz:8443            # SPA HTML
curl -k https://techm-construction-api.astrikos.xyz:8443/       # {"ok":true,"service":"techm-construction-api",...}
curl -k https://techm-construction-api.astrikos.xyz:8443/api/integrations
# websocket (needs: npm i -g wscat)
wscat -n -c wss://techm-construction-api.astrikos.xyz:8443/ws   # first frame: {"type":"hello",...}
pm2 ls        # both processes "online"
```

## Notes on the app

- The frontend uses **hash routing** (`/#/...`), so no SPA-fallback / `try_files` config is needed. `serve -s` is harmless.
- The app works fully if the backend is down: it falls back to its built-in local simulation. The **Integrations**
  tab then shows "API offline".
- On every page load the app calls `POST /api/reset` so a demo always starts from the seed state (work-order ids restart at the seed). If several people use the same deployment at once they will reset each other's tickets - fine for a demo, not for production.
- The hub binds to `127.0.0.1` by default (nginx proxies to it locally). Only set `HOST=0.0.0.0` for a container or LAN demo. It has **no authentication** by design (public demo, simulated in-memory data; CORS is `*` because the SPA is on another origin); mutating routes with a body require `Content-Type: application/json`. Do not put real credentials or client data behind it.
- Everything the hub does is **simulated** (no real ServiceNow/Jira/Maximo/SAP/Teams calls); state is in memory and
  resets on restart or `POST /api/reset`.
- Local dev: `app` runs on 5176 and proxies `/api` and `/ws` to `127.0.0.1:4333` (`app/.env.development` is empty on
  purpose); `run.bat` starts both.

## Troubleshooting

- **Mixed content / blocked request** - the page is https, so the API must be https too. Check `app/.env.production`
  uses `https://...:8443` (not `http://` or a raw port).
- **Changed an env value but nothing changed** - Vite inlines `VITE_*` at build time. Re-run `npm run build` in `app/`
  and restart/redeploy the frontend (`pm2 restart techm-construction_3333`).
- **CORS error** - the backend already allows `*`. If the browser still complains, the request is not reaching it
  (wrong host/port, Cloudflare Orange on the API host, or nginx returning its own error page). Test with the curls above.
- **Websocket will not connect** - the path is `/ws` on the same host/port as the API (`wss://techm-construction-api.astrikos.xyz:8443/ws`).
  Confirm the `map $http_upgrade $connection_upgrade` exists once in `astriverse.conf`, the block has the `Upgrade` /
  `Connection` headers, and the API subdomain is **Gray** in Cloudflare.
- **502 Bad Gateway** - process is down: `pm2 ls`, `pm2 logs techm-construction_be_4333`. Check the port is not taken
  (`ss -ltnp | grep -E '3333|4333'`).
- **Backend on the wrong port** - it reads `PORT` at start; with pm2 set it inline (`PORT=4333 pm2 start ...`) or via
  `ecosystem.config.cjs`. `pm2 restart --update-env` after changing it.
- **Blank page** - confirm `app/dist/index.html` exists (build succeeded) and `pm2 logs techm-construction_3333`.
