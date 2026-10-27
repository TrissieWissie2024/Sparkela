/**
 * Brand colour values for places without CSS: the web manifest, OG images (Satori), the logo script and the
 * viewport `themeColor` (docs/PLAN.md §4.1). Components never use these; they use the token classes and
 * `var(--…)` from app/globals.css. Besides app/globals.css this is the only file with hex codes (plan §21.1).
 *
 * Keys are the CSS custom property names without "--", so this mirrors the colour tokens in `:root` one to one
 * and tests/unit/contrast.test.ts can recompute the contrast table (§4.10) from it. One entry per line, so the logo
 * script can read a value with a small regex (plan §13.1).
 */

export type HexColor = `#${string}`;

export const brandColors = {
  // Brand
  inkt: "#171717",
  "bot-wit": "#E8E0D4",
  steen: "#77766F",
  olijf: "#59634B",
  roest: "#713B32",
  leisteen: "#344B65",
  // Surfaces
  pagina: "#F2EADE",
  vlak: "#E8E0D4",
  kaart: "#FFFFFF",
  donker: "#171717",
  // Text
  tekst: "#171717",
  "tekst-2": "#565550",
  "tekst-gedempt": "#77766F",
  "tekst-op-donker": "#E8E0D4",
  "tekst-2-op-donker": "#ACA79E",
  // Interaction
  primair: "#713B32",
  "primair-hover": "#603028",
  "primair-tekst": "#E8E0D4",
  link: "#344B65",
  "link-hover": "#713B32",
  focus: "#344B65",
  // Lines
  rand: "#CAC3B9",
  "rand-sterk": "#A9A8A2",
  "rand-invoer": "#77766F",
  "rand-op-donker": "#413F3D",
  // Product swatches and the Dutch flag (not brand colours)
  "swatch-goud": "#C9A45C",
  "swatch-zilver": "#BFC1C2",
  "vlag-rood": "#AE1C28",
  "vlag-wit": "#FFFFFF",
  "vlag-blauw": "#21468B",
  // Status
  succes: "#59634B",
  "succes-vlak": "#E9EDE3",
  fout: "#713B32",
  "fout-vlak": "#FBE6E2",
  info: "#344B65",
  "info-vlak": "#E4ECF6",
  // Tints (brief §5): 50 to 200 for surfaces and labels, 700 to 900 for text and hover
  "inkt-50": "#F7F7F7",
  "inkt-100": "#EBEBEB",
  "inkt-200": "#DBDBDB",
  "inkt-300": "#C4C4C4",
  "inkt-400": "#A8A8A8",
  "inkt-500": "#898989",
  "inkt-600": "#6F6F6F",
  "inkt-700": "#555555",
  "inkt-800": "#404040",
  "inkt-900": "#171717",
  "bot-wit-50": "#FDF6EB",
  "bot-wit-100": "#F2EADE",
  "bot-wit-200": "#E8E0D4",
  "bot-wit-300": "#CAC3B9",
  "bot-wit-400": "#ACA79E",
  "bot-wit-500": "#8D8882",
  "bot-wit-600": "#716E69",
  "bot-wit-700": "#575551",
  "bot-wit-800": "#413F3D",
  "bot-wit-900": "#2D2B28",
  "steen-50": "#F7F7F3",
  "steen-100": "#ECEBE7",
  "steen-200": "#DBDBD7",
  "steen-300": "#C5C4BF",
  "steen-400": "#A9A8A2",
  "steen-500": "#8A8983",
  "steen-600": "#77766F",
  "steen-700": "#565550",
  "steen-800": "#41403B",
  "steen-900": "#2C2B28",
  "olijf-50": "#F5F8F0",
  "olijf-100": "#E9EDE3",
  "olijf-200": "#D8DDD1",
  "olijf-300": "#C1C7B9",
  "olijf-400": "#A3AB9A",
  "olijf-500": "#848D79",
  "olijf-600": "#69735C",
  "olijf-700": "#59634B",
  "olijf-800": "#3B4330",
  "olijf-900": "#282E1E",
  "roest-50": "#FFF1ED",
  "roest-100": "#FBE6E2",
  "roest-200": "#ECD5D0",
  "roest-300": "#D9BDB7",
  "roest-400": "#C29E97",
  "roest-500": "#A87D75",
  "roest-600": "#916158",
  "roest-700": "#713B32",
  "roest-800": "#603028",
  "roest-900": "#461D17",
  "leisteen-50": "#EFF8FF",
  "leisteen-100": "#E4ECF6",
  "leisteen-200": "#D3DCE6",
  "leisteen-300": "#BAC5D2",
  "leisteen-400": "#9BA9BA",
  "leisteen-500": "#7A8B9F",
  "leisteen-600": "#5D7187",
  "leisteen-700": "#415770",
  "leisteen-800": "#344B65",
  "leisteen-900": "#1B2D41",
} as const satisfies Record<string, HexColor>;

export type BrandColorToken = keyof typeof brandColors;

/** The hex value of a colour token, e.g. brandColor("bot-wit") → "#E8E0D4". */
export function brandColor(token: BrandColorToken): HexColor {
  return brandColors[token];
}
