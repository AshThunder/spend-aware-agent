# An agent that stops paying for data it already learned was useless

Spend-Aware Agent is a research agent for Sui. You ask about the network, a validator set, a token, or a wallet. It buys the data per request, scores what the purchase actually added, and writes that verdict to Walrus Memory. The next time the question comes up, it skips the sources that did not deliver.

It is live at [spend-aware-agent.vercel.app](https://spend-aware-agent.vercel.app). The code is at [github.com/AshThunder/spend-aware-agent](https://github.com/AshThunder/spend-aware-agent). This is a project for the Total Recall hackathon (Tatum × Walrus Memory), on the Smart Agents for Real Life track.

## The gap

x402 makes it easy for an agent to pay for an API. It does not make the agent careful. A stateless agent pays the same seller again on the next run, including the seller that returned nothing useful. The missing piece is a memory of the purchase, not of the answer.

## What one run does

1. **Recall.** Before spending, the agent reads Walrus Memory for this topic.
2. **Plan.** A source with no history is bought once, so the agent can learn it. A source whose average usefulness is under 0.25 is skipped, with the reason written out. A source that proved useful is bought only if the budget still covers it and the facts are not already in hand. Verdicts older than seven days are tested again.
3. **Pay.** Each source is an HTTP route that answers `402 Payment Required`. The agent pays with the x402 exact scheme on Sui mainnet, in native USDC, through the Tentacle Pay facilitator. Payments under $0.01 have their gas sponsored, so the agent wallet holds USDC and no SUI.
4. **Score.** Usefulness is the share of required facts that this purchase added and cheaper purchases had not already covered. It is a number from 0 to 1, computed from the response, not from an LLM.
5. **Remember.** One evaluation per purchase is written to Walrus Memory on mainnet and linked from the console.

The chain data behind every honest source is read through Tatum's Sui gRPC gateway (`sui-mainnet-grpc.gateway.tatum.io`). That same client builds the payment transactions.

## A measured run

The question was "How healthy is the Sui network right now?"

| Run | Bought | Skipped from memory | Spent |
| --- | --- | --- | --- |
| First, empty memory | Chain Pulse ($0.002), Staking Scope ($0.005), Alpha Wire ($0.008), Chain Pulse Pro ($0.009) | none | $0.024 |
| Second | Chain Pulse | Staking Scope, Alpha Wire, Chain Pulse Pro | $0.002 |

Chain Pulse returned the checkpoint, its age, total transactions, the reference gas price, and the epoch. Staking Scope and Chain Pulse Pro repeated facts the agent already had. Alpha Wire claims every topic and returns no verifiable data. It exists so the agent has something it should learn to refuse.

One of the first payments is [this Sui transaction](https://suivision.xyz/txblock/BZn9aFKsvx49GYzcEVn9vDjLH9R2SmPqUL2yWZkCEKL9). The second-run payment, Chain Pulse only, is [this one](https://suivision.xyz/txblock/12jfN8RbNWGu83ECocGkH52LHKeGBsVNYk6KCk4D7FQJ).

The same pattern showed up on staking, token, and wallet questions. The first pass explores. The second pass buys the source that scored well and names the ones it will not pay again.

## What is honest about the demo

The agent and the data sellers are both wallets in this project, so the USDC moves from one demo wallet to the other. The settlements are still real x402 payments on Sui mainnet. Scoring is deterministic on purpose: a judge can see why a source was kept or skipped. With the default Walrus Memory relayer, the relayer can see the evaluation text. Those evaluations contain source names, prices, and scores, not personal data.

The console is at [spend-aware-agent.vercel.app/console](https://spend-aware-agent.vercel.app/console).
