"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { addresses, assetLayerSwapHookAbi, erc20Abi, minimalSwapRouterAbi } from "@/lib/v4";
import type { TokenInfo } from "@/lib/tokens";
import { DEFAULT_INPUT_TOKEN, DEFAULT_OUTPUT_TOKEN, findToken } from "@/lib/tokens";
import { TokenSelect } from "./TokenSelect";
import { useSwapStore, parseAmount, formatAmount } from "@/lib/state";
import { fetchAllowance, needsApproval } from "@/lib/approvals";
import { assetLayerTestnet } from "@/lib/chain";
import { TxToast } from "./TxToast";
import { clsx } from "clsx";

const DEFAULT_POOL_FEE = 100; // use the working fee tier
const DEFAULT_TICK_SPACING = 1;

interface SwapBoxProps {
  tokens: TokenInfo[];
  isLoading: boolean;
}

export function SwapBox({ tokens, isLoading }: SwapBoxProps) {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: assetLayerTestnet.id });
  const { data: walletClient } = useWalletClient({ chainId: assetLayerTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const {
    inputToken,
    outputToken,
    setInputToken,
    setOutputToken,
    inputAmount,
    setInputAmount,
    slippageBps,
    setSlippageBps,
    switchSides,
  } = useSwapStore();

  const [quoteAmount, setQuoteAmount] = useState<bigint>(0n);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [protocolFeePercent, setProtocolFeePercent] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txError, setTxError] = useState<string | undefined>();

  const routerAddress = addresses.MINIMAL_SWAP_ROUTER;
  const hookAddress = "0x0000000000000000000000000000000000000000" as `0x${string}`;

  useEffect(() => {
    if (!inputToken && tokens.length) {
      const fallback = findToken(tokens, DEFAULT_INPUT_TOKEN) ?? tokens[0];
      setInputToken(fallback);
    }
    if (!outputToken && tokens.length) {
      const fallback = findToken(tokens, DEFAULT_OUTPUT_TOKEN) ?? tokens.at(1) ?? tokens[0];
      if (fallback && fallback.address !== inputToken?.address) {
        setOutputToken(fallback);
      }
    }
  }, [tokens, inputToken, outputToken, setInputToken, setOutputToken]);

  useEffect(() => {
    async function loadFee() {
      if (!publicClient || !hookAddress) return;
      try {
        const feeE6 = (await publicClient.readContract({
          address: hookAddress,
          abi: assetLayerSwapHookAbi,
          functionName: "feeE6",
        })) as bigint;
        setProtocolFeePercent(Number(feeE6) / 10_000);
      } catch (error) {
        console.error("Failed to read protocol fee", error);
      }
    }
    loadFee();
  }, [publicClient, hookAddress]);

  useEffect(() => {
    async function loadAllowance() {
      if (!publicClient || !address || !routerAddress || !inputToken) {
        setAllowance(0n);
        return;
      }
      try {
        const allowanceValue = await fetchAllowance(
          publicClient,
          inputToken.address as `0x${string}`,
          address,
          routerAddress as `0x${string}`
        );
        setAllowance(allowanceValue);
      } catch (error) {
        console.error("Failed to fetch allowance", error);
      }
    }
    loadAllowance();
  }, [publicClient, address, routerAddress, inputToken, txStatus]);

  const parsedAmountIn = useMemo(() => {
    if (!inputToken) return 0n;
    return parseAmount(inputAmount, inputToken.decimals);
  }, [inputAmount, inputToken]);

  const { zeroForOne, poolKey } = useMemo(() => {
    if (!inputToken || !outputToken || !hookAddress) {
      return {
        zeroForOne: false,
        poolKey: null as null | {
          currency0: `0x${string}`;
          currency1: `0x${string}`;
          fee: number;
          tickSpacing: number;
          hook: `0x${string}`;
        },
      };
    }
    const lowerFirst = inputToken.address.toLowerCase() < outputToken.address.toLowerCase();
    const currency0 = lowerFirst ? inputToken.address : outputToken.address;
    const currency1 = lowerFirst ? outputToken.address : inputToken.address;
    return {
      zeroForOne: inputToken.address.toLowerCase() === currency0.toLowerCase(),
      poolKey: {
        currency0: currency0 as `0x${string}`,
        currency1: currency1 as `0x${string}`,
        fee: DEFAULT_POOL_FEE,
        tickSpacing: DEFAULT_TICK_SPACING,
        hook: hookAddress as `0x${string}`,
      },
    };
  }, [inputToken, outputToken, hookAddress]);

  useEffect(() => {
    async function quote() {
      if (!publicClient || !inputToken || !outputToken || !routerAddress || !poolKey || parsedAmountIn === 0n) {
        setQuoteAmount(0n);
        return;
      }
      if (inputToken.address.toLowerCase() === outputToken.address.toLowerCase()) {
        setQuoteError("Select two different tokens");
        setQuoteAmount(0n);
        return;
      }
      // If the router doesn't have enough allowance yet, skip on-chain simulation to avoid a revert
      if (needsApproval(allowance, parsedAmountIn)) {
        setQuoteError("Approve the router to spend your input token to preview.");
        setQuoteAmount(0n);
        return;
      }
      setIsQuoting(true);
      setQuoteError(null);
      try {
        const simulationAccount = address ?? (routerAddress ? (routerAddress as `0x${string}`) : undefined);
        if (!simulationAccount) return;
        const { result } = await publicClient.simulateContract({
          address: routerAddress as `0x${string}`,
          abi: minimalSwapRouterAbi,
          functionName: "swapExactInput",
          account: simulationAccount,
          args: [
            {
              key: {
                currency0: poolKey.currency0,
                currency1: poolKey.currency1,
                fee: poolKey.fee,
                tickSpacing: poolKey.tickSpacing,
                hook: poolKey.hook,
              },
              amountIn: parsedAmountIn,
              amountOutMin: 0n,
              recipient: simulationAccount,
              payer: simulationAccount,
              zeroForOne,
              sqrtPriceLimitX96: 0n,
              deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
            },
          ],
        });
        setQuoteAmount(result as bigint);
    } catch (error: any) {
      console.error("quote failed", error);
      setQuoteError("Unable to quote swap. Pool may be uninitialized or illiquid. Please ensure the pool is seeded with liquidity first.");
      setQuoteAmount(0n);
    } finally {
        setIsQuoting(false);
      }
    }
    quote();
  }, [publicClient, address, inputToken, outputToken, routerAddress, poolKey, parsedAmountIn, zeroForOne, allowance]);

  const needsUserApproval = useMemo(() => {
    if (!routerAddress || !inputToken) return false;
    return needsApproval(allowance, parsedAmountIn);
  }, [allowance, parsedAmountIn, routerAddress, inputToken]);

  const minReceived = useMemo(() => {
    if (quoteAmount === 0n) return 0n;
    const bps = BigInt(slippageBps);
    return (quoteAmount * (10_000n - bps)) / 10_000n;
  }, [quoteAmount, slippageBps]);

  const estimatedFeeDisplay = useMemo(() => {
    if (!inputToken || parsedAmountIn === 0n || protocolFeePercent === null) return "-";
    const feeAmount = (parsedAmountIn * BigInt(Math.round(protocolFeePercent * 10_000))) / 1_000_000n;
    return `${formatAmount(feeAmount, inputToken.decimals)} ${inputToken.symbol}`;
  }, [inputToken, parsedAmountIn, protocolFeePercent]);

  async function handleApprove() {
    if (!address || !inputToken || !routerAddress) return;
    try {
      setTxStatus("pending");
      setTxError(undefined);
      const hash = await writeContractAsync({
        address: inputToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        account: address,
        args: [routerAddress as `0x${string}`, parsedAmountIn],
      });
      setTxHash(hash);
      await publicClient?.waitForTransactionReceipt({ hash });
      setTxStatus("success");
    } catch (error: any) {
      console.error("approve failed", error);
      setTxError(error?.message ?? "Approval failed");
      setTxStatus("error");
    }
  }

  async function handleSwap() {
    if (!address || !inputToken || !outputToken || !routerAddress || !poolKey || parsedAmountIn === 0n) return;
    try {
      setTxStatus("pending");
      setTxError(undefined);
      const minOut = minReceived;
      const { request } = await publicClient!.simulateContract({
        address: routerAddress as `0x${string}`,
        abi: minimalSwapRouterAbi,
        functionName: "swapExactInput",
        account: address,
        args: [
          {
            key: {
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              tickSpacing: poolKey.tickSpacing,
              hook: poolKey.hook,
            },
            amountIn: parsedAmountIn,
            amountOutMin: minOut,
            recipient: address,
            payer: address,
            zeroForOne,
            sqrtPriceLimitX96: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
          },
        ],
      });
      const hash = await writeContractAsync(request);
      setTxHash(hash);
      await publicClient?.waitForTransactionReceipt({ hash });
      setTxStatus("success");
    } catch (error: any) {
      console.error("swap failed", error);
      setTxError(error?.message ?? "Swap failed");
      setTxStatus("error");
    }
  }

  const isWrongNetwork = chain && chain.id !== assetLayerTestnet.id;

  if (isLoading && tokens.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-xl mx-auto shadow-2xl text-center text-gray-400">
        Loading tokens…
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-xl mx-auto shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Swap</h2>
        <button onClick={switchSides} className="text-sm text-accent underline">
          Switch tokens
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <TokenSelect
          tokens={tokens}
          value={inputToken}
          onChange={setInputToken}
          label="You pay"
        />
        <div className="bg-black/20 border border-border rounded-xl px-4 py-3">
          <input
            value={inputAmount}
            onChange={(event) => setInputAmount(event.target.value)}
            placeholder="0.0"
            className="w-full bg-transparent text-2xl focus:outline-none"
            type="number"
            min="0"
          />
        </div>
        <TokenSelect
          tokens={tokens}
          value={outputToken}
          onChange={setOutputToken}
          label="You receive"
        />
        <div className="bg-black/20 border border-border rounded-xl px-4 py-3 min-h-[48px] flex items-center">
          {isQuoting ? (
            <span className="text-gray-400 text-sm">Fetching quote…</span>
          ) : quoteAmount > 0n ? (
            <span className="text-lg">
              {outputToken ? `${formatAmount(quoteAmount, outputToken.decimals)} ${outputToken.symbol}` : "-"}
            </span>
          ) : quoteError ? (
            <div className="text-sm text-red-400">
              {quoteError}
              <div className="mt-1 text-xs text-gray-500">
                To seed the pool, run: <code className="bg-gray-100 px-1 rounded">cd contracts && npx hardhat run --network assetlayer scripts/seedPool.ts</code>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-500">Enter an amount to preview</span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Slippage tolerance</span>
          <input
            type="number"
            value={slippageBps}
            onChange={(event) => setSlippageBps(Number(event.target.value))}
            className="bg-black/30 border border-border rounded-lg px-3 py-1 w-20 text-right"
          />
        </div>
        <div className="text-sm text-gray-300 space-y-1">
          <p>Min received: {outputToken ? `${formatAmount(minReceived, outputToken.decimals)} ${outputToken.symbol}` : "-"}</p>
          <p>Protocol fee: {protocolFeePercent !== null ? `${protocolFeePercent.toFixed(2)}%` : "-"} ({estimatedFeeDisplay})</p>
        </div>
        {isWrongNetwork && <p className="text-sm text-red-400">Please switch to the AssetLayer Testnet.</p>}
        {!routerAddress && <p className="text-sm text-red-400">Router not deployed yet.</p>}
        {address ? (
          <div className="flex gap-4">
            <button
              onClick={handleApprove}
              disabled={!needsUserApproval || parsedAmountIn === 0n || !walletClient}
              className={clsx(
                "flex-1 py-3 rounded-xl border border-accent text-accent hover:bg-accent/10 transition",
                (!needsUserApproval || parsedAmountIn === 0n) && "opacity-40"
              )}
            >
              Approve
            </button>
            <button
              onClick={handleSwap}
              disabled={needsUserApproval || parsedAmountIn === 0n || isWrongNetwork || !walletClient || !routerAddress}
              className={clsx(
                "flex-1 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/80 transition",
                (needsUserApproval || parsedAmountIn === 0n || isWrongNetwork || !routerAddress) && "opacity-40"
              )}
            >
              Swap
            </button>
          </div>
        ) : (
          <p className="text-sm text-center text-gray-400">Connect your wallet to start swapping.</p>
        )}
      </div>
      <TxToast
        hash={txHash}
        status={txStatus}
        error={txError}
        onDismiss={() => {
          setTxStatus("idle");
          setTxHash(undefined);
          setTxError(undefined);
        }}
      />
    </div>
  );
}
