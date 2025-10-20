"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { walletConnect, injected } from "wagmi/connectors";
import { assetLayerTestnet } from "@/lib/chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors = [injected({ shimDisconnect: true })];

if (projectId) {
  connectors.push(walletConnect({ projectId, showQrModal: true }));
}

const config = createConfig({
  chains: [assetLayerTestnet],
  transports: {
    [assetLayerTestnet.id]: http(assetLayerTestnet.rpcUrls.default.http[0]),
  },
  connectors,
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
