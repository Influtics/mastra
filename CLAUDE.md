# Mastra (Influtics) — Project Notes

## Deploy contract

- **FQDN:** `mastra.influtics.com`
- **Host:** KZ Coolify, server `influtics`, IP `5.180.47.102`
- **Container port:** `4111`
- **Coolify app name:** `mastra` (verify uuid via Coolify UI after creation)
- **GitHub repo:** `https://github.com/Influtics/mastra`
- **Build pack:** Dockerfile (override Nixpacks auto-detect)
- **Health check path:** `/api/health`

## Required env vars

| Var | Source | Required | Notes |
|-----|--------|----------|-------|
| `ANTHROPIC_API_KEY` | Anthropic console (or compatible proxy token) | yes | read by the Claude Agent SDK subprocess |
| `ANTHROPIC_MODEL` | static | no | defaults to `claude-sonnet-4-5-20251001`. Set to the model id your proxy serves when `ANTHROPIC_BASE_URL` is non-default |
| `ANTHROPIC_BASE_URL` | static | no | override the Claude API endpoint. Read natively by the Claude Agent SDK subprocess. Use this to point at an Anthropic-compatible proxy (e.g. `https://api.example.com/anthropic`). Leave unset to talk to `https://api.anthropic.com` directly |
| `MASTRA_STUDIO_TOKEN` | generated `openssl rand -base64 32` | yes | SimpleAuth bearer token |
| `MASTRA_DB_PATH` | static | no | defaults to `/data/mastra.db` (Coolify `/data` volume) or `.mastra/storage.db` (dev) |
| `NODE_ENV` | static | no | set to `production` by Dockerfile — flips `MASTRA_DB_PATH` default |

The libSQL file at `MASTRA_DB_PATH` survives container restarts because Coolify mounts a persistent volume at `/data`. No external database is involved.

## Custom Anthropic-compatible endpoint (optional)

If you're pointing at a third-party Anthropic-compatible API, set all three:

```bash
ANTHROPIC_API_KEY=<token-issued-by-the-proxy>     # NOT a real Anthropic key
ANTHROPIC_BASE_URL=https://api.example.com/anthropic
ANTHROPIC_MODEL=<model-id-the-proxy-serves>
```

The `claude` CLI subprocess reads `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` directly from `process.env` — `src/mastra/agents/hello-agent.ts` already spreads `...process.env` into the subprocess env, so no code changes are needed when swapping endpoints.

## Persistent volume

Coolify UI → app → "Storages" → add:

| Mount path | Size | Purpose |
|------------|------|---------|
| `/data` | 1 GiB | libSQL file (`mastra.db`) and any future per-tenant state |

## Traefik no-buffer labels

Set in Coolify UI → Labels/Annotations:
```
traefik.http.routers.mastra.middlewares=custom-nobuffer
traefik.http.middlewares.custom-nobuffer.buffering.requestBodyMaxSize=0
traefik.http.middlewares.custom-nobuffer.buffering.responseBodyMaxSize=0
traefik.http.middlewares.custom-nobuffer.buffering.memResponseBodyMaxSize=0
```

## Runbook

```bash
# Restart without rebuild
ssh root@5.180.47.102 'docker restart $(docker ps -q --filter "label=coolify.application=mastra")'

# Container logs
ssh root@5.180.47.102 'docker logs --tail 200 -f $(docker ps -q --filter "label=coolify.application=mastra")'
```

Coolify "Rollback" button redeploys prior image in one click.

## Agent / tool conventions

- All agents live under `src/mastra/agents/`, named `<purpose>-agent.ts` (kebab-case).
- All tools live under `src/mastra/tools/`, named `<verb>.ts`.
- Agents and tools are registered in `src/mastra/index.ts`.
- Schema bootstrap delegates to `mastra.getStorage().init()` — never hand-roll DDL.
- Don't add observability (Loki/Sentry) without an explicit v1.1 scope.

## Future work (not in v1)

- Influtics Supabase integration (tools that query Influtics data)
- CF Access JWT exchange for multi-tenant auth
- Multi-agent workflows / orchestration
- Observability stack (Loki, Sentry, external uptime)
- Periodic backups of `/data/mastra.db` (cron rsync to S3 / similar)
