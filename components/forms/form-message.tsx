import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({
  type,
  children,
}: {
  type: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <Alert variant={type === "error" ? "destructive" : "default"}>
      {type === "error" ? <CircleAlertIcon /> : <CircleCheckIcon />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
