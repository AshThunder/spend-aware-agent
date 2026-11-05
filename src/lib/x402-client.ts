import "server-only";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactSuiScheme } from "@tentaclepay/sui-x402/exact/client";
import { createSuiClientRegistry, type ClientSuiSigner } from "@tentaclepay/sui-x402";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { fromBase64 } from "@mysten/sui/utils";
import { IS_MAINNET, NETWORK, TATUM_RPC_URL, agentKeypair, tatumApiKey } from "./config";

let cached: { pay: typeof fetch; http: x402HTTPClient; address: string } | undefined;

export function agentPayments() {
  if (cached) return cached;
  const keypair = agentKeypair();
  const signer: ClientSuiSigner = {
    address: keypair.toSuiAddress() as `0x${string}`,
    signTransaction: async (bytes) => (await keypair.signTransaction(fromBase64(bytes))).signature,
  };

  const registry = createSuiClientRegistry();
  if (process.env.TATUM_GRPC !== "0") {
    registry.set(
      NETWORK,
      new SuiGrpcClient({
        network: IS_MAINNET ? "mainnet" : "testnet",
        baseUrl: TATUM_RPC_URL,
        meta: { "x-api-key": tatumApiKey() },
      }),
    );
  }

  const client = new x402Client().register(NETWORK, new ExactSuiScheme(signer, { clientRegistry: registry }));
  cached = { pay: wrapFetchWithPayment(fetch, client), http: new x402HTTPClient(client), address: signer.address };
  return cached;
}
