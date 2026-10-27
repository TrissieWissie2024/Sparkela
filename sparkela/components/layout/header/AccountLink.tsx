import { User } from "lucide-react";

import { chromeCopy } from "@/content/copy/chrome";
import { Button } from "@/components/ui/Button";

/**
 * The account icon link in the header (docs/PLAN.md §13.5): 44 px, "Account", to /account (the proxy forwards it to
 * Shopify's customer accounts once SHOPIFY_CUSTOMER_ACCOUNT_URL is set). Below 380 px (xs) the header hides it; the
 * mobile menu has Account too (decision 83).
 */
export function AccountLink({ className }: { className?: string }) {
  return (
    <Button href="/account" variant="ghost" iconOnly size="sm" aria-label={chromeCopy.header.account} className={className}>
      <User aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />
    </Button>
  );
}
