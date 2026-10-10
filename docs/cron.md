# Scheduled jobs

Agenda has one job endpoint. Call it **every 15 minutes**:

```
POST /api/cron/run          (GET also works, for Vercel Cron)
Authorization: Bearer $CRON_SECRET
```

Each run does the following, in order:

1. **Cuotas:** generates the cuotas that became due, for every business that uses memberships.
2. **Plan reminders:** creates the reminders that are now due:
   - turnos tomorrow (and 2 h before, if enabled)
   - cuotas about to fall due, due today, or overdue
3. **Clean up:** skips reminders that are no longer needed:
   - the turno was cancelled or already started
   - the cuota was paid
   - a WhatsApp reminder that nobody sent within 3 days
4. **Send:** sends due email reminders. A failure is retried on the next runs, up to 3 attempts. WhatsApp reminders wait in **Recordatorios** to be sent by hand.

It is safe to call the endpoint more often, or twice at the same time:

- A Postgres advisory lock lets only one run work. A concurrent call gets `409 {"ran": false, "reason": "already_running"}`.
- Every reminder is unique per turno/cuota and kind, so nothing is sent twice.

Responses:

| Status | Meaning |
| --- | --- |
| 200 | Ran; the body is a JSON report (counts per step) |
| 401 | Missing or wrong secret, or `CRON_SECRET` unset |
| 409 | Another run is in progress |

`/api/cron/billing` (Phase 4) is kept as an alias of `/api/cron/run`.

## Choosing a host

Set `CRON_SECRET` to at least 32 random characters (`openssl rand -base64 32`), then pick one of these:

### Vercel

`vercel.json` already declares the cron (`*/15 * * * *`). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the `CRON_SECRET` env var is set in the project.

> The Hobby plan only runs crons once a day. Every 15 minutes needs a paid plan, or use one of the options below.

### A server with crontab

```cron
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_SECRET" https://your-domain/api/cron/run > /dev/null
```

### Docker Compose

```bash
# in .env: CRON_SECRET=... and CRON_URL=https://your-domain (or http://app:3000)
docker compose --profile cron up -d cron
```

### External schedulers

Anything that can send an authenticated POST every 15 minutes works: GitHub Actions `schedule`, cron-job.org, Cloud Scheduler, and so on.

## Development

```bash
npm run dev          # in one terminal
npm run cron:run     # runs the jobs once (reads CRON_SECRET from .env)
```

Emails go to the terminal while `EMAIL_TRANSPORT=console`.
