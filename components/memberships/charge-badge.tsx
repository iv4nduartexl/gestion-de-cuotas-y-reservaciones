import { Badge } from "@/components/ui/badge";
import { CHARGE_STATUS_BADGE, CHARGE_STATUS_LABELS, type DerivedChargeStatus } from "@/lib/billing";

export function ChargeBadge({ status }: { status: DerivedChargeStatus }) {
  return <Badge variant={CHARGE_STATUS_BADGE[status]}>{CHARGE_STATUS_LABELS[status]}</Badge>;
}
