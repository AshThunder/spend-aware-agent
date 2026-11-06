import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";
import { EXAMPLE_QUESTIONS } from "@/lib/topics";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "Console",
};

export default function ConsolePage() {
  const catalog = SOURCES.map(({ id, name, priceUsd, topics, pitch }) => ({ id, name, priceUsd, topics, pitch }));
  return <Dashboard catalog={catalog} examples={EXAMPLE_QUESTIONS} />;
}
