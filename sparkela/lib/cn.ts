import { clsx, type ClassValue } from "clsx";

/** Joins class names, skipping falsy values (port of CORVANE lib/cn.ts). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
