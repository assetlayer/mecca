"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./Connect";
import { clsx } from "clsx";

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24 py-4">
          {/* Logo and Navigation Links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
              <img 
                src="/logo.png" 
                alt="MECCA Logo" 
                className="w-40 h-40 object-contain"
              />
            </Link>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition",
                  pathname === "/"
                    ? "bg-accent/10 text-accent"
                    : "text-gray-400 hover:text-white hover:bg-surface"
                )}
              >
                Swap
              </Link>
              <Link
                href="/liquidity"
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition",
                  pathname === "/liquidity"
                    ? "bg-accent/10 text-accent"
                    : "text-gray-400 hover:text-white hover:bg-surface"
                )}
              >
                Liquidity
              </Link>
            </nav>
          </div>

          {/* Connect Button */}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

