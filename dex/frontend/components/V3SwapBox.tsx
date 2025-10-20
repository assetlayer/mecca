"use client";

import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { V3_TOKENS, findV3Token, type V3TokenInfo } from "@/lib/v3Tokens";
import { clsx } from "clsx";

// TokenSelect component for V3
function TokenSelect({ tokens, value, onChange, label }: {
  tokens: V3TokenInfo[];
  value?: V3TokenInfo;
  onChange: (token: V3TokenInfo) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-gray-300">{label}</span>
      <select
        value={value?.address || ""}
        onChange={(e) => {
          const token = tokens.find(t => t.address === e.target.value);
          if (token) onChange(token);
        }}
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Select token</option>
        {tokens.map((token) => (
          <option key={token.address} value={token.address}>
            {token.symbol} - {token.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Simple V3 Pool ABI (minimal interface)
const SIMPLE_V3_POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint256, uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function swap(uint256 amount0Out, uint256 amount1Out, address to) external",
  "function mint(uint256 amount0, uint256 amount1) external"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

interface PoolInfo {
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  userBalance: string;
}

export default function V3SwapBox() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [inputToken, setInputToken] = useState<V3TokenInfo | undefined>();
  const [outputToken, setOutputToken] = useState<V3TokenInfo | undefined>();
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [slippageBps, setSlippageBps] = useState(50); // 0.5%

  // Use a hardcoded pool address to avoid hydration issues
  const poolAddress = "0xC8C6Ac9aE1063BdcFAebb780168Eb70562626991";

  // Initialize tokens
  useEffect(() => {
    if (V3_TOKENS.length >= 2) {
      setInputToken(V3_TOKENS[0]); // WASL
      setOutputToken(V3_TOKENS[1]); // AUSD
    }
  }, []);

  useEffect(() => {
    if (isConnected && address && poolAddress) {
      loadPoolInfo();
    }
  }, [isConnected, address, poolAddress]);

  const loadPoolInfo = async () => {
    if (!window.ethereum) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const poolContract = new ethers.Contract(poolAddress, SIMPLE_V3_POOL_ABI, provider);
      
      const [token0, token1, reserves] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.getReserves()
      ]);
      
      const userBalance = address ? await poolContract.balanceOf(address) : "0";
      
      setPoolInfo({
        token0,
        token1,
        reserve0: ethers.formatUnits(reserves[0], 6), // Token0 has 6 decimals
        reserve1: ethers.formatUnits(reserves[1], 18), // Token1 has 18 decimals
        userBalance: ethers.formatUnits(userBalance, 18)
      });
    } catch (error) {
      console.error("Error loading pool info:", error);
      setMessage("Error loading pool information");
    }
  };

  const switchTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount("");
    setOutputAmount("");
  };

  const calculateOutputAmount = (amountIn: string, tokenIn: V3TokenInfo, tokenOut: V3TokenInfo) => {
    if (!poolInfo || !amountIn || amountIn === "0") {
      setOutputAmount("");
      return;
    }

    try {
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      const reserveIn = tokenIn.address.toLowerCase() === poolInfo.token0.toLowerCase() 
        ? ethers.parseUnits(poolInfo.reserve0, tokenIn.decimals)
        : ethers.parseUnits(poolInfo.reserve1, tokenIn.decimals);
      const reserveOut = tokenOut.address.toLowerCase() === poolInfo.token0.toLowerCase()
        ? ethers.parseUnits(poolInfo.reserve0, tokenOut.decimals)
        : ethers.parseUnits(poolInfo.reserve1, tokenOut.decimals);

      // Simple constant product formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
      const amountOut = (amountInWei * reserveOut) / (reserveIn + amountInWei);
      const amountOutFormatted = ethers.formatUnits(amountOut, tokenOut.decimals);
      setOutputAmount(amountOutFormatted);
    } catch (error) {
      console.error("Error calculating output amount:", error);
      setOutputAmount("");
    }
  };

  useEffect(() => {
    if (inputToken && outputToken && inputAmount) {
      calculateOutputAmount(inputAmount, inputToken, outputToken);
    }
  }, [inputAmount, inputToken, outputToken, poolInfo]);

  const handleSwap = async () => {
    if (!window.ethereum || !address || !poolInfo || !inputToken || !outputToken) return;
    
    setLoading(true);
    setMessage("");
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(poolAddress, SIMPLE_V3_POOL_ABI, signer);
      
      const amountIn = ethers.parseUnits(inputAmount, inputToken.decimals);
      
      // Approve token if needed
      const tokenContract = new ethers.Contract(inputToken.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(address, poolAddress);
      
      if (allowance < amountIn) {
        const approveTx = await tokenContract.approve(poolAddress, amountIn);
        await approveTx.wait();
        setMessage("Token approved, performing swap...");
      }
      
      // Calculate swap parameters
      let amount0Out, amount1Out;
      if (inputToken.address.toLowerCase() === poolInfo.token0.toLowerCase()) {
        // Swapping Token0 for Token1
        amount0Out = 0;
        amount1Out = ethers.parseUnits(outputAmount, outputToken.decimals);
      } else {
        // Swapping Token1 for Token0
        amount0Out = ethers.parseUnits(outputAmount, outputToken.decimals);
        amount1Out = 0;
      }
      
      // Perform swap
      const swapTx = await poolContract.swap(amount0Out, amount1Out, address);
      await swapTx.wait();
      setMessage("Swap completed successfully!");
      
      // Reload pool info
      await loadPoolInfo();
      setInputAmount("");
      setOutputAmount("");
      
    } catch (error: any) {
      console.error("Swap error:", error);
      setMessage(`Swap failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const minReceived = useMemo(() => {
    if (!outputAmount || !outputToken) return "0";
    const slippage = BigInt(slippageBps);
    const amountOut = ethers.parseUnits(outputAmount, outputToken.decimals);
    const minAmount = (amountOut * (10000n - slippage)) / 10000n;
    return ethers.formatUnits(minAmount, outputToken.decimals);
  }, [outputAmount, outputToken, slippageBps]);

  if (!isConnected) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-xl mx-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">V3 Pool Swap</h2>
        </div>
        <div className="text-center">
          <p className="text-gray-400 mb-4">Connect your wallet to use the V3 pool</p>
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="w-full bg-accent text-white py-3 px-4 rounded-xl font-semibold hover:bg-accent/80 transition"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-xl mx-auto shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">V3 Pool Swap</h2>
        <button onClick={switchTokens} className="text-sm text-accent underline">
          Switch tokens
        </button>
      </div>
      
      <div className="flex flex-col gap-4">
        <TokenSelect
          tokens={V3_TOKENS}
          value={inputToken}
          onChange={setInputToken}
          label="You pay"
        />
        <div className="bg-black/20 border border-border rounded-xl px-4 py-3">
          <input
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-transparent text-2xl focus:outline-none"
            type="number"
            min="0"
          />
        </div>
        
        <TokenSelect
          tokens={V3_TOKENS}
          value={outputToken}
          onChange={setOutputToken}
          label="You receive"
        />
        <div className="bg-black/20 border border-border rounded-xl px-4 py-3 min-h-[48px] flex items-center">
          {outputAmount ? (
            <span className="text-lg">
              {outputToken ? `${outputAmount} ${outputToken.symbol}` : "-"}
            </span>
          ) : (
            <span className="text-sm text-gray-500">Enter an amount to preview</span>
          )}
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Slippage tolerance</span>
          <input
            type="number"
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            className="bg-black/30 border border-border rounded-lg px-3 py-1 w-20 text-right"
          />
        </div>
        
        <div className="text-sm text-gray-300 space-y-1">
          <p>Min received: {outputToken ? `${minReceived} ${outputToken.symbol}` : "-"}</p>
          <p>Pool reserves: {poolInfo ? `${poolInfo.reserve0} / ${poolInfo.reserve1}` : "-"}</p>
          <p>Your LP balance: {poolInfo ? `${poolInfo.userBalance}` : "-"}</p>
        </div>
        
        <button
          onClick={handleSwap}
          disabled={loading || !inputAmount || !outputAmount || !inputToken || !outputToken}
          className={clsx(
            "w-full py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/80 transition",
            (loading || !inputAmount || !outputAmount || !inputToken || !outputToken) && "opacity-40"
          )}
        >
          {loading ? "Swapping..." : "Swap"}
        </button>
        
        {message && (
          <div className={`p-3 rounded-xl ${
            message.includes("Error") || message.includes("failed") 
              ? "bg-red-100 text-red-700 border border-red-300" 
              : "bg-green-100 text-green-700 border border-green-300"
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}