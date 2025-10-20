# AssetLayer Uniswap v4 DEX

This monorepo contains a full-stack decentralized exchange powered by Uniswap v4 hooks and deployed to the AssetLayer Testnet. It consists of a Hardhat contracts workspace and a Next.js front-end built with wagmi, viem, Tailwind CSS, Zustand, and Zod.

## Project structure

```
pnpm-workspace.yaml
contracts/       # Hardhat + Solidity contracts (hook + minimal router)
frontend/        # Next.js app with custom swap UI
```

## Getting started

1. Copy the environment template and fill in secrets/addresses:

   ```bash
   cp frontend/.env.local.example contracts/.env
   cp frontend/.env.local.example frontend/.env.local
   ```

   Update `POOL_MANAGER_ADDRESS`, `NEXT_PUBLIC_POOL_MANAGER_ADDRESS`, `PROTOCOL_FEE_RECIPIENT`, and `PROTOCOL_FEE_E6` as needed.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Compile the contracts:

   ```bash
   cd contracts
   pnpm hardhat compile
   ```

4. Deploy the hook and router to the AssetLayer Testnet (requires `PRIVATE_KEY` in `contracts/.env`):

   ```bash
   pnpm hardhat run --network assetlayer scripts/deployHook.ts
   pnpm hardhat run --network assetlayer scripts/deployRouter.ts
   ```

   Deployment scripts automatically write the resulting addresses to `frontend/lib/addresses.json` for the swap UI.

5. Run the front-end:

   ```bash
   cd ../frontend
   pnpm dev
   ```

## Front-end features

- Wallet connection via injected wallets and WalletConnect (wagmi + viem).
- Automatic token list loading from `NEXT_PUBLIC_TOKEN_LIST_URL`.
- Custom swap box with approve → quote → swap flow, including slippage controls and protocol fee display.
- Transaction toast with explorer link for submitted swaps and approvals.

## Contracts

- `AssetLayerSwapHook.sol`: Uniswap v4 hook charging a protocol fee (parts-per-million) and forwarding it to a configured recipient.
- `MinimalSwapRouterV4.sol`: Minimal router integrating with the PoolManager and hook to perform exact-input/exact-output swaps and emit execution events.

## Scripts

- `deployHook.ts`: Deploys the hook contract and stores the address for the front-end.
- `deployRouter.ts`: Deploys the minimal router, wiring it to the existing PoolManager and persisting the address for the UI.

## Tooling

- Hardhat + ethers v6
- TypeScript across contracts and front-end
- Tailwind CSS with custom dark theme

Ensure you are connected to the AssetLayer Testnet (chain ID 621030) before interacting with the swap UI.
