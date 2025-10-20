"use client";

import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { V3_TOKENS, findV3Token, type V3TokenInfo } from "@/lib/v3Tokens";
import { clsx } from "clsx";

// TokenBalanceDisplay component
function TokenBalanceDisplay({ token }: { token: V3TokenInfo }) {
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();

  useEffect(() => {
    const fetchBalance = async () => {
      if (!token || !address || !window.ethereum) {
        setBalance("0");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        
        if (token.isNative) {
          const balance = await provider.getBalance(address);
          const formatted = ethers.formatEther(balance);
          // Format to 2 decimal places
          const formatted2dp = parseFloat(formatted).toFixed(2);
          setBalance(formatted2dp);
          console.log("Native token balance:", {
            token: token.symbol,
            address: token.address,
            rawBalance: balance.toString(),
            formattedBalance: formatted,
            formatted2dp: formatted2dp
          });
        } else {
          const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const balance = await tokenContract.balanceOf(address);
          
          // Force refresh the provider to avoid caching issues
          const freshProvider = new ethers.BrowserProvider(window.ethereum);
          const freshContract = new ethers.Contract(token.address, ERC20_ABI, freshProvider);
          const freshBalance = await freshContract.balanceOf(address);
          
          const formatted = ethers.formatUnits(freshBalance, token.decimals);
          // Format to 2 decimal places
          const formatted2dp = parseFloat(formatted).toFixed(2);
          setBalance(formatted2dp);
          console.log("ERC20 token balance:", {
            token: token.symbol,
            address: token.address,
            decimals: token.decimals,
            rawBalance: freshBalance.toString(),
            formattedBalance: formatted,
            formatted2dp: formatted2dp,
            expectedDecimals: token.decimals,
            tokenConfig: token
          });
        }
      } catch (error) {
        console.error("Error fetching token balance:", error);
        setBalance("0");
      } finally {
        setLoading(false);
      }
    };

    // Add a small delay to ensure the component is fully mounted
    const timeoutId = setTimeout(fetchBalance, 100);
    return () => clearTimeout(timeoutId);
  }, [token, address]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading balance...</div>;
  }

  return (
    <div className="text-sm text-gray-400 flex items-center gap-2">
      <span>Balance: {balance} {token.symbol}</span>
      <button 
        onClick={() => {
          setLoading(true);
          // Force re-fetch
          const fetchBalance = async () => {
            if (!token || !address || !window.ethereum) return;
            try {
              const provider = new ethers.BrowserProvider(window.ethereum);
              if (token.isNative) {
                const balance = await provider.getBalance(address);
                const formatted = ethers.formatEther(balance);
                setBalance(parseFloat(formatted).toFixed(2));
              } else {
                const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
                const balance = await tokenContract.balanceOf(address);
                const formatted = ethers.formatUnits(balance, token.decimals);
                setBalance(parseFloat(formatted).toFixed(2));
              }
            } catch (error) {
              console.error("Error refreshing balance:", error);
            } finally {
              setLoading(false);
            }
          };
          fetchBalance();
        }}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        🔄
      </button>
    </div>
  );
}

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
            {token.symbol} - {token.name} {token.isNative ? "(Native)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// Native V3 Pool ABI (supports native token swaps)
const NATIVE_V3_POOL_ABI = [
  "function token0() view returns (address)",
  "function getTokenInfo() view returns (address, bool)",
  "function getReserves() view returns (uint256, uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function swap(uint256 amount0Out, uint256 amount1Out, address to) external payable",
  "function mint(uint256 amount0, uint256 amount1) external payable"
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
  userNativeBalance: string;
  userToken0Balance: string;
  userToken1Balance: string;
  isToken0Native: boolean;
  poolAddress: string;
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
  const [mounted, setMounted] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string>("");

  // Pool addresses (deployed on AssetLayer Testnet)
  const POOL_ADDRESSES = {
    "asl-wasl": "0xC6c1fCd59976a3CEBA5d0dbd1b347618526A2826", // ASL/WASL Pool
    "asl-ausd": "0x203745ABe741e80f4E50A3463E3dE7fB33F6e3E6", // ASL/AUSD Pool
    "wasl-ausd": "0x79a07040731C3a56f5B4385C4c716544a8D5c32B"  // WASL/AUSD Pool
  };

  // Function to determine pool based on selected tokens
  const getPoolForTokens = (tokenA: V3TokenInfo | undefined, tokenB: V3TokenInfo | undefined) => {
    if (!tokenA || !tokenB) return null;
    
    const isASL = (token: V3TokenInfo) => token.isNative;
    const isWASL = (token: V3TokenInfo) => token.symbol === "WASL";
    const isAUSD = (token: V3TokenInfo) => token.symbol === "AUSD";
    
    if ((isASL(tokenA) && isWASL(tokenB)) || (isWASL(tokenA) && isASL(tokenB))) {
      return POOL_ADDRESSES["asl-wasl"];
    } else if ((isASL(tokenA) && isAUSD(tokenB)) || (isAUSD(tokenA) && isASL(tokenB))) {
      return POOL_ADDRESSES["asl-ausd"];
    } else if ((isWASL(tokenA) && isAUSD(tokenB)) || (isAUSD(tokenA) && isWASL(tokenB))) {
      return POOL_ADDRESSES["wasl-ausd"];
    }
    return null;
  };

  // Ensure component only renders on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize tokens
  useEffect(() => {
    if (V3_TOKENS.length >= 3) {
      setInputToken(V3_TOKENS[0]); // ASL (Native)
      setOutputToken(V3_TOKENS[1]); // WASL
    }
  }, []);

  // Function to get the correct balance for a specific token
  const getTokenBalance = async (token: V3TokenInfo | undefined) => {
    if (!token || !address || !window.ethereum) return "0";
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      if (token.isNative) {
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
      } else {
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(address);
        return ethers.formatUnits(balance, token.decimals);
      }
    } catch (error) {
      console.error("Error fetching token balance:", error);
      return "0";
    }
  };

  // Update selected pool when tokens change
  useEffect(() => {
    const poolAddress = getPoolForTokens(inputToken, outputToken);
    setSelectedPool(poolAddress || "");
  }, [inputToken, outputToken]);

  useEffect(() => {
    if (isConnected && address && selectedPool) {
      loadPoolInfo();
    }
  }, [isConnected, address, selectedPool]);

  const loadPoolInfo = async () => {
    if (!window.ethereum || !selectedPool || !address) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, provider);
      
      const [token0, isToken0Native, reserves] = await Promise.all([
        poolContract.token0(),
        poolContract.getTokenInfo().then((info: any) => info[1]), // isToken0Native
        poolContract.getReserves()
      ]);
      
      // Determine token1 address based on which pool we're using
      let token1 = "";
      if (selectedPool === POOL_ADDRESSES["asl-wasl"]) {
        token1 = "0x5bF0980739B073811b94Ad9e21Bce8C04dcc778b"; // WASL
      } else if (selectedPool === POOL_ADDRESSES["asl-ausd"]) {
        token1 = "0x2e83297970aBdc26691432bB72Cb8e19c8818b11"; // AUSD
      } else if (selectedPool === POOL_ADDRESSES["wasl-ausd"]) {
        token1 = "0x2e83297970aBdc26691432bB72Cb8e19c8818b11"; // AUSD
      }
      
      // Fetch individual token balances
      const userNativeBalance = await provider.getBalance(address);
      
      // Fetch ERC20 token balances
      let userToken0Balance = "0";
      let userToken1Balance = "0";
      
      console.log("Fetching balances for:", {
        selectedPool,
        isToken0Native,
        token0,
        token1,
        address
      });
      
      if (isToken0Native) {
        // Token0 is native ASL, Token1 is ERC20
        userToken0Balance = userNativeBalance;
        if (token1) {
          const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
          userToken1Balance = await token1Contract.balanceOf(address);
          console.log("Token1 balance (raw):", userToken1Balance.toString());
        }
      } else {
        // Both tokens are ERC20
        if (token0) {
          const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
          userToken0Balance = await token0Contract.balanceOf(address);
          console.log("Token0 balance (raw):", userToken0Balance.toString());
        }
        if (token1) {
          const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
          userToken1Balance = await token1Contract.balanceOf(address);
          console.log("Token1 balance (raw):", userToken1Balance.toString());
        }
      }
      
      // Get LP token balance
      const userLPBalance = await poolContract.balanceOf(address);
      
      // Determine correct decimals for each token based on pool type
      let token0Decimals = 18;
      let token1Decimals = 18;
      
      if (selectedPool === POOL_ADDRESSES["asl-wasl"]) {
        // ASL/WASL pool: ASL (18 decimals) / WASL (18 decimals)
        token0Decimals = 18; // ASL
        token1Decimals = 18; // WASL
      } else if (selectedPool === POOL_ADDRESSES["asl-ausd"]) {
        // ASL/AUSD pool: ASL (18 decimals) / AUSD (6 decimals)
        token0Decimals = 18; // ASL
        token1Decimals = 6;  // AUSD
      } else if (selectedPool === POOL_ADDRESSES["wasl-ausd"]) {
        // WASL/AUSD pool: WASL (18 decimals) / AUSD (6 decimals)
        token0Decimals = 18; // WASL
        token1Decimals = 6;  // AUSD
      }
      
      const formattedToken0Balance = isToken0Native ? ethers.formatEther(userToken0Balance) : ethers.formatUnits(userToken0Balance, token0Decimals);
      const formattedToken1Balance = ethers.formatUnits(userToken1Balance, token1Decimals);
      
      console.log("Balance formatting debug:", {
        selectedPool,
        token0Decimals,
        token1Decimals,
        userToken0Balance: userToken0Balance.toString(),
        userToken1Balance: userToken1Balance.toString(),
        formattedToken0Balance,
        formattedToken1Balance
      });
      
      setPoolInfo({
        token0: isToken0Native ? "0x0000000000000000000000000000000000000000" : token0,
        token1,
        reserve0: isToken0Native ? ethers.formatEther(reserves[0]) : ethers.formatUnits(reserves[0], token0Decimals),
        reserve1: ethers.formatUnits(reserves[1], token1Decimals),
        userBalance: ethers.formatUnits(userLPBalance, 18),
        userNativeBalance: ethers.formatEther(userNativeBalance),
        isToken0Native,
        poolAddress: selectedPool,
        userToken0Balance: formattedToken0Balance,
        userToken1Balance: formattedToken1Balance
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
    if (!window.ethereum || !address || !poolInfo || !inputToken || !outputToken || !selectedPool) return;
    
    setLoading(true);
    setMessage("");
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, signer);
      
      const amountIn = ethers.parseUnits(inputAmount, inputToken.decimals);
      
      // Calculate swap parameters based on pool configuration
      let amount0Out, amount1Out;
      const isInputToken0 = inputToken.isNative === poolInfo.isToken0Native;
      
      if (isInputToken0) {
        // Swapping Token0 for Token1
        amount0Out = 0;
        amount1Out = ethers.parseUnits(outputAmount, outputToken.decimals);
      } else {
        // Swapping Token1 for Token0
        amount0Out = ethers.parseUnits(outputAmount, outputToken.decimals);
        amount1Out = 0;
      }
      
      // Handle native token swaps
      if (inputToken.isNative) {
        // For native token swaps, send ETH with the transaction
        const swapTx = await poolContract.swap(amount0Out, amount1Out, address, {
          value: amountIn
        });
        await swapTx.wait();
        setMessage("Native token swap completed successfully!");
        
      } else {
        // Handle ERC20 token swaps
        // Approve token if needed
        const tokenContract = new ethers.Contract(inputToken.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(address, selectedPool);
        
        if (allowance < amountIn) {
          const approveTx = await tokenContract.approve(selectedPool, amountIn);
          await approveTx.wait();
          setMessage("Token approved, performing swap...");
        }
        
        // Perform swap
        const swapTx = await poolContract.swap(amount0Out, amount1Out, address);
        await swapTx.wait();
        setMessage("Swap completed successfully!");
      }
      
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

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-xl mx-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">V3 Pool Swap</h2>
        </div>
        <div className="text-center">
          <p className="text-gray-400 mb-4">Loading...</p>
        </div>
      </div>
    );
  }

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
          <div className="flex justify-between items-center">
            <input
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl focus:outline-none"
              type="number"
              min="0"
            />
            {inputToken && (
              <TokenBalanceDisplay key={`${inputToken.address}-${inputToken.symbol}`} token={inputToken} />
            )}
          </div>
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
          <p>Your ASL balance: {poolInfo ? `${poolInfo.userNativeBalance} ASL` : "-"}</p>
          {poolInfo && (
            <>
              <p>Token0 balance: {poolInfo.userToken0Balance}</p>
              <p>Token1 balance: {poolInfo.userToken1Balance}</p>
            </>
          )}
          {selectedPool && (
            <p className="text-xs text-gray-500">
              Pool: {selectedPool.slice(0, 6)}...{selectedPool.slice(-4)}
            </p>
          )}
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