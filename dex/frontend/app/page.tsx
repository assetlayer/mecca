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
          
          <footer className="text-xs text-gray-500 flex flex-col items-center gap-2">
            <img 
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/AssetLayer-6-nqSNbwAjsnMlm3a6fQLbXiaCxZcPcR.png" 
              alt="AssetLayer Logo" 
              className="h-16 w-auto"
            />
            <span>© 2025 AssetLayer Foundation</span>
          </footer>
        </main>
      </div>
    </LayoutWrapper>
  );
}
