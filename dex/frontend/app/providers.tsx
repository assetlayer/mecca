"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { injected } from "wagmi/connectors";
import { assetLayerTestnet } from "@/lib/chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Only include safe, browser-native connectors at build time to avoid SSR issues
const connectors = [injected({ shimDisconnect: true })];

const config = createConfig({
  chains: [assetLayerTestnet],
  transports: {
    [assetLayerTestnet.id]: http(assetLayerTestnet.rpcUrls.default.http[0]),
  },
  connectors,
  // Disable SSR integration to prevent server from evaluating browser-only storage (e.g. indexedDB)
  ssr: false,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
