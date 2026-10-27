import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { breadcrumbJsonLd, organizationJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

function scriptBody(html: string): string {
  const match = /^<script type="application\/ld\+json">([\s\S]*)<\/script>$/.exec(html);
  if (!match) throw new Error(`Not a single JSON-LD script: ${html}`);
  return match[1];
}

describe("JsonLd", () => {
  it("renders one plain JSON-LD script with the data", () => {
    const html = renderToStaticMarkup(<JsonLd data={organizationJsonLd()} />);
    expect(JSON.parse(scriptBody(html))).toEqual(organizationJsonLd());
  });

  it("renders an array of nodes", () => {
    const nodes = [organizationJsonLd(), breadcrumbJsonLd([{ name: "Home", path: "/" }])];
    const html = renderToStaticMarkup(<JsonLd data={nodes} />);
    expect(JSON.parse(scriptBody(html))).toEqual(nodes);
  });

  it("escapes < so a value can never close the script element", () => {
    const html = renderToStaticMarkup(<JsonLd data={{ name: "</script><script>alert(1)</script>" }} />);
    const body = scriptBody(html);
    expect(body).not.toContain("<");
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(JSON.parse(body)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
