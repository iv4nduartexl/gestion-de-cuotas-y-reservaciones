import { ChevronRightIcon } from "lucide-react";

import { setActiveOrganizationAction } from "@/app/organization-actions";

export function SelectOrganizationList({
  organizations,
}: {
  organizations: { id: string; name: string; slug: string }[];
}) {
  return (
    <ul className="grid gap-2">
      {organizations.map((org) => (
        <li key={org.id}>
          <form action={setActiveOrganizationAction}>
            <input type="hidden" name="organizationId" value={org.id} />
            <button
              type="submit"
              className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-muted"
            >
              <span>
                <span className="font-medium">{org.name}</span>
                <span className="block text-muted-foreground">/{org.slug}</span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
