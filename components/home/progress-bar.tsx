"use client";

import { motion, useReducedMotion } from "motion/react";

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const reduce = useReducedMotion();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2.5 overflow-hidden rounded-full bg-muted"
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-primary to-sidebar-primary"
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}
