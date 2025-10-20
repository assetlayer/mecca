# AssetLayer Uniswap v4 DEX

This monorepo contains a full-stack decentralized exchange powered by Uniswap v4 hooks and deployed to the AssetLayer Testnet. It consists of a Hardhat contracts workspace and a Next.js front-end built with wagmi, viem, Tailwind CSS, Zustand, and Zod.

## Project structure

```
dex/
  pnpm-workspace.yaml
  contracts/       # Hardhat + Solidity contracts (hook + minimal router)
  frontend/        # Next.js app with custom swap UI
```

## Getting started

1. Copy the environment template and fill in secrets/addresses:

   ```bash
   cp dex/frontend/.env.local.example dex/contracts/.env
   cp dex/frontend/.env.local.example dex/frontend/.env.local
   ```

   Update `POOL_MANAGER_ADDRESS`, `NEXT_PUBLIC_POOL_MANAGER_ADDRESS`, `PROTOCOL_FEE_RECIPIENT`, and `PROTOCOL_FEE_E6` as needed. The Pool Manager deployment script (described below) respects the optional `POOL_MANAGER_OWNER`, `POOL_MANAGER_PROTOCOL_FEE_CONTROLLER`, and `POOL_MANAGER_INITIAL_TIMESTAMP` variables when you need to customize ownership or protocol-fee governance.

2. Install dependencies:

   ```bash
   cd dex
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

## Obtaining a PoolManager address

The contracts in this monorepo build on top of an existing Uniswap v4 `PoolManager`. If you do not already have one, you can deploy the core contract alongside this project:

1. Install dependencies (from the `dex/` workspace):

   ```bash
   pnpm install
   ```

2. Compile the Uniswap v4 contracts:

   ```bash
   cd dex/contracts
   pnpm hardhat compile
   ```

3. (Optional) Customize ownership and governance. By default the deployer becomes both the owner and the protocol-fee controller and the contract boots with an initial block timestamp of `0`. Override those defaults by exporting any of these variables before deployment:

   ```bash
   export POOL_MANAGER_OWNER=0xYourMultisig
   export POOL_MANAGER_PROTOCOL_FEE_CONTROLLER=0xYourController
   export POOL_MANAGER_INITIAL_TIMESTAMP=0
   ```

4. Deploy the Pool Manager to the AssetLayer Testnet (requires `PRIVATE_KEY` in `dex/contracts/.env`):

   ```bash
   pnpm hardhat run --network assetlayer scripts/deployPoolManager.ts
   ```

   The script infers sensible defaults for any of the optional environment variables you leave unset, prints the deployed address, and stores it in `dex/frontend/lib/addresses.json` alongside the hook and router addresses.

5. Copy the printed address into both `POOL_MANAGER_ADDRESS` and `NEXT_PUBLIC_POOL_MANAGER_ADDRESS` inside your `.env` files before running the hook and router deployments shown earlier.

With the Pool Manager deployed and the environment configured, the remaining deployment scripts can target the same address to complete the setup.
