import type { AssetKey, AssetManifest, ImageAsset, VideoAsset } from "@/lib/types";
import { drops } from "@/content/drops";
import { stacks } from "@/content/stacks";

/**
 * Site imagery (docs/PLAN.md §17.2, brief §5): every photo and video slot with a fixed key, file name, aspect ratio
 * and pixel size, so Linde's photos replace the placeholders one to one. docs/ASSETS.md (the shot list) names every
 * key in this file.
 *
 * How it works
 * - `src` is where the file goes under public/ ("/images/hero/hero-desktop.webp" is public/images/...). It never
 *   changes. Site photos are WebP; product photos live in Shopify as JPEG or PNG (decision 131).
 * - A slot shows its file only when its key is in SUPPLIED. Until then PhotoSlot renders the placeholder
 *   "FOTO: {label}" (VideoSlot "VIDEO: {label}") in the same aspect ratio.
 * - To supply a file: export it at the listed size, put it at `src` and add the key to SUPPLIED below.
 * - Only Sparkela's own photos and video, or customer photos with permission (brief §2.2). Never images of others.
 * - The alt text describes the finished photo; update it if the shot turns out differently.
 */

const portrait = { aspect: "4:5", width: 1200, height: 1500 } as const;
const wide = { aspect: "16:9", width: 2400, height: 1350 } as const;
const square = { aspect: "1:1", width: 1080, height: 1080 } as const;

function image(key: AssetKey, src: string, size: Pick<ImageAsset, "aspect" | "width" | "height">, text: Pick<ImageAsset, "alt" | "label" | "brief">): ImageAsset {
  return { key, src, ...size, ...text };
}

const momentShots = [
  { moment: "festival", label: "Festival", alt: "Linde op een festival met chunky oorbellen en armbanden", brief: "Festivalsfeer buiten, kleurige outfit, oorbellen en armbanden goed in beeld." },
  { moment: "date-night", label: "Date night", alt: "Close-up van goudkleurige oorbellen bij een avondoutfit", brief: "Avondlicht, zwarte of donkere outfit, oorbellen en ketting in focus." },
  { moment: "kantoor-maar-niet-saai", label: "Kantoor maar niet saai", alt: "Blazer met een goudkleurige schakelarmband en ringetjes", brief: "Blazer of overhemd, daglicht, subtiele maar opvallende stukken." },
  { moment: "strand", label: "Strand", alt: "Schelp- en kralensieraden in de zon", brief: "Buiten in de zon, zomeroutfit, kleurige oorbellen en kralen." },
  { moment: "feestdagen", label: "Feestdagen", alt: "Goudkleurige sieraden en glitter bij een feestelijke outfit", brief: "Warm licht, feestelijke outfit, de stukken van Holiday Sparkle." },
] as const;

const photoStripCount = 8;

