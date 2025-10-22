"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useAccount } from "wagmi";

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const { open } = useWeb3Modal();
  const { address, chain, isConnecting, isReconnecting } = useAccount();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return null;
  }

  const isLoading = isConnecting || isReconnecting;
  const truncatedAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : undefined;

  return (
    <div className="flex items-center gap-2">
      {address && chain && (
        <button
          type="button"
          onClick={() => open({ view: "Networks" })}
          className="px-3 py-2 text-sm rounded-xl border border-border bg-surface hover:border-accent transition"
        >
          {chain.name}
        </button>
      )}
      <button
        type="button"
        onClick={() => open({ view: address ? "Account" : "Connect" })}
        disabled={isLoading}
        className={clsx(
          "px-4 py-2 rounded-xl border transition",
          address
            ? "bg-surface border-border hover:border-accent"
            : "bg-accent text-white border-accent/80 hover:bg-accent/90",
          isLoading && "opacity-60 cursor-not-allowed"
        )}
      >
        {isLoading && "Connecting…"}
        {!isLoading && (truncatedAddress ?? "Connect Wallet")}
      </button>
    </div>
  );
}
