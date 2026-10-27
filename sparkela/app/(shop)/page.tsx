import { site } from "@/content/site";

/**
 * Temporary home (docs/PLAN.md §20.2, wave 3a): only the H1 with the brand name, so the build has `○ /` and the
 * tokens and fonts can be checked. Wave 7-9 (D1) replaces this file with the real homepage (plan §14.1); from
 * wave 4-6 the (shop) layout wraps it in ShopChrome, which renders <main>. Pages never render their own <main>.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-1 items-center px-5 py-16 md:px-8">
      <h1 className="font-display text-[2rem] leading-[1.1] font-extrabold tracking-[-0.01em] md:text-[2.5rem] lg:text-[3rem]">
        {site.name}
      </h1>
    </div>
  );
}
