import type { Stack } from "@/lib/types";

/**
 * Linde's ready-made stacks of three (docs/PLAN.md §5.5, brief §4). Rule (tested): exactly 3 handles, all of type
 * oorbellen or armbanden, all in the catalog. A stack with a dropSlug is only visible while that drop is publicly
 * live. "Voeg de stack toe" adds the three pieces; the stack discount applies by itself.
 */
export const stacks: Stack[] = [
  {
    slug: "goud-en-gedurfd",
    name: "Goud en gedurfd",
    description: "Chunky hoops met een schakelarmband en een brede bangle. Veel goud, nul twijfel.",
    productHandles: ["lola-chunky-hoops", "tess-schakelarmband", "roos-brede-bangle"],
    image: "stacks.goud-en-gedurfd",
  },
  {
    slug: "kleur-op-je-pols",
    name: "Kleur op je pols",
    description: "Kleurige oorbellen, kralen om je pols en een schelpje erbij. Zomer, het hele jaar door.",
    productHandles: ["mila-color-pop", "lieke-kralenarmband", "sam-schelp-oorbellen"],
    image: "stacks.kleur-op-je-pols",
  },
  {
    slug: "kantoor-maar-niet-saai",
    name: "Kantoor maar niet saai",
    description: "Dikke ringetjes, een dun armbandje en een schakel. Net genoeg spark voor een werkdag.",
    productHandles: ["noor-dikke-ringetjes", "ivy-dun-armbandje", "tess-schakelarmband"],
    image: "stacks.kantoor-maar-niet-saai",
  },
  {
    slug: "holiday-stack",
    name: "Holiday stack",
    description: "Sterretjes, glitter en een sparkle armband. Klaar voor elk kerstfeest.",
    productHandles: ["holiday-ster-oorbellen", "holiday-glitter-hoops", "holiday-sparkle-armband"],
    image: "stacks.holiday-stack",
    dropSlug: "holiday-sparkle",
  },
];
