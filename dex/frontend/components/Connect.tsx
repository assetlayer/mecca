"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { clsx } from "clsx";

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);

  const { address, chain } = useAccount();
  const { connect, connectors, isPending, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [address]);

  if (!mounted) {
    return null;
  }

  if (address) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen((open) => !open)}
          className="px-4 py-2 rounded-xl bg-surface border border-border hover:border-accent transition"
        >
          {chain ? chain.name : "Unknown"} · {address.slice(0, 6)}…{address.slice(-4)}
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-surface/95 backdrop-blur shadow-lg p-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-sm text-gray-400">
              <span className="font-medium text-white">Connected Wallet</span>
              <span className="truncate text-xs">{address}</span>
              {chain && <span className="text-xs">Network: {chain.name}</span>}
            </div>
            <button
              onClick={() => {
                disconnect();
                setIsMenuOpen(false);
              }}
              className="w-full rounded-lg bg-red-500/10 text-red-400 border border-red-500/50 px-3 py-2 text-sm hover:bg-red-500/20 transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen((open) => !open)}
        className="px-4 py-2 rounded-xl bg-accent text-white border border-accent/80 hover:bg-accent/90 transition"
      >
        Connect Wallet
      </button>
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-surface/95 backdrop-blur shadow-lg p-2">
          <div className="flex flex-col gap-2">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => {
                  setIsMenuOpen(false);
                  connect({ connector });
                }}
                disabled={!connector.ready || isPending}
                className={clsx(
                  "w-full text-left px-3 py-2 rounded-lg border border-border/60 hover:border-accent/60 hover:bg-accent/10 transition text-sm",
                  (!connector.ready || isPending) && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-white">{connector.name}</span>
                  {!connector.ready && <span className="text-xs text-gray-400">Unavailable</span>}
                  {isPending && pendingConnector?.uid === connector.uid && (
                    <span className="text-xs text-accent">Connecting…</span>
                  )}
                </div>
              </button>
            ))}
            {connectors.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No wallets available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
