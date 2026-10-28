"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";

import { searchPages, searchProducts } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { collectionPath } from "@/lib/paths";
import { collections } from "@/content/collections";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { clearQueryMark, SEARCH_QUERY_ATTRIBUTE } from "@/components/collection/collectionQueryScript";
import { stylingTilePlacement } from "@/components/collection/filterParams";
import { ProductCard } from "@/components/product/ProductCard";
import { productGridClassName } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

/**
 * The search page (docs/PLAN.md §7.3, §13.12, §14.10; decision 35): a search field, the results as the shared
 * ProductGrid (the same cards as everywhere, with QuickAdd) and, with an empty field or no results, the collections to
 * start from. It searches the visible catalog in the browser (searchProducts over useCatalog().products), so it is
 * instant, works with a static page and never shows a drop before its start.
 *
 * The query lives in `?q=`: read with useSearchParams (inside <Suspense>, the page renders SearchFallback), written
 * with history.replaceState 400 ms after typing stops and at once on Enter, without a server round trip. A new `q`
 * from elsewhere (the header's search dialog navigates here) replaces the field; the echo of our own write does not,
 * so fast typing is never overwritten. The number of results is announced in a polite live region.
 *
 * Back from a result (QA round 2): Cache Components keep this route alive (hidden) while a product page shows, and
 * useSearchParams then follows the product page's URL. The field ignores URL changes while the pathname is not
 * /zoeken, and whenever the route is shown again (its effects run again) it re-reads the real URL, so Back always
 * brings the query and the results back. While there is a query, the view reserves at least a viewport of height, as
 * the fallback does on a deep link, so the footer never jumps out of view when the results arrive (CLS 0).
 */

/** The search page's path (the GET form's target and the page this view lives on). */
export const SEARCH_PATH = "/zoeken";

/** Reserve while there is a query (here and on the fallback's wrapper): keeps the footer below the fold. */
export const SEARCH_QUERY_RESERVE = "min-h-[calc(100svh-var(--header-hoogte))]";

/** Delay before the URL follows the field, in ms (a UI timer, not a time boundary). */
const URL_DELAY_MS = 400;

/** Collections offered as a starting point: everything except "limited", which is empty between drops. */
const SUGGESTED = collections.filter((collection) => collection.handle !== "limited");

