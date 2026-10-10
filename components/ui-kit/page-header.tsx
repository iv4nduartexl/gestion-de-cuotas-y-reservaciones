import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import { SectionIntro } from "@/components/ui-kit/section-intro";
import { SECTION_HREFS, sectionHelp, type HelpSettings, type Section } from "@/lib/help-content";

/** Page title + one line that says what the page is for. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  help,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  /** Adds the "¿Para qué sirve?" panel; `open` while the section is still empty. */
  help?: { section: Section; settings: HelpSettings; open?: boolean };
}) {
  const content = help && sectionHelp(help.section, help.settings);
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {help && content && (
        <SectionIntro
          section={help.section}
          // Skip "Qué es" when the page description already says it.
          what={description === content.what ? undefined : content.what}
          why={content.why}
          example={content.example}
          connections={content.connectsTo.map((section) => ({
            label: sectionHelp(section, help.settings).title,
            href: content.connectionHrefs?.[section] ?? SECTION_HREFS[section],
          }))}
          defaultOpen={help.open ?? false}
        />
      )}
    </div>
  );
}