const images: Record<AssetKey, ImageAsset> = {
  "hero.desktop": image("hero.desktop", "/images/hero/hero-desktop.webp", wide, {
    alt: "Linde met chunky goudkleurige oorbellen en een stack armbanden",
    label: "Hero desktop",
    brief: "Grote draagfoto, liggend. Linde rechts in beeld, oorbellen en armbanden scherp, ruimte links voor de kop.",
  }),
  "hero.mobiel": image("hero.mobiel", "/images/hero/hero-mobiel.webp", portrait, {
    alt: "Linde met chunky goudkleurige oorbellen en een stack armbanden",
    label: "Hero mobiel",
    brief: "Zelfde shoot als de desktopversie, staand uitgesneden. Gezicht en oorbellen in de bovenste helft.",
  }),
  ...Object.fromEntries(
    momentShots.map((shot) => [
      `momenten.${shot.moment}`,
      image(`momenten.${shot.moment}`, `/images/momenten/${shot.moment}.webp`, portrait, {
        alt: shot.alt,
        label: shot.label,
        brief: shot.brief,
      }),
    ]),
  ),
  "home.statement": image("home.statement", "/images/home/statement.webp", portrait, {
    alt: "Chunky goudkleurige hoops en een brede bangle",
    label: "Statement",
    brief: "Draagfoto met grote, chunky stukken. Eén duidelijk statement, rustige achtergrond.",
  }),
  "home.subtiel": image("home.subtiel", "/images/home/subtiel.webp", portrait, {
    alt: "Kleine hoops en een fijn kettinkje",
    label: "Subtiel",
    brief: "Draagfoto met de subtiele lijn: mini hoops, fijne ketting, dun armbandje.",
  }),
  "linde.portret": image("linde.portret", "/images/linde/portret.webp", portrait, {
    alt: "Portret van Linde, eigenaar van Sparkela",
    label: "Linde, portret",
    brief: "Portret van Linde met haar favoriete stukken, daglicht, ontspannen.",
  }),
  "linde.wachtlijst": image("linde.wachtlijst", "/images/linde/wachtlijst.webp", portrait, {
    alt: "Linde met sieraden uit de eerste collectie van Sparkela",
    label: "Linde, wachtlijst",
    brief: "Staande foto van Linde voor de wachtlijstpagina, op een donkere of rustige achtergrond.",
  }),
  "club.hero": image("club.hero", "/images/club/club.webp", portrait, {
    alt: "Vriendinnen die sieraden van Sparkela dragen",
    label: "Sparkela Club",
    brief: "Groepsfoto of duo met sieraden, vrolijk en informeel, voor de Club-pagina.",
  }),
  ...Object.fromEntries(
    stacks.map((stack) => [
      stack.image,
      image(stack.image, `/images/stacks/${stack.slug}.webp`, portrait, {
        alt: `De stack ${stack.name}`,
        label: `Stack ${stack.name}`,
        brief: `De drie stuks van de stack ${stack.name} samen gedragen, oorbellen en pols in één beeld.`,
      }),
    ]),
  ),
  ...Object.fromEntries(
    drops.map((drop) => [
      drop.image,
      image(drop.image, `/images/drops/${drop.slug}.webp`, wide, {
        alt: `Sfeerbeeld van de drop ${drop.name}`,
        label: `Drop ${drop.name}`,
        brief: `Liggend sfeerbeeld voor de droppagina van ${drop.name}, met de stukken van de drop.`,
      }),
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: photoStripCount }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      const key = `fotostrook.${n}`;
      return [
        key,
        image(key, `/images/fotostrook/${n}.webp`, square, {
          alt: `Sparkela gedragen, foto ${i + 1}`,
          label: `Fotostrook ${n}`,
          brief: "Eigen foto of klantfoto met schriftelijke toestemming, vierkant, één product duidelijk in beeld.",
        }),
      ];
    }),
  ),
};

const videoBriefs = [
  "Stack van drie armbanden aandoen, close-up van de pols.",
  "Chunky hoops stylen bij een wit shirt.",
  "Van kantoor naar date night: dezelfde outfit, andere sieraden.",
  "Festivallook met kleurige oorbellen en kralen.",
] as const;

const videos: Record<AssetKey, VideoAsset> = Object.fromEntries(
  videoBriefs.map((brief, i) => {
    const n = String(i + 1).padStart(2, "0");
    const key = `video.${n}`;
    const asset: VideoAsset = {
      key,
      src: `/videos/sparkela-${n}.mp4`,
      poster: `/videos/sparkela-${n}-poster.webp`,
      width: 1080,
      height: 1920,
      label: `Video ${n}`,
      brief: `${brief} Staand 9:16, H.264.`,
    };
    return [key, asset];
  }),
);

export const assets: AssetManifest = { images, videos };

/** Keys whose file is in public/. Add a key only after the file is at its `src` (brief §5: no photos of others). */
export const SUPPLIED: ReadonlySet<AssetKey> = new Set<AssetKey>([]);
