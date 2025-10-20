import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_ASSETLAYER_RPC_URL || "https://rpc-test.assetlayer.org/GR5Yv0OFarUAgowmDA4V/ext/bc/m1cxPWPsTFfZdsp2sizU4Vny1oCgqsVdKPdrFcb6VLsW1kGfz/rpc";
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 621030);
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || "AssetLayer Testnet";
const blockExplorerName = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_NAME || "AssetLayer Explorer";
const blockExplorerUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://explorer-test.assetlayer.org";
const nativeCurrencyName = process.env.NEXT_PUBLIC_NATIVE_CURRENCY_NAME || "AssetLayer";
const nativeCurrencySymbol = process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL || "ASL";

export const assetLayerTestnet = defineChain({
  id: chainId,
  name: chainName,
  network: "assetlayer-testnet",
  nativeCurrency: {
    name: nativeCurrencyName,
    symbol: nativeCurrencySymbol,
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: blockExplorerName, url: blockExplorerUrl },
  },
});

export const explorerUrl = blockExplorerUrl;
