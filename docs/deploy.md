# Deploying to production

Agenda runs on a single VPS with Docker Compose. A small server is enough to start: 1–2 vCPU, 2 GB RAM, Ubuntu 24.04 (Hetzner, DigitalOcean, Contabo…).

```
Internet ──443──▶ caddy (HTTPS, automatic certificates)
                    │
                    ▼
                  app (Next.js, image from GHCR) ◀── cron (every 15 min: cuotas + reminders)
                    │
                    ▼
                  postgres (volume) ◀── backup (nightly pg_dump, 14 days)

migrate: runs once before every start; the app only starts if it succeeds.
```

Everything lives in [`deploy/`](../deploy):

| File | What it is |
| --- | --- |
| `docker-compose.prod.yml` | The whole stack |
| `Caddyfile` | HTTPS reverse proxy |
| `.env.production.example` | Every setting, with notes |
| `deploy.sh` | Pull, migrate, start, health check (also used for rollbacks) |
| `restore.sh` | Restore a backup (destructive, asks for confirmation) |

## 1. How the image is built

GitHub Actions (`.github/workflows/ci.yml`):

- **Every push and PR:** lint, typecheck, unit + integration tests, Playwright e2e against a real Postgres.
- **Push to `main` with green tests:** builds the `Dockerfile` and publishes the image:
  - `ghcr.io/iv4nduartexl/gestion-de-cuotas-y-reservaciones:latest`
  - `…:sha-<commit>` (use this to pin or roll back)

Nothing is deployed automatically: you decide when to update the server.

The image:

- is a Next.js `standalone` server running as the non-root `node` user
- has a health check on `/api/health`
- includes `scripts/migrate.mjs`
- reads every setting at runtime, so one image works for any domain
  - The build uses placeholder values only to pass env validation; they never end up in the output.
- has `DEPLOYMENT=production` baked in, which turns on the strict checks in `lib/env.ts`: SMTP required, rate limits on, https URL, no fake payment provider. A misconfigured server refuses to start and prints what's wrong.

## 2. Prepare the server (once)

```bash
# As root on a fresh Ubuntu 24.04
adduser deploy && usermod -aG sudo deploy
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw allow 443/udp && ufw enable
apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

Then:

1. **DNS:** create an `A` record `agenda.tudominio.com → <server IP>`, and wait until it resolves. Caddy needs it to get the certificate.
2. **Registry access** (only while the GitHub package is private): create a GitHub token with `read:packages`, then on the server run:
   ```bash
   echo <token> | docker login ghcr.io -u <github-user> --password-stdin
   ```
   Alternatively, make the package public in GitHub → Packages.

## 3. Email (required)

Account verification, password reset and reminders are sent by SMTP. Any provider works:

| Provider | Notes |
| --- | --- |
| Brevo | Free up to 300 emails/day. `smtp-relay.brevo.com:587` |
| Zoho Mail | Cheap mailboxes on your domain. `smtp.zoho.com:465` with `SMTP_SECURE=true` |
| Google Workspace | `smtp.gmail.com:587` with an app password |
| Amazon SES | Cheapest at volume; needs leaving the sandbox |

Then:

1. Verify your domain with the provider. Add the **SPF**, **DKIM** and **DMARC** DNS records it gives you; without them, emails land in spam.
2. Use an address on that domain in `EMAIL_FROM`, for example `"Agenda <no-reply@tudominio.com>"`.

## 4. First deploy

```bash
# As the deploy user
mkdir -p ~/agenda && cd ~/agenda
# Copy the deploy/ folder from the repository (scp, git clone, or download)
cp .env.production.example .env.production
nano .env.production     # fill in DOMAIN, passwords, secrets, SMTP
chmod 600 .env.production
./deploy.sh
```

Generate every secret with `openssl rand -base64 32`. The password in `DATABASE_URL` must match `POSTGRES_PASSWORD`. If it contains special characters, URL-encode it, or use a hex secret: `openssl rand -hex 24`.

`deploy.sh` does the following:

1. pulls the images
2. starts Postgres
3. runs the migrations
4. starts the app once they succeed, then Caddy, cron and backup
5. checks `/api/health`

Open `https://<DOMAIN>`, create your account, and check that the verification email arrives.

## 5. Day-to-day operations

| Task | Command (in `~/agenda`) |
| --- | --- |
| Update to the latest version | `./deploy.sh` |
| Roll back / pin a version | `TAG=sha-1a2b3c4 ./deploy.sh` (or set `TAG` in `.env.production`) |
| App logs | `docker compose -f docker-compose.prod.yml logs -f app` |
| Job runs (reminders) | `docker compose -f docker-compose.prod.yml logs -f cron` |
| Status | `docker compose -f docker-compose.prod.yml ps` |
| Run the jobs now | `docker compose -f docker-compose.prod.yml exec cron sh -c 'curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://app:3000/api/cron/run'` |
| List backups | `./restore.sh` |
| Restore a backup | `./restore.sh agenda-20261010-0600.dump` |
| Copy backups off the server | `docker compose -f docker-compose.prod.yml cp backup:/backups ./backups` |

### Notes
- **Migrations and rollbacks:** migrations only move forward. Rolling back to an older image after a migration works as long as the change was additive, which is the project's convention: add columns and tables, never drop them in the same release.
- **Backups:**
  - Nightly backups stay on the same server. Copy them elsewhere regularly, for example with `rclone` to S3 or Backblaze from a crontab, and **test a restore** at least once.
  - `restore.sh` stops the app and the scheduler, runs `pg_restore --clean`, then starts them again.
- **Rotating secrets:** edit `.env.production`, then `./deploy.sh`.
  - Changing `BETTER_AUTH_SECRET` signs everyone out.
  - Changing `CRON_SECRET` needs no other step: the cron container reads it from the same file.
- **Developer admin:** set `ADMIN_EMAILS=you@example.com` in `.env.production` and `./deploy.sh`. Sign up with that email and verify it, then open `https://<DOMAIN>/admin`. "Entrar como dueño" opens a business as its owner for 1 hour; a coral banner shows it, and every change appears in that business's Actividad as "Soporte (admin)". Removing the email revokes access on the next request.
- **Monitoring:** point a free uptime monitor (UptimeRobot, Better Stack) at `https://<DOMAIN>/api/health`. It returns 503 if the database is down.
- **Scaling:** one app container handles a lot of small businesses. Before running several replicas, read the Next.js self-hosting guide (shared cache, `deploymentId`). The scheduled jobs are already safe to run concurrently thanks to an advisory lock.

## 6. Production checklist

- [ ] `DOMAIN` resolves to the server; `https://` loads with a valid certificate
- [ ] All secrets are random and at least 32 characters; `.env.production` is `chmod 600` and not in git
- [ ] Sign-up verification email arrives (not in spam); SPF/DKIM/DMARC set
- [ ] `RATE_LIMITS=on` (enforced) and `PAYMENT_PROVIDERS=manual`
- [ ] `docker compose … logs cron` shows `"ran":true` every 15 minutes
- [ ] A nightly `.dump` appears in backups, is copied off the server, and a restore was tested
- [ ] Uptime monitor on `/api/health`

## Rehearsing locally

You can run the production stack on your machine before renting a server:

```bash
docker build -t agenda:local .
cd deploy && cp .env.production.example .env.production
# In .env.production: DOMAIN=localhost, BETTER_AUTH_URL=https://localhost,
# APP_IMAGE=agenda, TAG=local, and real (or test) SMTP settings.
SKIP_PULL=1 ./deploy.sh
```

For `localhost`, Caddy uses its internal CA, so the browser shows a certificate warning.