export function SearchView() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // While another route shows (this one hidden by Activity), its search params are not ours.
  const onSearchPage = pathname === SEARCH_PATH;
  const urlQuery = searchParams?.get("q") ?? "";
  const { searchable } = useCatalog();
  const [query, setQuery] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const [written, setWritten] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const statusId = `${id}-status`;
  const resultsId = `${id}-results`;

  // A new ?q= that we did not write ourselves (a navigation from the search dialog) replaces the field.
  if (onSearchPage && urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== written && urlQuery !== query.trim()) setQuery(urlQuery);
  }

  const deferred = useDeferredValue(query);
  const trimmed = deferred.trim();
  const results = useMemo(() => searchProducts(searchable, deferred), [searchable, deferred]);
  const pages = useMemo(() => searchPages(sharedCopy.searchPages, deferred), [deferred]);

  useEffect(() => () => clearTimeout(timer.current), []);
  // Runs on mount and every time the route is shown again (Back from a product): the field follows the real URL.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.location.pathname !== SEARCH_PATH) return;
      const real = new URLSearchParams(window.location.search).get("q") ?? "";
      setSeenUrlQuery(real);
      setWritten(real);
      setQuery((current) => (current.trim() === real.trim() ? current : real));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  // The real view is on screen: the fallback's pre-paint mark (a deep link with ?q=) is no longer needed.
  useEffect(() => clearQueryMark(SEARCH_QUERY_ATTRIBUTE), []);

  const writeUrl = (value: string) => {
    clearTimeout(timer.current);
    const q = value.trim();
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("q", q);
    else params.delete("q");
    const search = params.toString();
    setWritten(q);
    window.history.replaceState(null, "", search ? `${window.location.pathname}?${search}` : window.location.pathname);
  };

  const onChange = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => writeUrl(value), URL_DELAY_MS);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    writeUrl(query);
    // Close the phone keyboard so the results are in view.
    if (query.trim()) inputRef.current?.blur();
    else inputRef.current?.focus();
  };

  const status = trimmed
    ? results.length > 0
      ? collectionCopy.search.count(results.length)
      : pages.length > 0
        ? `${collectionCopy.search.noneProducts(trimmed)}. ${collectionCopy.search.pagesCount(pages.length)}.`
        : collectionCopy.search.none(trimmed)
    : "";

  return (
    <div className={cn(trimmed && SEARCH_QUERY_RESERVE)}>
      <SearchForm
        value={query}
        onChange={onChange}
        onSubmit={onSubmit}
        onClear={() => {
          onChange("");
          inputRef.current?.focus();
        }}
        inputRef={inputRef}
        describedBy={statusId}
      />
      <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </p>

      {trimmed && results.length > 0 && pages.length > 0 ? <SearchPageLinks pages={pages} className="mt-8 md:mt-10" /> : null}
      {trimmed ? (
        results.length > 0 ? (
          <section aria-labelledby={resultsId} className="mt-10 md:mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rand pb-4">
              <h2 id={resultsId} className="kop-3 min-w-0 text-tekst [overflow-wrap:anywhere]">
                {collectionCopy.search.resultsTitle(trimmed)}
              </h2>
              <p className="tabular tekst-klein text-tekst-2">{collectionCopy.search.count(results.length)}</p>
            </div>
            <ul role="list" aria-label={collectionCopy.search.resultsLabel} className={cn(productGridClassName, "mt-8 md:mt-10")}>
              {results.map((product) => (
                <li key={product.handle} className="min-w-0">
                  <ProductCard product={product} headingLevel={3} />
                </li>
              ))}
              {/* Closes the grid: it fills the cells the last row leaves empty (or a row of its own), never ragged. */}
              <li className={cn("min-w-0", stylingTilePlacement(results.length, results.length).className)}>
                <SearchMoreTile />
              </li>
            </ul>
          </section>
        ) : pages.length > 0 ? (
          <div className="mt-10 md:mt-14">
            <h2 className="kop-3 text-tekst [overflow-wrap:anywhere]">{collectionCopy.search.noneProducts(trimmed)}</h2>
            <p className="mt-2 max-w-[36rem] text-tekst-2">{collectionCopy.search.noneProductsHint}</p>
            <SearchPageLinks pages={pages} hideTitle className="mt-5" />
            <SearchSuggestions className="mt-10" />
          </div>
        ) : (
          <div className="mt-10 md:mt-14">
            <h2 className="kop-3 text-tekst [overflow-wrap:anywhere]">{collectionCopy.search.none(trimmed)}</h2>
            <p className="mt-2 max-w-[36rem] text-tekst-2">{collectionCopy.search.noneHint}</p>
            <SearchSuggestions className="mt-8" />
          </div>
        )
      ) : (
        <SearchSuggestions className="mt-10 md:mt-14" />
      )}
    </div>
  );
}

/**
 * The Suspense fallback of /zoeken (plan §14.10): the same search field as a plain GET form to /zoeken (works without
 * JavaScript) and the collection links. On a deep link with ?q= the collection links stay invisible (their space kept)
 * until SearchView shows the results (SEARCH_QUERY_SCRIPT on the wrapper, see collectionQueryScript.ts).
 */
export function SearchFallback() {
  return (
    <>
      <SearchForm />
      <SearchSuggestions className="mt-10 md:mt-14 [[data-search-query]_&]:invisible" />
    </>
  );
}

interface SearchFormProps {
  /** Controlled value (SearchView); without it the field is uncontrolled (fallback). */
  value?: string;
  onChange?(value: string): void;
  onSubmit?(event: FormEvent<HTMLFormElement>): void;
  onClear?(): void;
  inputRef?: RefObject<HTMLInputElement | null>;
  describedBy?: string;
}

