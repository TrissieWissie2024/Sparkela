"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useId, useMemo, useRef, useState, type FormEvent } from "react";

import type { NavItem } from "@/lib/types";
import { defaultVariant, searchProducts } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { priceDisplay } from "@/lib/pricing";
import { productPath } from "@/lib/paths";
import { chromeCopy } from "@/content/copy/chrome";
import { mainNav } from "@/content/navigation";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { ProductThumb } from "@/components/cart/ProductThumb";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { Sheet } from "@/components/ui/Sheet";

/**
 * The search dialog of the header (docs/PLAN.md §13.5, §7.3, decision 35): a Sheet from the top with a search field,
 * the top 6 results while typing and a link to all results on /zoeken?q=…; Enter goes there too. It searches the
 * visible catalog in the browser (searchProducts over useCatalog().products), so it is instant, works with a static
 * site and never shows a drop before its start.
 *
 * The field takes focus when the dialog opens; the number of results is announced in a polite live region. Radix
 * gives the focus trap and Escape; focus returns to the search button (Sheet). Following a result closes the dialog.
 * With an empty field it shows quick links to the main collections (content/navigation.ts).
 */

/** How many results the dialog shows; /zoeken has the rest. */
export const SEARCH_DIALOG_LIMIT = 6;

/** /zoeken?q=… for a query. */
export function searchPageHref(query: string): string {
  return `/zoeken?q=${encodeURIComponent(query.trim())}`;
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { products } = useCatalog();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const inputId = `${id}-q`;
  const statusId = `${id}-status`;

  const results = useMemo(() => searchProducts(products, deferred), [products, deferred]);
  const trimmed = deferred.trim();
  const top = results.slice(0, SEARCH_DIALOG_LIMIT);
  const quickLinks = mainNav.filter((item): item is Extract<NavItem, { kind: "link" }> => item.kind === "link");

  const close = () => onOpenChange(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    close();
    router.push(searchPageHref(q));
  };

  return (
    <Sheet
      side="top"
      size="md"
      open={open}
      onOpenChange={onOpenChange}
      title={chromeCopy.search.title}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
      bodyClassName="pb-8"
    >
      <div className="mx-auto w-full max-w-[44rem]">
        <form role="search" onSubmit={submit} action="/zoeken" method="get">
          <label htmlFor={inputId} className="tekst-klein block font-semibold text-tekst">
            {chromeCopy.search.label}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tekst-2"
                strokeWidth={1.5}
              />
              <input
                ref={inputRef}
                id={inputId}
                name="q"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                placeholder={chromeCopy.search.placeholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-describedby={statusId}
                className="h-12 w-full rounded-full border border-rand-invoer bg-kaart pr-12 pl-12 text-base text-tekst placeholder:text-tekst-gedempt hover:border-tekst [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={chromeCopy.search.clear}
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute! top-1/2 right-0.5 -translate-y-1/2"
                >
                  <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
                </Button>
              ) : null}
            </div>
            <Button type="submit" variant="primair" size="md" className="max-sm:hidden">
              {chromeCopy.search.submit}
            </Button>
          </div>
        </form>

        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {trimmed ? (results.length > 0 ? chromeCopy.search.count(results.length) : chromeCopy.search.none(trimmed)) : ""}
        </p>

        {trimmed ? (
          results.length > 0 ? (
            <div className="mt-6">
              <ul aria-label={chromeCopy.search.resultsLabel} className="divide-y divide-rand">
                {top.map((product) => {
                  const variant = defaultVariant(product);
                  const multiplePrices = product.priceRange.min.cents !== product.priceRange.max.cents;
                  return (
                    <li key={product.handle}>
                      <Link
                        href={productPath(product.handle)}
                        onClick={close}
                        className="group flex min-h-11 items-center gap-4 py-3"
                      >
                        <ProductThumb image={product.images[0] ?? null} title={product.title} sizes="48px" className="w-12" />
                        <span className="min-w-0 flex-1">
                          <span className="kop-4 block decoration-1 underline-offset-4 group-hover:underline">{product.title}</span>
                          {product.specRegel ? (
                            <span className="tekst-klein mt-0.5 block text-tekst-2">{product.specRegel}</span>
                          ) : null}
                        </span>
                        <Price display={priceDisplay(variant, product.laagstePrijs30d)} size="sm" from={multiplePrices} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href={searchPageHref(trimmed)}
                onClick={close}
                className={cn(buttonClasses({ variant: "outline", size: "md", fullWidth: true }), "mt-5")}
              >
                {chromeCopy.search.all(results.length)}
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              <p className="font-semibold break-words text-tekst [overflow-wrap:anywhere]">{chromeCopy.search.none(trimmed)}</p>
              <p className="tekst-klein mt-1 text-tekst-2">{chromeCopy.search.noneHint}</p>
            </div>
          )
        ) : (
          <div className="mt-6">
            <p className="label-caps text-tekst-2">{chromeCopy.search.quickLinksTitle}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {quickLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={close} className={buttonClasses({ variant: "outline", size: "sm" })}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
