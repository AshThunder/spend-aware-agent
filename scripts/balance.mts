import { SuiGrpcClient } from "@mysten/sui/grpc";

const address = process.argv[2];
const client = new SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" });
const { balances } = await client.listBalances({ owner: address });
console.log(JSON.stringify(balances, null, 2));
