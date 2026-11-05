import "server-only";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/next";
import { ExactSuiScheme } from "@tentaclepay/sui-x402/exact/server";
import { FACILITATOR_URL, NETWORK } from "./config";

let server: x402ResourceServer | undefined;

export function resourceServer() {
  server ??= new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL })).register(
    NETWORK,
    new ExactSuiScheme(),
  );
  return server;
}
