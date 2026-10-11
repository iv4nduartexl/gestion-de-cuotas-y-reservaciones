"use client";

import { LightbulbIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Fix, Issue } from "@/lib/config-rules";

/** A calm explanation of why a step can't continue, with one-tap fixes. */
export function IssueBox<T>({ issues, onFix }: { issues: Issue<T>[]; onFix: (fix: Fix<T>) => void }) {
  if (issues.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-foreground">
      {issues.map((found, index) => (
        <div key={index} className="flex flex-col gap-2">
          <p className="flex items-start gap-2">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{found.message}</span>
          </p>
          {found.fixes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <LightbulbIcon className="size-4" aria-hidden="true" />
              {found.fixes.map((fix) => (
                <Button key={fix.label} type="button" size="sm" variant="outline" className="bg-card" onClick={() => onFix(fix)}>
                  {fix.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
