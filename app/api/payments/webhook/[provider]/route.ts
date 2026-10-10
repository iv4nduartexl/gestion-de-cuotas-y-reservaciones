import { processWebhook } from "@/lib/payments/webhooks";

export async function POST(request: Request, { params }: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider } = await params;
  const result = await processWebhook(provider, request);
  return Response.json(result.body, { status: result.status });
}
