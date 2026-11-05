import "server-only";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { UnaryCall, type RpcInterceptor } from "@protobuf-ts/runtime-rpc";
import { ChannelCredentials } from "@grpc/grpc-js";
import { IS_MAINNET, TATUM_GRPC_HOST, tatumApiKey } from "./config";

// Tatum's free plan allows 3 requests per second per key; bursts beyond that get HTTP 429.
const MAX_PER_WINDOW = 3;
const WINDOW_MS = 1100;
const MAX_ATTEMPTS = 5;

const sent: number[] = [];

async function takeSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (sent.length && now - sent[0] >= WINDOW_MS) sent.shift();
    if (sent.length < MAX_PER_WINDOW) {
      sent.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, WINDOW_MS - (now - sent[0]) + 5));
  }
}

const isRateLimited = (e: unknown) => e instanceof Error && e.message.includes("429");

const throttle: RpcInterceptor = {
  interceptUnary(next, method, input, options) {
    const result = (async () => {
      for (let attempt = 1; ; attempt++) {
        await takeSlot();
        const call = next(method, input, options);
        try {
          const [headers, response, status, trailers] = await Promise.all([
            call.headers,
            call.response,
            call.status,
            call.trailers,
          ]);
          return { headers, response, status, trailers };
        } catch (e) {
          if (!isRateLimited(e) || attempt >= MAX_ATTEMPTS) throw e;
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    })();
    const part = <T>(pick: (r: Awaited<typeof result>) => T) => {
      const p = result.then(pick);
      p.catch(() => {});
      return p;
    };
    return new UnaryCall(
      method,
      options.meta ?? {},
      input,
      part((r) => r.headers),
      part((r) => r.response),
      part((r) => r.status),
      part((r) => r.trailers),
    );
  },
};

let client: SuiGrpcClient | undefined;

// Tatum's Sui gateway speaks native gRPC (not gRPC-web), so the default SuiGrpcClient transport can't be used.
export function tatumSui(): SuiGrpcClient {
  client ??= new SuiGrpcClient({
    network: IS_MAINNET ? "mainnet" : "testnet",
    transport: new GrpcTransport({
      host: TATUM_GRPC_HOST,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": tatumApiKey() },
      interceptors: [throttle],
    }),
  });
  return client;
}

export async function usdcBalance(address: string, coinType: string): Promise<number> {
  const { balance } = await tatumSui().getBalance({ owner: address, coinType });
  return Number(balance.balance) / 1e6;
}
