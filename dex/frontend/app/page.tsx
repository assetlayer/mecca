"use client";

import V3SwapBox from "@/components/V3SwapBox";
import { Navigation } from "@/components/Navigation";
import LayoutWrapper from "@/components/LayoutWrapper";

export default function Page() {
  return (
    <LayoutWrapper>
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        
        <main className="flex-1 flex flex-col items-center px-6 py-10 gap-10">
          <V3SwapBox />
          
          <footer className="text-xs text-gray-500">
            Simple V3 Pool · AssetLayer Testnet · Chain ID 621030
          </footer>
        </main>
      </div>
    </LayoutWrapper>
  );
}