/** The field: label above, a 48 px pill with a search icon and a clear button, and "Zoeken" from sm. */
function SearchForm({ value, onChange, onSubmit, onClear, inputRef, describedBy }: SearchFormProps) {
  const copy = collectionCopy.search;
  const id = useId();
  const inputId = `${id}-q`;
  const controlled = value !== undefined;

  return (
    <form role="search" action={SEARCH_PATH} method="get" onSubmit={onSubmit} className="max-w-[44rem]">
      <label htmlFor={inputId} className="tekst-klein block font-semibold text-tekst">
        {copy.label}
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
            placeholder={copy.placeholder}
            aria-describedby={describedBy}
            {...(controlled ? { value, onChange: (event) => onChange?.(event.target.value) } : { defaultValue: "" })}
            className="h-12 w-full rounded-full border border-rand-invoer bg-kaart pr-12 pl-12 text-base text-tekst placeholder:text-tekst-gedempt hover:border-tekst [&::-webkit-search-cancel-button]:hidden"
          />
          {controlled && value ? (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={copy.clear}
              onClick={onClear}
              className="absolute! top-1/2 right-0.5 -translate-y-1/2"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </Button>
          ) : null}
        </div>
        <Button type="submit" variant="primair" size="md" className="max-sm:hidden">
          {copy.submit}
        </Button>
      </div>
    </form>
  );
}

/**
 * The tile at the end of the results (QA round 1: no ragged last row): the Spark Finder and all jewellery. The links
 * wrap inside a half-width tile (QA round 2: no sideways scroll at 320 px or with extra text spacing) and are each
 * 44 px tall, without overlapping touch areas.
 */
function SearchMoreTile({ className }: { className?: string }) {
  const copy = collectionCopy.search.more;
  return (
    <div className={cn("flex h-full min-h-[12rem] flex-col justify-center rounded-kaart border border-rand bg-vlak p-4 md:p-6", className)}>
      <p className="kop-4 text-tekst">{copy.title}</p>
      <p className="tekst-klein mt-1.5 text-tekst-2">{copy.text}</p>
      <ul role="list" className="mt-2 flex flex-col items-start">
        {copy.links.map((link) => (
          <li key={link.href} className="max-w-full">
            <Link
              href={link.href}
              className="inline-flex min-h-11 max-w-full items-center py-1 text-sm font-semibold text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pages that match the query (sharedCopy.searchPages, QA round 2), as link chips. `hideTitle`: under "Geen sieraden
 * voor …" and its hint the visible "Pagina's" would repeat the hint, so it is only read out.
 */
function SearchPageLinks({
  pages,
  hideTitle = false,
  className,
}: {
  pages: ReadonlyArray<{ label: string; href: string }>;
  hideTitle?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className={hideTitle ? "sr-only" : "label-caps text-tekst-2"}>
        {sharedCopy.searchPagesTitle}
      </h2>
      <ul role="list" className={cn("flex flex-wrap gap-2", !hideTitle && "mt-3")}>
        {pages.map((page) => (
          <li key={page.href} className="shrink-0">
            <Chip href={page.href}>{page.label}</Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The collections to start from, as link chips (the same pills as the product page's chips). */
function SearchSuggestions({ className }: { className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="label-caps text-tekst-2">
        {collectionCopy.search.suggestionsTitle}
      </h2>
      <ul role="list" aria-label={collectionCopy.search.suggestionsLabel} className={cn("mt-4 flex flex-wrap gap-2")}>
        {SUGGESTED.map((collection) => (
          <li key={collection.handle} className="shrink-0">
            <Chip href={collectionPath(collection.handle)}>{collection.title}</Chip>
          </li>
        ))}
        {collectionCopy.search.suggestionPages.map((page) => (
          <li key={page.href} className="shrink-0">
            <Chip href={page.href}>{page.label}</Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
