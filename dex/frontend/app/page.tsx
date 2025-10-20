"use client";

import V3SwapBox from "@/components/V3SwapBox";
import { ConnectButton } from "@/components/Connect";

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 gap-10 bg-background">
      <header className="w-full max-w-5xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">AssetLayer Swap</h1>
          <p className="text-gray-400 max-w-xl">
            Swap ERC-20 tokens on the AssetLayer Testnet using our custom V3-style pool implementation.
          </p>
        </div>
        <ConnectButton />
      </header>
      
      <V3SwapBox />
      
      <footer className="text-xs text-gray-500">
        Simple V3 Pool · AssetLayer Testnet · Chain ID 621030
      </footer>
    </main>
  );
}
