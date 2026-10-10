// Runs the scheduled jobs once against a running app (development, manual runs).
// Usage: npm run cron:run  (reads CRON_SECRET and BETTER_AUTH_URL from .env)
const base = process.env.CRON_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set (see .env.example).");
  process.exit(1);
}

const response = await fetch(new URL("/api/cron/run", base), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const body = await response.text();
console.log(`${response.status} ${body}`);
process.exit(response.ok ? 0 : 1);
