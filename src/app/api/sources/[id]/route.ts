import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { NETWORK, sellerAddress } from "@/lib/config";
import { getSource } from "@/lib/sources";
import { resourceServer } from "@/lib/x402-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  const source = getSource(id);
  if (!source) return NextResponse.json({ error: "unknown source" }, { status: 404 });

  const handler = async (req: NextRequest): Promise<NextResponse> => {
    const params = req.nextUrl.searchParams;
    try {
      const facts = await source.fetch({
        address: params.get("address") ?? undefined,
        coinType: params.get("coinType") ?? undefined,
      });
      return NextResponse.json({ source: source.id, servedAt: new Date().toISOString(), facts });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  };

  const paid = withX402(
    handler,
    {
      accepts: { scheme: "exact", price: `$${source.priceUsd}`, network: NETWORK, payTo: sellerAddress() },
      description: `${source.name}: ${source.pitch}`,
      mimeType: "application/json",
    },
    resourceServer(),
  );
  return paid(request);
}
