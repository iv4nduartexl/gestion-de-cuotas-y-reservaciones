import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({
  type,
  children,
}: {
  type: "error" | "success" | "warning";
  children: React.ReactNode;
}) {
  if (type === "warning") {
    return (
      <Alert className="border-warning/40 bg-warning-soft text-warning-foreground">
        <TriangleAlertIcon />
        <AlertDescription className="text-warning-foreground">{children}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant={type === "error" ? "destructive" : "default"}>
      {type === "error" ? <CircleAlertIcon /> : <CircleCheckIcon />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
