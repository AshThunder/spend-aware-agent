import type { Metadata } from "next";
import { EXAMPLE_QUESTIONS } from "@/lib/topics";
import Dashboard from "../dashboard";

export const metadata: Metadata = {
  title: "Console",
};

export default function ConsolePage() {
  return <Dashboard examples={EXAMPLE_QUESTIONS} />;
}
