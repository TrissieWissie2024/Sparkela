"use client";

import type { ReactNode } from "react";

import type { IsoDateTime } from "@/lib/types";

import { TimeSwitch } from "./TimeSwitch";

/**
 * A TimeSwitch with one boundary (plan §10.5): `before` until `at`, `after` from `at`. `at` is a literal ISO time with
 * an offset from content (site.vat.switchAt, a drop's startsAt), never computed. An unparseable `at` never switches,
 * so `before` stays (fail closed).
 */
export function TimeGate({
  at,
  before,
  after,
  as,
  className,
}: {
  at: IsoDateTime;
  before: ReactNode;
  after: ReactNode;
  as?: "div" | "span";
  className?: string;
}) {
  return <TimeSwitch boundaries={[Date.parse(at)]} variants={[before, after]} as={as} className={className} />;
}
