"use client";

import Link from "next/link";
import { explorerUrl } from "@/lib/chain";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/solid";

interface TxToastProps {
  hash?: `0x${string}`;
  status: "idle" | "pending" | "success" | "error";
  onDismiss?: () => void;
  error?: string;
}

export function TxToast({ hash, status, onDismiss, error }: TxToastProps) {
  if (status === "idle") return null;

  return (
    <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-2xl px-5 py-4 shadow-2xl max-w-sm">
      <div className="flex items-center gap-3">
        {status === "pending" && <ClockIcon className="w-5 h-5 text-yellow-400" />}
        {status === "success" && <CheckCircleIcon className="w-5 h-5 text-green-400" />}
        <div className="flex-1">
          <p className="font-semibold text-sm">
            {status === "pending" && "Transaction pending"}
            {status === "success" && "Transaction confirmed"}
            {status === "error" && "Transaction failed"}
          </p>
          {hash && (
            <Link href={`${explorerUrl}/tx/${hash}`} target="_blank" className="text-xs text-accent underline">
              View on explorer
            </Link>
          )}
          {status === "error" && error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
        <button onClick={onDismiss} className="text-xs text-gray-400 hover:text-white">Close</button>
      </div>
    </div>
  );
}
