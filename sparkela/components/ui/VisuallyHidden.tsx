import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Default "span", so it fits inside any phrasing content. */
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4" | "label";
  children?: ReactNode;
}

/** Off screen, but read by screen readers (Tailwind `sr-only`). Port of CORVANE components/ui/VisuallyHidden.tsx. */
export function VisuallyHidden({ as: Tag = "span", className, children, ...rest }: VisuallyHiddenProps) {
  return (
    <Tag className={cn("sr-only", className)} {...rest}>
      {children}
    </Tag>
  );
}
