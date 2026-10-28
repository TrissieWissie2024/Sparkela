import { chromeCopy } from "@/content/copy/chrome";
import { site } from "@/content/site";

/**
 * The company details of both footers (brief §6.16: name of the vof, address, KvK number and VAT id; plan §13.5):
 * one group per line, so a separator never hangs at a line end and the address never splits between two groups (QA
 * round 4: the MiniFooter ran them on as two long lines). The mail address is a standalone link with a 44 px target
 * around its text line (QA round 2), the line rhythm unchanged. For the donker footers (Footer, MiniFooter); the
 * caller gives the heading or group name. Server component.
 */
export function CompanyDetails({ className }: { className?: string }) {
  const copy = chromeCopy.footer;
  const { company } = site;
  return (
    <address className={["flex flex-col not-italic", className].filter(Boolean).join(" ")}>
      <span>
        {company.tradeName} · {company.legalName}
      </span>
      <span>{company.address}</span>
      <span>
        {copy.kvk(company.kvk)} · {copy.vatId(company.vatId)}
      </span>
      <span>
        <a
          href={`mailto:${site.email}`}
          className="relative text-tekst-op-donker underline underline-offset-4 before:absolute before:-inset-x-1 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] hover:decoration-2"
        >
          {site.email}
        </a>
      </span>
    </address>
  );
}
