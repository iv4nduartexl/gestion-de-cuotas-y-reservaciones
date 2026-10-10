import { isCronAuthorized } from "@/lib/cron-auth";
import { runScheduledJobs } from "@/lib/jobs/run";

/**
 * The scheduled job: cuotas, reminder planning and sending. Call it every
 * ~15 minutes (Vercel Cron, crontab, Docker: see docs/cron.md).
 */
async function handle(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const report = await runScheduledJobs();
  return Response.json(report, { status: report.ran ? 200 : 409 });
}

export const POST = handle;
// Vercel Cron sends GET requests (with the same Authorization header).
export const GET = handle;
