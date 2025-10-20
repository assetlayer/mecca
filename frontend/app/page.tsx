"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTokenList } from "@/lib/tokens";
import { SwapBox } from "@/components/SwapBox";
import { ConnectButton } from "@/components/Connect";

export default function Page() {
  const { data: tokens = [], isLoading } = useQuery({ queryKey: ["token-list"], queryFn: fetchTokenList });

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 gap-10 bg-background">
      <header className="w-full max-w-5xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">AssetLayer Swap</h1>
          <p className="text-gray-400 max-w-xl">
            Swap ERC-20 tokens on the AssetLayer Testnet via a custom Uniswap v4 router with protocol fees collected through a hook.
          </p>
        </div>
        <ConnectButton />
      </header>
      <SwapBox tokens={tokens} isLoading={isLoading} />
      <footer className="text-xs text-gray-500">
        Uniswap v4 · Hooked protocol fee router · Chain ID 621030
      </footer>
    </main>
  );
}
