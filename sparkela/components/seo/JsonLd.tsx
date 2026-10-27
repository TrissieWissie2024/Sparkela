import { serializeJsonLd } from "@/lib/seo";

export interface JsonLdProps {
  /** One schema.org object or several, built with the helpers in lib/seo.ts (each sets its own @context). */
  data: object | object[];
}

/**
 * Structured data as a plain <script type="application/ld+json"> (not next/script), rendered on the server into
 * the static HTML (plan §13.14). Every "<" is escaped as < (serializeJsonLd), so the content can never close
 * the element. Pages keep it outside <Suspense>, next to the H1 (plan §14).
 */
export function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
