import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/catalog";

export function GET() {
  return NextResponse.json(CATALOG);
}
