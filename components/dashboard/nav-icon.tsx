import {
  BellRingIcon,
  StoreIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  WalletIcon,
  CalendarDaysIcon,
  HouseIcon,
  type LucideProps,
  ScissorsIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import type { NavIcon as NavIconName } from "@/lib/navigation";

const ICONS = {
  home: HouseIcon,
  agenda: CalendarDaysIcon,
  cuotas: WalletIcon,
  reminders: BellRingIcon,
  plans: ClipboardListIcon,
  clients: UserRoundIcon,
  services: ScissorsIcon,
  schedule: CalendarClockIcon,
  team: UsersIcon,
  settings: SettingsIcon,
  business: StoreIcon,
} as const;

export function NavIcon({ name, ...props }: LucideProps & { name: NavIconName }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" {...props} />;
}
