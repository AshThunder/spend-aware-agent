import "server-only";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { ChannelCredentials } from "@grpc/grpc-js";
import { IS_MAINNET, TATUM_GRPC_HOST, tatumApiKey } from "./config";

let client: SuiGrpcClient | undefined;

// Tatum's Sui gateway speaks native gRPC (not gRPC-web), so the default SuiGrpcClient transport can't be used.
export function tatumSui(): SuiGrpcClient {
  client ??= new SuiGrpcClient({
    network: IS_MAINNET ? "mainnet" : "testnet",
    transport: new GrpcTransport({
      host: TATUM_GRPC_HOST,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": tatumApiKey() },
    }),
  });
  return client;
}

export async function usdcBalance(address: string, coinType: string): Promise<number> {
  const { balance } = await tatumSui().getBalance({ owner: address, coinType });
  return Number(balance.balance) / 1e6;
}
