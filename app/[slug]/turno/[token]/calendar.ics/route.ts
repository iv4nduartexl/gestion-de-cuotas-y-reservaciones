import { hashManageToken } from "@/lib/booking";
import { getAppointmentByTokenHash } from "@/lib/data/appointments";
import { getPublicBusiness } from "@/lib/data/public";
import { redirectedSlug } from "@/lib/data/slugs";
import { buildIcs } from "@/lib/ics";

export async function GET(request: Request, { params }: RouteContext<"/[slug]/turno/[token]/calendar.ics">) {
  const { slug, token } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) {
    const current = await redirectedSlug(slug);
    if (current) return Response.redirect(new URL(`/${current}/turno/${token}/calendar.ics`, request.url), 308);
  }
  const turno = business ? await getAppointmentByTokenHash(business, hashManageToken(token)) : null;
  if (!business || !turno) return new Response("No encontrado", { status: 404 });

  const ics = buildIcs({
    uid: turno.id,
    start: turno.startsAt,
    end: turno.endsAt,
    summary: `${turno.serviceName}, ${business.organization.name}`,
    description: `Turno con ${turno.staffName}.`,
    location: business.settings.address,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="turno-${slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
