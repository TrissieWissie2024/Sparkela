import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Default "div". Pages never render their own <main> (plan §4.6). */
  as?: "div" | "section" | "header" | "footer" | "nav" | "article" | "aside";
  className?: string;
  children?: ReactNode;
}

/**
 * Page width (plan §4.4): at most 1240 px, with a 20 px gutter on phones and 32 px from md. The frame measured on
 * CORVANE (docs/REFERENCE.md §2.1). Port of CORVANE components/ui/Container.tsx.
 */
export function Container({ as: Tag = "div", className, children, ...rest }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1240px] px-5 md:px-8", className)} {...rest}>
      {children}
    </Tag>
  );
}
