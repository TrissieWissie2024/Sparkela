"use client";

import { useCartAnnouncement } from "./useCart";

/**
 * The cart's live region (docs/PLAN.md §7.4, §13.7, §18.3 point 14): the latest message from sharedCopy.announce
 * ("Toegevoegd: …", "Verwijderd: …", "…: aantal 2", "Dat lukte niet. Probeer het opnieuw."). Always in the DOM and
 * visually hidden; CartProvider renders it once. The keyed span makes a repeated message be read again. A modal
 * drawer keeps it audible: Radix's aria-hidden leaves elements with aria-live alone.
 */
export function CartAnnouncer() {
  const announcement = useCartAnnouncement();
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement ? <span key={announcement.id}>{announcement.text}</span> : null}
    </div>
  );
}
