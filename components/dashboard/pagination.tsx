import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-end gap-2 text-sm" aria-label="Paginación">
      <span className="text-muted-foreground">
        Página {page} de {pageCount}
      </span>
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Anterior
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>Anterior</Button>
      )}
      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Siguiente
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>Siguiente</Button>
      )}
    </nav>
  );
}
