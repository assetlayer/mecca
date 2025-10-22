"use client";

import V3SwapBox from "@/components/V3SwapBox";
import { ConnectButton } from "@/components/Connect";

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-6 gap-10 bg-background">
      <header className="w-full max-w-5xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* MECCA Logo */}
          <img 
            src="/logo.png" 
            alt="MECCA Logo" 
            className="w-32 h-32 object-contain"
          />
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
