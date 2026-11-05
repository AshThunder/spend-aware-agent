import "server-only";
import { TATUM_RPC_URL, tatumApiKey } from "./config";

let nextId = 1;

export async function suiRpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(TATUM_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": tatumApiKey() },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Tatum ${method} failed: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`Tatum ${method} failed: ${body.error.message}`);
  return body.result as T;
}

export async function usdcBalance(address: string, coinType: string): Promise<number> {
  const r = await suiRpc<{ totalBalance: string }>("suix_getBalance", [address, coinType]);
  return Number(r.totalBalance) / 1e6;
}
