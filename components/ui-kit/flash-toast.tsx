"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { FLASH_MESSAGES, type FlashKey } from "@/lib/flash";

/** Shows the toast for ?aviso=<key> once, then removes it from the URL. */
export function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const key = searchParams.get("aviso");

  useEffect(() => {
    if (!key || !(key in FLASH_MESSAGES)) return;
    toast.success(FLASH_MESSAGES[key as FlashKey]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("aviso");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [key, pathname, router, searchParams]);

  return null;
}
