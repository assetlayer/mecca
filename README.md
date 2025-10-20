# AssetLayer V3 DEX

This monorepo contains a full-stack decentralized exchange powered by a custom V3-style pool implementation deployed to the AssetLayer Testnet. It consists of a Hardhat contracts workspace and a Next.js front-end built with wagmi, viem, Tailwind CSS, and ethers.js.

## Project structure

```
dex/
  pnpm-workspace.yaml
  contracts/       # Hardhat + Solidity contracts (V3 pool)
  frontend/        # Next.js app with custom swap UI
```

## Getting started

1. Copy the environment template and fill in secrets:

   ```bash
   cp dex/contracts/.env.example dex/contracts/.env
   cp dex/frontend/.env.local.example dex/frontend/.env.local
   ```

   Update the following variables in `dex/contracts/.env`:
   - `PRIVATE_KEY`: Your wallet private key for deployment
   - `SEED_TOKEN_A` and `SEED_TOKEN_B`: Token addresses for the pool
   - `SEED_AMOUNT_A` and `SEED_AMOUNT_B`: Initial liquidity amounts

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

4. Deploy the V3 pool to the AssetLayer Testnet:

   ```bash
   pnpm hardhat run --network assetlayer scripts/deployV3Pool.ts
   ```

   The deployment script automatically writes the pool address to `frontend/lib/addresses.json`.

5. Add initial liquidity to the pool:

   ```bash
   pnpm hardhat run --network assetlayer scripts/seedV3Pool.ts
   ```

6. Run the front-end:

   ```bash
   cd ../frontend
   pnpm dev
   ```

## Front-end features

- **Wallet connection** via injected wallets and WalletConnect (wagmi + viem)
- **Token selection** with WASL and AUSD tokens
- **Real-time swap quotes** using constant product formula
- **Slippage protection** with adjustable tolerance
- **Pool information** showing reserves and LP balance
- **Transaction handling** with approval and swap flows

## Contracts

- **`SimpleV3Pool.sol`**: A custom V3-style AMM pool implementing:
  - Constant product formula for pricing
  - Liquidity provision with LP tokens
  - Token swapping functionality
  - ERC20 interface for LP tokens

## Scripts

- **`deployV3Pool.ts`**: Deploys the V3 pool contract
- **`seedV3Pool.ts`**: Adds initial liquidity to the pool
- **`swapV3Pool.ts`**: Tests swap functionality
- **`testSmallSwap.ts`**: Tests small swaps for verification

## Available Commands

```bash
# Deploy V3 pool
pnpm run deploy:v3-pool

# Add liquidity to pool
pnpm run seed:v3-pool

# Test swap functionality
pnpm run test:swap
```

## Tooling

- **Hardhat** + ethers v6 for contract development
- **TypeScript** across contracts and front-end
- **Tailwind CSS** with custom dark theme
- **Next.js 14** with App Router
- **Wagmi** for wallet integration

## Network Configuration

Ensure you are connected to the **AssetLayer Testnet** (chain ID 621030) before interacting with the swap UI.

### AssetLayer Testnet Details:
- **Chain ID**: 621030
- **RPC URL**: https://rpc-test.assetlayer.org/GR5Yv0OFarUAgowmDA4V/ext/bc/m1cxPWPsTFfZdsp2sizU4Vny1oCgqsVdKPdrFcb6VLsW1kGfz/rpc
- **Explorer**: https://explorer-test.assetlayer.org
- **Native Currency**: ASL (AssetLayer)

## Pool Information

The V3 pool supports trading between:
- **WASL** (Wrapped ASL) - 6 decimals
- **AUSD** (Asset USD) - 18 decimals

Current pool address: `0xC8C6Ac9aE1063BdcFAebb780168Eb70562626991`

## Development

### Prerequisites
- Node.js v18.17.0 or higher
- pnpm package manager
- Wallet with AssetLayer Testnet ASL tokens

### Environment Variables

**Contracts (.env):**
```bash
NEXT_PUBLIC_ASSETLAYER_RPC_URL=https://rpc-test.assetlayer.org/...
NEXT_PUBLIC_CHAIN_ID=621030
PRIVATE_KEY=your_private_key_here
SEED_TOKEN_A=0x2e83297970aBdc26691432bB72Cb8e19c8818b11
SEED_TOKEN_B=0x5bF0980739B073811b94Ad9e21Bce8C04dcc778b
SEED_AMOUNT_A=1000
SEED_AMOUNT_B=1000
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_ASSETLAYER_RPC_URL=https://rpc-test.assetlayer.org/...
NEXT_PUBLIC_CHAIN_ID=621030
NEXT_PUBLIC_CHAIN_NAME=AssetLayer Testnet
NEXT_PUBLIC_NATIVE_CURRENCY_NAME=AssetLayer
NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL=ASL
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=AssetLayer Explorer
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://explorer-test.assetlayer.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## Features

- ✅ **Working V3 Pool** - Fully functional AMM implementation
- ✅ **Token Swapping** - Real-time quotes and execution
- ✅ **Liquidity Provision** - Add/remove liquidity with LP tokens
- ✅ **Modern UI** - Clean, responsive interface
- ✅ **Wallet Integration** - MetaMask and WalletConnect support
- ✅ **AssetLayer Compatible** - Optimized for AssetLayer Testnet

## License

MIT