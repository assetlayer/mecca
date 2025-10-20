import { create } from "zustand";
import type { TokenInfo } from "./tokens";

interface SwapState {
  inputToken?: TokenInfo;
  outputToken?: TokenInfo;
  inputAmount: string;
  slippageBps: number;
  setInputToken: (token: TokenInfo) => void;
  setOutputToken: (token: TokenInfo) => void;
  setInputAmount: (amount: string) => void;
  setSlippageBps: (bps: number) => void;
  switchSides: () => void;
}

export const useSwapStore = create<SwapState>((set, get) => ({
  inputAmount: "",
  slippageBps: 50,
  setInputToken: (token) => set({ inputToken: token }),
  setOutputToken: (token) => set({ outputToken: token }),
  setInputAmount: (amount) => set({ inputAmount: amount }),
  setSlippageBps: (bps) => set({ slippageBps: bps }),
  switchSides: () => {
    const { inputToken, outputToken } = get();
    set({ inputToken: outputToken, outputToken: inputToken });
  }
}));

export function formatAmount(amount: bigint, decimals: number, precision = 6) {
  const divisor = BigInt(10) ** BigInt(decimals);
  const integer = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) return integer.toString();
  const fractionStr = (fraction + divisor).toString().slice(1).padStart(decimals, "0");
  return `${integer}.${fractionStr.slice(0, precision)}`;
}

export function parseAmount(value: string, decimals: number) {
  if (!value) return 0n;
  const [integerRaw, fractionRaw = ""] = value.split(".");
  const integer = integerRaw.replace(/\D/g, "") || "0";
  const fractionDigits = fractionRaw.replace(/\D/g, "");
  const padded = (fractionDigits + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(integer) * (BigInt(10) ** BigInt(decimals)) + BigInt(padded || "0");
}
