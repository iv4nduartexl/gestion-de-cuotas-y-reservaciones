import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "./permissions";

// Same-origin: the client talks to /api/auth on the current host.
export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles }), adminClient()],
});
