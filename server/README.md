# techm-construction-server

Simulated **integration hub** for the Mazzant Construction PoC. It pretends to be the connectors to
ServiceNow, Jira Service Management, IBM Maximo, SAP PM and Teams/Email. **Everything is simulated, in memory** -
no external system is contacted; state resets on restart or `POST /api/reset`.

- Node 20+, one runtime dependency (`ws`), plain `http` module.
- One port for REST **and** websocket (`/ws`). `PORT` env (default `4333`), binds `0.0.0.0`.
- `TICKET_STEP_MS` env (default `2500`) scales the ticket lifecycle: `new -> assigned` after 1x, `-> in_progress` after 2.8x (2.5 s / 7 s by default). Tests use `100`.
- Full CORS (`*`), JSON everywhere, bad JSON -> `400 {error:'invalid_json'}`, unknown route -> `404 {error:'not_found'}`.

```
cd server
npm install --prefix "$PWD"      # (OneDrive tree: always pass --prefix)
npm start                         # PORT=4333 npm start
npm test                          # node --test test/api.test.js
```

## REST

| Method / path | Result |
| --- | --- |
| `GET /`, `GET /api/health` | `{ok, service:'techm-construction-api', version, uptimeSec, ws:'/ws', integrations, tickets}` |
| `GET /api/integrations` | `{integrations:[...]}` |
| `POST /api/integrations/:id/test` | `{ok, latencyMs, message}` (40-180 ms; `ok:false` if disconnected) |
| `POST /api/integrations/:id/connect` \| `/disconnect` | updated integration (ws `integration`) |
| `POST /api/integrations/:id/sync` | `{ok, pulled, pushed}` (touches `lastSyncAt`; `ok:false` if disconnected) |
| `POST /api/integrations/:id/webhook` | body `{ref, status}` -> updates the ticket with that `externalRef`; `{ok:true}` (400 bad input, 404 unknown ref) |
| `GET /api/tickets` | `{tickets:[...]}` newest first (`GET /api/tickets/:id` -> `{ticket}`) |
| `POST /api/tickets` | body `{title, description?, department?, priority?, assetId?, woId?, source?, system?}` -> `201 {ticket}` |
| `PATCH /api/tickets/:id` | body `{status?, assignee?, note?}` -> `{ticket}` |
| `GET /api/logs` | `{logs:[last 100]}` |
| `POST /api/reset` | `{ok:true}` - clears and reseeds |

Integrations (`servicenow`, `jira`, `maximo`, `sap-pm`, `teams`) have
`{id, name, vendor, kind:'ticketing'|'cmms'|'erp'|'chat', status:'connected'|'disconnected'|'error', departments, endpoint, webhookPath, lastSyncAt, latencyMs, ticketsSynced, errorsLast24h}`.
`sap-pm` starts disconnected. `ticketsSynced` is the live count of tickets routed to that system.

Ticket: `{id:'TKT-2001+', woId, title, description, department, priority:'low'|'med'|'high'|'critical', status:'new'|'assigned'|'in_progress'|'resolved', system, externalRef, assignee, assetId, source:'prediction'|'manual'|'cctv'|'schedule'|'alert', createdAt, updatedAt, sla:{dueAt, breached}, timeline:[{at,status,note}]}`.

- `title` is required (400). Unknown `system` -> 400.
- Routing when `system` is omitted: HSE -> `jira`, Plant & Equipment -> `maximo`, Procurement -> `sap-pm`, otherwise `servicenow`. If the routed system is disconnected the ticket falls back to `servicenow` and the timeline says so.
- External refs: `INC#######`, `CON-####`, `WO######`, `4000######`, `MSG-#####`.
- SLA due: critical 4 h, high 8 h, med 24 h, low 72 h. `breached` is computed live (past due and not resolved).
- Lifecycle: `new` -> `assigned` -> `in_progress` automatically; **never auto-resolves** (use PATCH or the webhook).
- Webhook/PATCH `status` also accepts `open`, `closed`, `done`, `completed`, `wip` as aliases.

## WebSocket `ws://host:PORT/ws`

Server -> client JSON messages: `{type:'hello', serverTime}`, `{type:'ticket', ticket}`, `{type:'integration', integration}`,
`{type:'log', log:{at, system, level:'info'|'warn'|'error', text}}`. A client `{type:'ping'}` gets `{type:'pong'}`.
The server pings every 25 s and drops dead clients. Other paths are rejected with 404.
