import type { Metadata } from "next";
import { Suspense } from "react";

import { pageMetadata } from "@/lib/seo";
import { collectionCopy } from "@/content/copy/collection";
import { SEARCH_QUERY_SCRIPT } from "@/components/collection/collectionQueryScript";
import { PageHeader } from "@/components/pages/PageHeader";
import { SearchFallback, SearchView } from "@/components/search/SearchView";
import { Container } from "@/components/ui/Container";
import { InlineScript } from "@/components/ui/InlineScript";

/**
 * /zoeken (docs/PLAN.md §14.10; decision 35): PageHeader (H1 "Zoeken") and the client SearchView, which reads `?q=`
 * with useSearchParams inside <Suspense> and searches the visible catalog in the browser. The fallback is the same
 * field as a GET form plus the collection links, so the static page works without JavaScript; on a deep link with
 * ?q= the links stay invisible until the results replace them (SEARCH_QUERY_SCRIPT). The page reads no server
 * searchParams, so it stays static (○). noindex (lib/seo.ts NOINDEX_PATHS); the WebSite JSON-LD points its SearchAction here.
 */

const copy = collectionCopy.search;

export const metadata: Metadata = pageMetadata({ title: copy.title, description: copy.metaDescription, path: "/zoeken", noindex: true });

export default function SearchPage() {
  return (
    <>
      <PageHeader title={copy.title} intro={copy.intro} />
      <Container className="pb-16 md:pb-24">
        {/* Before the first paint, a deep link with ?q= marks this wrapper: the fallback's links stay invisible. */}
        <div suppressHydrationWarning>
          <InlineScript html={SEARCH_QUERY_SCRIPT} />
          <Suspense fallback={<SearchFallback />}>
            <SearchView />
          </Suspense>
        </div>
      </Container>
    </>
  );
}
