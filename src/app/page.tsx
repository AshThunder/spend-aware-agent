import { SOURCES } from "@/lib/sources";
import { EXAMPLE_QUESTIONS } from "@/lib/topics";
import Dashboard from "./dashboard";

export default function Home() {
  const catalog = SOURCES.map(({ id, name, priceUsd, topics, pitch }) => ({ id, name, priceUsd, topics, pitch }));
  return <Dashboard catalog={catalog} examples={EXAMPLE_QUESTIONS} />;
}
