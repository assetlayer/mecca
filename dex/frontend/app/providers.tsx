"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { injected } from "wagmi/connectors";
import { createWeb3Modal } from "@web3modal/wagmi/react";

import { assetLayerTestnet } from "@/lib/chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id";

const chains = [assetLayerTestnet] as const;
const transports = {
  [assetLayerTestnet.id]: http(assetLayerTestnet.rpcUrls.default.http[0]),
};

const metadata = {
  name: "MECCA DEX",
  description: "Swap pools with the MECCA DEX",
  url: "https://mecca.so",
  icons: ["https://mecca.so/favicon.ico"],
};

// Create wagmi config
const wagmiConfig = createConfig({
  chains,
  transports,
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
});

// Create web3modal (v5 API) - called at module level
createWeb3Modal({
  wagmiConfig,
  projectId,
  themeMode: "dark",
  themeVariables: {
    "--w3m-font-family": "inherit",
    "--w3m-accent": "#6366f1",
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
