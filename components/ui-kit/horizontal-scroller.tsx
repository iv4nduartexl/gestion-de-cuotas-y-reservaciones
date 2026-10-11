"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A horizontal strip with left/right arrows that only show when there is
 * more to scroll that way (and a soft fade at that edge).
 */
export function HorizontalScroller({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"div"> & { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 2 px tolerance: fractional scroll positions on zoomed or HiDPI screens.
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const resize = new ResizeObserver(update);
    resize.observe(el);
    // New items (e.g. "Más días") change the scroll width without a resize.
    const mutations = new MutationObserver(update);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [update]);

  function scrollBy(direction: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className={cn("overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...props}>
        {children}
      </div>
      {edges.left && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" aria-hidden="true" />
          <ArrowButton side="left" label={`${label}: anteriores`} onClick={() => scrollBy(-1)} />
        </>
      )}
      {edges.right && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" aria-hidden="true" />
          <ArrowButton side="right" label={`${label}: siguientes`} onClick={() => scrollBy(1)} />
        </>
      )}
    </div>
  );
}

function ArrowButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-card text-foreground shadow-lift transition-colors hover:border-primary hover:text-primary",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
