"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Product page choices per handle for the visit (docs/PLAN.md §13.9; CORVANE components/pdp/PdpStateProvider.tsx,
 * rewritten for variants, the stack and gift wrap). Mounted once in app/(shop)/products/layout.tsx, which stays
 * mounted while the visitor moves between product pages, so a chosen colour, the stack picks and the gift wrap tick
 * are still there when they come back to a piece. In memory only: a reload starts from the defaults (no storage, no
 * hydration difference: the server and the first client render both see "nothing chosen").
 *
 * Only explicit choices are stored. Nothing stored means the defaults: defaultVariant() of the product, "Los" and no
 * gift wrap. Components read a choice with usePdpChoice(handle) and fall back to their own default.
 */

/** "Los", or the stack of three with the two picked pieces as VARIANT ids (plan §13.9, decision 129). */
export type StackChoice = { mode: "los" } | { mode: "stack"; picks: [string, string] };

/** What the visitor chose on one product page; every field is optional (absent = the default). */
export interface PdpChoice {
  variantId?: string;
  stack?: StackChoice;
  giftWrap?: boolean;
}

export interface PdpStateValue {
  /** The stored choice of a product (an empty object when nothing was chosen). */
  choiceFor(handle: string): PdpChoice;
  /** Merges a change into the choice of a product. */
  update(handle: string, change: PdpChoice): void;
}

const EMPTY: PdpChoice = Object.freeze({});

const PdpStateContext = createContext<PdpStateValue | null>(null);

export interface PdpStateProviderProps {
  children: ReactNode;
  /** Starting choices per handle (tests and previews). */
  initial?: Record<string, PdpChoice>;
}

export function PdpStateProvider({ children, initial }: PdpStateProviderProps) {
  const [choices, setChoices] = useState<Record<string, PdpChoice>>(() => ({ ...initial }));

  const update = useCallback((handle: string, change: PdpChoice) => {
    setChoices((current) => {
      const previous = current[handle] ?? EMPTY;
      const next = { ...previous, ...change };
      const same =
        next.variantId === previous.variantId &&
        next.giftWrap === previous.giftWrap &&
        sameStack(next.stack, previous.stack);
      return same ? current : { ...current, [handle]: next };
    });
  }, []);

  const value = useMemo<PdpStateValue>(
    () => ({
      choiceFor: (handle) => choices[handle] ?? EMPTY,
      update,
    }),
    [choices, update],
  );

  return <PdpStateContext value={value}>{children}</PdpStateContext>;
}

function sameStack(a: StackChoice | undefined, b: StackChoice | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.mode !== b.mode) return false;
  if (a.mode === "los" || b.mode === "los") return true;
  return a.picks[0] === b.picks[0] && a.picks[1] === b.picks[1];
}

/** The provider, or null outside it (ProductSpecs then follows its `variantId` prop). */
export function useOptionalPdpState(): PdpStateValue | null {
  return useContext(PdpStateContext);
}

/**
 * The choice of one product and a setter. Outside the provider (a component test, a page without the products
 * layout) the choices live in local state instead, so the buy box still works.
 */
export function usePdpChoice(handle: string): [PdpChoice, (change: PdpChoice) => void] {
  const shared = useContext(PdpStateContext);
  const [local, setLocal] = useState<PdpChoice>(EMPTY);
  const setShared = shared?.update;
  const update = useCallback(
    (change: PdpChoice) => {
      if (setShared) setShared(handle, change);
      else setLocal((current) => ({ ...current, ...change }));
    },
    [handle, setShared],
  );
  return [shared ? shared.choiceFor(handle) : local, update];
}
