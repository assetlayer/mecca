"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { injected } from "wagmi/connectors";
import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi/react";

import { assetLayerTestnet } from "@/lib/chain";

declare global {
  interface Window {
    __WEB3_MODAL_INITIALIZED__?: boolean;
  }
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const chains = [assetLayerTestnet];
const transports = {
  [assetLayerTestnet.id]: http(assetLayerTestnet.rpcUrls.default.http[0]),
};

const metadata = {
  name: "MECCA DEX",
  description: "Swap pools with the MECCA DEX",
  url: "https://mecca.so",
  icons: ["https://mecca.so/favicon.ico"],
};

const fallbackConfig = createConfig({
  chains,
  transports,
  connectors: [injected({ shimDisconnect: true })],
  ssr: false,
});

const wagmiConfig = projectId
  ? defaultWagmiConfig({
      chains,
      projectId,
      metadata,
      transports,
      ssr: false,
    })
  : fallbackConfig;

if (projectId && typeof window !== "undefined" && !window.__WEB3_MODAL_INITIALIZED__) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    chains,
    themeMode: "dark",
    themeVariables: {
      "--w3m-font-family": "inherit",
      "--w3m-accent": "#F5C249",
    },
  });
  window.__WEB3_MODAL_INITIALIZED__ = true;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
