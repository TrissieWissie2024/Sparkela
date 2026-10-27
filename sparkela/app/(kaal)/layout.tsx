import type { ReactNode } from "react";

import { getServerNow } from "@/lib/server-clock";
import { FirstPaintMarker } from "@/components/layout/FirstPaintMarker";
import { ClockProvider } from "@/components/time/ClockProvider";
import { MiniFooter } from "@/components/prelaunch/MiniFooter";

/**
 * The bare layout of /wachtlijst and /nieuwsbrief/bevestigen (docs/PLAN.md §3.2, §14.20, decision 16): no header, no
 * cart, no popup. ClockProvider with the cached server clock (TimeGate on the waitlist), the page in
 * <main id="main" tabIndex={-1}> (the skip link's target) and the MiniFooter with the withdrawal link. Reads no cookies,
 * headers or search params, so both pages stay static.
 */
export default async function KaalLayout({ children }: { children: ReactNode }) {
  return (
    <ClockProvider serverNow={await getServerNow()}>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col bg-donker focus:outline-none">
        <FirstPaintMarker />
        {children}
      </main>
      <MiniFooter />
    </ClockProvider>
  );
}
