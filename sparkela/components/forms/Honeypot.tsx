import { formsCopy } from "@/content/copy/forms";

/**
 * The honeypot of every form (docs/PLAN.md §13.13, §15.1): a text field named `website`, off screen and hidden from
 * assistive technology (aria-hidden, tabIndex -1, autoComplete off). People never fill it in; a bot that does gets a
 * believable success from the route and nothing happens. Forms read it from the form element on submit
 * (`new FormData(form).get("website")`). A plain component without hooks, so it renders on the server and inside
 * client forms alike.
 */
export function Honeypot({ name = "website" }: { name?: "website" }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        {formsCopy.honeypot.label}
        <input type="text" name={name} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/** The honeypot value of a submitted form ("" when the field is missing). */
export function honeypotValue(form: HTMLFormElement | null): string {
  if (!form) return "";
  const value = new FormData(form).get("website");
  return typeof value === "string" ? value : "";
}
