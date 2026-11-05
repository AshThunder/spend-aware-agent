import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const path = ".env.local";
const current = existsSync(path) ? readFileSync(path, "utf8") : "";

function ensure(name: string, make: () => string) {
  if (new RegExp(`^${name}=`, "m").test(current)) return null;
  return `${name}=${make()}`;
}

const agent = Ed25519Keypair.generate();
const seller = Ed25519Keypair.generate();

const lines = [
  ensure("AGENT_SECRET_KEY", () => agent.getSecretKey()),
  ensure("SELLER_SECRET_KEY", () => seller.getSecretKey()),
].filter(Boolean);

if (lines.length) {
  writeFileSync(path, current + (current && !current.endsWith("\n") ? "\n" : "") + lines.join("\n") + "\n");
}

const env = readFileSync(path, "utf8");
const get = (n: string) => env.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1] ?? "";
console.log("agent :", Ed25519Keypair.fromSecretKey(get("AGENT_SECRET_KEY")).toSuiAddress());
console.log("seller:", Ed25519Keypair.fromSecretKey(get("SELLER_SECRET_KEY")).toSuiAddress());
