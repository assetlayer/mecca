"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clsx } from "clsx";

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!mounted) {
    return null;
  }

  if (address) {
    return (
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 rounded-xl bg-surface border border-border hover:border-accent transition"
      >
        {chain ? chain.name : "Unknown"} · {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={!connector.ready || isPending}
          className={clsx(
            "px-4 py-2 rounded-xl bg-accent/20 border border-accent/50 text-accent hover:bg-accent/30 transition",
            (!connector.ready || isPending) && "opacity-50"
          )}
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}
