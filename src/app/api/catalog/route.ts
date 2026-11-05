import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/sources";

export function GET() {
  return NextResponse.json(
    SOURCES.map(({ id, name, priceUsd, topics, pitch }) => ({ id, name, priceUsd, topics, pitch })),
  );
}
