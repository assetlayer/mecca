"use client";

import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { V3_TOKENS, findV3Token, type V3TokenInfo } from "@/lib/v3Tokens";
import { clsx } from "clsx";

// TokenBalanceDisplay component
function TokenBalanceDisplay({ token, tokenPrices, priceChanges }: { token: V3TokenInfo; tokenPrices: any; priceChanges: any }) {
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
    <div className="text-sm text-gray-400 space-y-1">
      <div className="flex items-center gap-2">
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
      <div className="text-xs flex items-center gap-1">
        <span className="text-green-400">
          Price: ${tokenPrices[token.symbol as keyof typeof tokenPrices]?.toFixed(2) || "N/A"}
        </span>
        {priceChanges[token.symbol as keyof typeof priceChanges] !== 0 && (
          <span className={`text-xs ${
            priceChanges[token.symbol as keyof typeof priceChanges] > 0 
              ? 'text-green-500' 
              : 'text-red-500'
          }`}>
            {priceChanges[token.symbol as keyof typeof priceChanges] > 0 ? '↗' : '↘'}
            {Math.abs(priceChanges[token.symbol as keyof typeof priceChanges]).toFixed(2)}
          </span>
        )}
      </div>
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
    "function fixedRateEnabled() view returns (bool)",
    "function setFixedRateEnabled(bool enabled) external",
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
  fixedRateEnabled: boolean; // Added for fixed-rate mode
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
  const [messageTimeout, setMessageTimeout] = useState<NodeJS.Timeout | null>(null);
  const [slippageBps, setSlippageBps] = useState(50); // 0.5%
  const [mounted, setMounted] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string>("");
  const [lastSwapTime, setLastSwapTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastInputChange, setLastInputChange] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  
  // Function to show message with auto-dismiss
  const showMessage = (msg: string, duration: number = 5000) => {
    // Clear any existing timeout
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }
    
    setMessage(msg);
    
    // Set new timeout to clear message
    const timeout = setTimeout(() => {
      setMessage("");
      setMessageTimeout(null);
    }, duration);
    
    setMessageTimeout(timeout);
  };
  
  // Dynamic price oracle with fluctuation
  const [tokenPrices, setTokenPrices] = useState({
    ASL: 2.00,
    WASL: 2.00,
    AUSD: 1.00
  });
  const [priceChanges, setPriceChanges] = useState({
    ASL: 0,
    WASL: 0,
    AUSD: 0
  });

  // Pool addresses (deployed on AssetLayer Testnet - updated with new deployments)
  const POOL_ADDRESSES = {
    "asl-wasl": "0x6647924906278DB6C645519435B7c8eF74773E63", // ASL/WASL Pool
    "asl-ausd": "0x46f1F8F63B70188F06b23771A0FAaEc910782F95", // ASL/AUSD Pool (redeployed)
    "wasl-ausd": "0x9A8EDB20743755bb3C0D16672AaaCe94bF37755a"  // WASL/AUSD Pool
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
      // Temporarily disable WASL/AUSD pool until it's seeded
      console.log("WASL/AUSD pool temporarily disabled - no liquidity");
      return null;
    }
    return null;
  };

  // Ensure component only renders on client side
  useEffect(() => {
    setMounted(true);
    
    // Cleanup timeout on unmount
    return () => {
      if (messageTimeout) {
        clearTimeout(messageTimeout);
      }
    };
  }, [messageTimeout]);

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
    console.log("Selected pool for tokens:", poolAddress);
    console.log("Input token:", inputToken?.symbol);
    console.log("Output token:", outputToken?.symbol);
    setSelectedPool(poolAddress || "");
  }, [inputToken, outputToken]);

  useEffect(() => {
    if (isConnected && address && selectedPool) {
      loadPoolInfo();
    }
  }, [isConnected, address, selectedPool]);

  // Auto-refresh balances every 60 seconds if user is active (reduced frequency)
  useEffect(() => {
    if (!isConnected || !address || !selectedPool) return;

    const interval = setInterval(() => {
      // Only auto-refresh if it's been more than 30 seconds since last swap
      const timeSinceLastSwap = Date.now() - lastSwapTime;
      if (timeSinceLastSwap > 30000) { // 30 seconds
        console.log("Auto-refreshing balances (periodic)...");
        loadPoolInfo();
      }
    }, 60000); // Every 60 seconds (reduced from 30)

    return () => clearInterval(interval);
  }, [isConnected, address, selectedPool, lastSwapTime]);

  // Price fluctuation effect - simulates real market conditions with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const updatePrices = () => {
      console.log("🔄 Price update triggered");
      setTokenPrices(prevPrices => {
        const newPrices = { ...prevPrices };
        const newChanges = { ...priceChanges };
        
        // ASL price fluctuates between $1.50 and $2.50 with moderate volatility
        const aslChange = (Math.random() - 0.5) * 0.07; // Balanced at ±3.5% change
        const oldASL = prevPrices.ASL;
        newPrices.ASL = Math.max(1.50, Math.min(2.50, prevPrices.ASL + aslChange));
        newChanges.ASL = newPrices.ASL - oldASL;
        
        // WASL follows ASL (1:1 peg) with slight variation
        const waslChange = (Math.random() - 0.5) * 0.015; // Balanced at ±0.75% variation from ASL
        const oldWASL = prevPrices.WASL;
        newPrices.WASL = Math.max(1.50, Math.min(2.50, newPrices.ASL + waslChange));
        newChanges.WASL = newPrices.WASL - oldWASL;
        
        // AUSD has slight stablecoin volatility (±0.35% around $1.00)
        const ausdChange = (Math.random() - 0.5) * 0.007; // Balanced at ±0.35% change
        const oldAUSD = prevPrices.AUSD;
        newPrices.AUSD = Math.max(0.995, Math.min(1.005, prevPrices.AUSD + ausdChange));
        newChanges.AUSD = newPrices.AUSD - oldAUSD;
        
        // Set price changes immediately to trigger calculation
        console.log("💰 Setting price changes immediately:", newChanges);
        setPriceChanges(newChanges);
        
        console.log("📈 Price update:", newPrices, "Changes:", newChanges);
        return newPrices;
      });
    };

    const interval = setInterval(updatePrices, 10000); // Balanced at every 10 seconds

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, []);

  const loadPoolInfo = async (showRefreshIndicator = false) => {
    if (!window.ethereum || !selectedPool || !address) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, provider);
      
      // Try to get basic pool info first
      let token0, isToken0Native, reserves, fixedRateEnabled;
      
      try {
        [token0, reserves] = await Promise.all([
        poolContract.token0(),
        poolContract.getReserves()
      ]);
      
        // Determine isToken0Native based on pool address
        isToken0Native = selectedPool === POOL_ADDRESSES["asl-wasl"] || selectedPool === POOL_ADDRESSES["asl-ausd"];
        
        // Try to get fixedRateEnabled, but don't fail if it doesn't exist
        try {
          fixedRateEnabled = await poolContract.fixedRateEnabled();
        } catch (error) {
          console.log("fixedRateEnabled not available, defaulting to false");
          fixedRateEnabled = false;
        }
        
        console.log("Pool data loaded:", {
          token0,
          isToken0Native,
          reserves: reserves.map((r: any) => ethers.formatEther(r)),
          fixedRateEnabled
        });
        
      } catch (error) {
        console.error("Error loading pool info:", error);
        throw new Error("Failed to load pool information");
      }
      
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
        userToken1Balance: formattedToken1Balance,
        fixedRateEnabled
      });
    } catch (error) {
      console.error("Error loading pool info:", error);
      showMessage("Error loading pool information");
    } finally {
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
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
    console.log("🔄 calculateOutputAmount called:", {
      amountIn,
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol,
      poolInfo: poolInfo ? "loaded" : "not loaded",
      tokenPrices
    });

    if (!poolInfo || !amountIn || amountIn === "0" || amountIn === "0." || amountIn === ".") {
      console.log("❌ Early return - missing data:", { poolInfo: !!poolInfo, amountIn });
      setOutputAmount("");
      setIsCalculating(false);
      return;
    }

    try {
      // Validate and parse the input amount
      const numericAmount = parseFloat(amountIn);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        console.log("❌ Invalid input amount:", amountIn);
        setOutputAmount("");
        setIsCalculating(false);
        return;
      }
      
      // Parse units with better error handling for decimals
      let amountInWei;
      try {
        amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      } catch (parseError) {
        console.error("❌ Error parsing input amount:", parseError);
        console.log("Trying to fix decimal formatting...");
        
        // Try to fix common decimal issues
        const fixedAmount = amountIn.replace(/^0+/, '').replace(/\.$/, '');
        if (fixedAmount === '' || fixedAmount === '.') {
          setOutputAmount("");
          setIsCalculating(false);
          return;
        }
        
        try {
          amountInWei = ethers.parseUnits(fixedAmount, tokenIn.decimals);
        } catch (secondError) {
          console.error("❌ Still failed to parse amount:", secondError);
          setOutputAmount("");
          setIsCalculating(false);
          return;
        }
      }
      
      // Determine which reserve corresponds to which token based on pool configuration
      let reserveIn, reserveOut;
      
      if (tokenIn.isNative === poolInfo.isToken0Native) {
        // Input token is token0 (native ASL)
        reserveIn = ethers.parseUnits(poolInfo.reserve0, tokenIn.decimals);
        reserveOut = ethers.parseUnits(poolInfo.reserve1, tokenOut.decimals);
      } else {
        // Input token is token1 (WASL)
        reserveIn = ethers.parseUnits(poolInfo.reserve1, tokenIn.decimals);
        reserveOut = ethers.parseUnits(poolInfo.reserve0, tokenOut.decimals);
      }

      console.log("📊 Swap calculation debug:", {
        amountIn: amountIn,
        amountInWei: amountInWei.toString(),
        reserveIn: reserveIn.toString(),
        reserveOut: reserveOut.toString(),
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        poolReserves: `${poolInfo.reserve0} / ${poolInfo.reserve1}`,
        isToken0Native: poolInfo.isToken0Native
      });

      // Check if pool is in fixed-rate mode (1:1 pricing)
      let amountOut;
      if (poolInfo.fixedRateEnabled) {
        // Fixed 1:1 rate - convert input amount to output token units
        const inputAmountFormatted = ethers.formatUnits(amountInWei, tokenIn.decimals);
        amountOut = ethers.parseUnits(inputAmountFormatted, tokenOut.decimals);
        console.log("🔒 Using fixed 1:1 pricing");
        console.log("Preview - Input:", inputAmountFormatted, tokenIn.symbol);
        console.log("Preview - Output:", ethers.formatUnits(amountOut, tokenOut.decimals), tokenOut.symbol);
      } else {
        // Check for empty reserves to avoid division by zero
        if (reserveIn === 0n || reserveOut === 0n) {
          console.log("❌ Empty reserves detected");
          throw new Error("Pool has no liquidity. Please add liquidity first.");
        }
        
        // Use price-aware calculation that considers actual token values
        const inputPrice = tokenPrices[tokenIn.symbol as keyof typeof tokenPrices] || 1;
        const outputPrice = tokenPrices[tokenOut.symbol as keyof typeof tokenPrices] || 1;
        
        console.log("💰 Price data (pool calculation):", { 
          inputPrice, 
          outputPrice, 
          tokenPrices,
          tokenIn: tokenIn.symbol,
          tokenOut: tokenOut.symbol
        });
        
        // Calculate the value-based output amount
        const inputValueUSD = parseFloat(ethers.formatUnits(amountInWei, tokenIn.decimals)) * inputPrice;
        const outputAmountUSD = inputValueUSD / outputPrice;
        
        // Convert USD value back to output token units
        amountOut = ethers.parseUnits(outputAmountUSD.toString(), tokenOut.decimals);
        
        console.log("💱 Using price-aware calculation:");
        console.log(`Input: ${ethers.formatUnits(amountInWei, tokenIn.decimals)} ${tokenIn.symbol} @ $${inputPrice}`);
        console.log(`Value: $${inputValueUSD.toFixed(2)}`);
        console.log(`Output: ${ethers.formatUnits(amountOut, tokenOut.decimals)} ${tokenOut.symbol} @ $${outputPrice}`);
      }
      
      const amountOutFormatted = ethers.formatUnits(amountOut, tokenOut.decimals);
      // Limit decimal places to prevent overflow
      const limitedAmount = parseFloat(amountOutFormatted).toFixed(6);
      setOutputAmount(limitedAmount);
      
      console.log("✅ Calculated output:", limitedAmount);
    } catch (error) {
      console.error("❌ Error calculating output amount:", error);
      setOutputAmount("");
    } finally {
      // Always clear calculating state
      setIsCalculating(false);
    }
  };

  // Update last input change timestamp
  useEffect(() => {
    if (inputAmount) {
      setLastInputChange(Date.now());
    }
  }, [inputAmount]);

  // Direct calculation effect - no complex logic
  useEffect(() => {
    console.log("🔄 CALCULATION TRIGGERED:", {
      inputAmount,
      inputToken: inputToken?.symbol,
      outputToken: outputToken?.symbol,
      tokenPrices
    });
    
    // Clear if no input
    if (!inputAmount || inputAmount === "0" || inputAmount === "0." || inputAmount === ".") {
      setOutputAmount("");
      setIsCalculating(false);
      return;
    }
    
    // Clear if no tokens
    if (!inputToken || !outputToken) {
      setIsCalculating(false);
      return;
    }
    
    setIsCalculating(true);
    
    // Simple calculation
    try {
      const numericAmount = parseFloat(inputAmount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setOutputAmount("");
        setIsCalculating(false);
        return;
      }
      
      const inputPrice = tokenPrices[inputToken.symbol as keyof typeof tokenPrices] || 1;
      const outputPrice = tokenPrices[outputToken.symbol as keyof typeof tokenPrices] || 1;
      const inputValueUSD = numericAmount * inputPrice;
      const outputAmountUSD = inputValueUSD / outputPrice;
      
      console.log("💰 CALCULATION RESULT:", {
        inputAmount,
        inputPrice,
        outputPrice,
        outputAmountUSD
      });
      
      setOutputAmount(outputAmountUSD.toFixed(6));
      setIsCalculating(false);
    } catch (error) {
      console.error("❌ Calculation failed:", error);
      setOutputAmount("");
      setIsCalculating(false);
    }
  }, [inputAmount, inputToken, outputToken, tokenPrices]);

  const handleSwap = async () => {
    if (!window.ethereum || !address || !poolInfo || !inputToken || !outputToken || !selectedPool) return;
    
    setLoading(true);
    setMessage("");
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, signer);
      
      // Calculate the expected output amount using AMM formula
      const amountIn = ethers.parseUnits(inputAmount, inputToken.decimals);
      const isInputToken0 = inputToken.isNative === poolInfo.isToken0Native;
      
      // Get reserves in the correct format
      let reserveIn, reserveOut;
      if (isInputToken0) {
        reserveIn = ethers.parseUnits(poolInfo.reserve0, inputToken.decimals);
        reserveOut = ethers.parseUnits(poolInfo.reserve1, outputToken.decimals);
      } else {
        reserveIn = ethers.parseUnits(poolInfo.reserve1, inputToken.decimals);
        reserveOut = ethers.parseUnits(poolInfo.reserve0, outputToken.decimals);
      }
      
      // Calculate output amount based on pool mode
      let amountOut;
      if (poolInfo.fixedRateEnabled) {
        // Fixed 1:1 rate - convert input amount to output token units
        // For 1:1 rate, we need to convert the input amount to the output token's decimal places
        const inputAmountFormatted = ethers.formatUnits(amountIn, inputToken.decimals);
        amountOut = ethers.parseUnits(inputAmountFormatted, outputToken.decimals);
        console.log("Using fixed 1:1 pricing for swap");
        console.log("Input amount:", inputAmountFormatted, inputToken.symbol);
        console.log("Output amount:", ethers.formatUnits(amountOut, outputToken.decimals), outputToken.symbol);
      } else {
        // Check for empty reserves to avoid division by zero
        if (reserveIn === 0n || reserveOut === 0n) {
          throw new Error("Pool has no liquidity. Please add liquidity first.");
        }
        // Use proportional ratio with CEIL to exactly satisfy contract msg.value check
        // amountOut = ceil(amountIn * reserveOut / reserveIn)
        amountOut = (amountIn * reserveOut + (reserveIn - 1n)) / reserveIn;
        console.log("Using AMM pricing for swap");
      }
      
      // For fixed-rate mode, use the original input amount
      // For AMM mode, calculate the required input amount
      const amountInRequired = poolInfo.fixedRateEnabled ? amountIn : (amountOut * reserveIn) / reserveOut;
      const amountOutFormatted = ethers.formatUnits(amountOut, outputToken.decimals);
      
      // Check if the swap is too large (more than 10% of the pool)
      const maxSwapPercent = 0.1; // 10%
      const maxAmountOut = (reserveOut * BigInt(Math.floor(maxSwapPercent * 10000))) / BigInt(10000);
      
      if (amountOut > maxAmountOut) {
        throw new Error(`Swap amount too large. Maximum ${(maxSwapPercent * 100).toFixed(1)}% of pool reserves allowed.`);
      }
      
      // Check if user has enough balance
      const userBalance = inputToken.isNative 
        ? await provider.getBalance(address)
        : await new ethers.Contract(inputToken.address, ERC20_ABI, provider).balanceOf(address);
      
      if (amountIn > userBalance) {
        throw new Error(`Insufficient balance. You have ${ethers.formatUnits(userBalance, inputToken.decimals)} ${inputToken.symbol}`);
      }
      
      console.log("=== DETAILED SWAP CALCULATION DEBUG ===");
      console.log("Input Token:", inputToken.symbol, "Decimals:", inputToken.decimals);
      console.log("Output Token:", outputToken.symbol, "Decimals:", outputToken.decimals);
      console.log("Input Amount (UI):", inputAmount);
      console.log("Amount In Wei:", amountIn.toString());
      console.log("Pool Reserve0 (raw):", poolInfo.reserve0);
      console.log("Pool Reserve1 (raw):", poolInfo.reserve1);
      console.log("Reserve In (parsed):", reserveIn.toString());
      console.log("Reserve Out (parsed):", reserveOut.toString());
      console.log("Amount Out (calculated):", amountOut.toString());
      console.log("Amount In Required (exact):", amountInRequired.toString());
      console.log("Amount In Required (formatted):", ethers.formatUnits(amountInRequired, inputToken.decimals), inputToken.symbol);
      console.log("Amount Out Formatted:", amountOutFormatted);
      console.log("Max Allowed:", ethers.formatUnits(maxAmountOut, outputToken.decimals));
      console.log("Fixed Rate Enabled:", poolInfo.fixedRateEnabled);
      console.log("=== END DEBUG ===");
      
      // Set swap parameters based on which token we're swapping
      let amount0Out, amount1Out;
      if (isInputToken0) {
        // Swapping Token0 (ASL) for Token1 (WASL)
        amount0Out = 0; // No ASL output
        amount1Out = amountOut; // WASL we want to receive
      } else {
        // Swapping Token1 (WASL) for Token0 (ASL)
        amount0Out = amountOut; // ASL we want to receive
        amount1Out = 0; // No WASL output
      }
      
      console.log("=== FINAL SWAP PARAMETERS ===");
      console.log("amount0Out:", amount0Out.toString());
      console.log("amount1Out:", amount1Out.toString());
      console.log("amountIn (msg.value):", amountInRequired.toString());
      console.log("isInputToken0:", isInputToken0);
      console.log("isToken0Native:", poolInfo.isToken0Native);
      console.log("=== END FINAL PARAMETERS ===");
      
      // Handle native token swaps
      if (inputToken.isNative) {
        // For native token swaps, send ETH with the transaction
        const swapTx = await poolContract.swap(amount0Out, amount1Out, address, {
          value: amountInRequired
        });
        await swapTx.wait();
        showMessage("Native token swap completed successfully!");
        setLastSwapTime(Date.now());
        
        // Auto-refresh balances after successful swap
        setTimeout(() => {
          console.log("Auto-refreshing balances after swap...");
          loadPoolInfo(true);
        }, 2000); // Wait 2 seconds for blockchain confirmation
        
      } else {
        // Handle ERC20 token swaps
        // Approve token if needed
        const tokenContract = new ethers.Contract(inputToken.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(address, selectedPool);
        
        if (allowance < amountInRequired) {
          const approveTx = await tokenContract.approve(selectedPool, amountInRequired);
          await approveTx.wait();
          showMessage("Token approved, performing swap...");
      }
      
      // Perform swap
      const swapTx = await poolContract.swap(amount0Out, amount1Out, address);
      await swapTx.wait();
      showMessage("Swap completed successfully!");
      setLastSwapTime(Date.now());
      
      // Auto-refresh balances after successful swap
      setTimeout(() => {
        console.log("Auto-refreshing balances after swap...");
        loadPoolInfo(true);
      }, 2000); // Wait 2 seconds for blockchain confirmation
      }
      
      // Reload pool info
      await loadPoolInfo();
      setInputAmount("");
      setOutputAmount("");
      
    } catch (error: any) {
      console.error("Swap error:", error);
      showMessage(`Swap failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const minReceived = useMemo(() => {
    if (!outputAmount || !outputToken) return "0";
    
    try {
      // Limit decimal places to prevent overflow
      const limitedOutput = parseFloat(outputAmount).toFixed(6);
    const slippage = BigInt(slippageBps);
      const amountOut = ethers.parseUnits(limitedOutput, outputToken.decimals);
    const minAmount = (amountOut * (10000n - slippage)) / 10000n;
    return ethers.formatUnits(minAmount, outputToken.decimals);
    } catch (error) {
      console.error("Error calculating min received:", error);
      return "0";
    }
  }, [outputAmount, outputToken, slippageBps]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-xl mx-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">V3 Pool Swap</h2>
          <a 
            href="/liquidity" 
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Add Liquidity
          </a>
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
        <div className="bg-black/20 border border-border rounded-xl px-4 py-3 flex items-center">
          <input
            value={inputAmount}
            onChange={(e) => {
              const value = e.target.value;
              // Allow only valid decimal numbers
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setInputAmount(value);
              }
            }}
            placeholder="0.0"
            className="flex-grow bg-transparent text-lg focus:outline-none"
            type="text"
            inputMode="decimal"
          />
          {inputAmount && inputToken && (
            <span className="text-lg ml-2">
              {inputToken.symbol}
            </span>
          )}
        </div>
        {inputToken && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>
                Balance: {inputToken.isNative 
                  ? (poolInfo?.userNativeBalance ? `${parseFloat(poolInfo.userNativeBalance).toFixed(2)} ${inputToken.symbol}` : "Loading...")
                  : (poolInfo?.userToken0Balance ? `${parseFloat(poolInfo.userToken0Balance).toFixed(2)} ${inputToken.symbol}` : "Loading...")
                }
              </span>
              <button
                onClick={() => {
                  console.log("Refreshing input token balance...");
                  loadPoolInfo(true);
                }}
                className="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
                disabled={isRefreshing}
              >
                {isRefreshing ? "⏳" : "🔄"}
              </button>
            </div>
            <div className="text-xs flex items-center gap-1">
              <span className="text-green-400">
                Price: ${tokenPrices[inputToken.symbol as keyof typeof tokenPrices]?.toFixed(2) || "N/A"}
              </span>
              {priceChanges[inputToken.symbol as keyof typeof priceChanges] !== 0 && (
                <span className={`text-xs ${
                  priceChanges[inputToken.symbol as keyof typeof priceChanges] > 0 
                    ? 'text-green-500' 
                    : 'text-red-500'
                }`}>
                  {priceChanges[inputToken.symbol as keyof typeof priceChanges] > 0 ? '↗' : '↘'}
                  {Math.abs(priceChanges[inputToken.symbol as keyof typeof priceChanges]).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}
        
        <TokenSelect
          tokens={V3_TOKENS}
          value={outputToken}
          onChange={setOutputToken}
          label="You receive"
        />
        <div className="bg-black/20 border border-border rounded-xl px-4 py-3 min-h-[48px] flex items-center">
          {isCalculating ? (
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Calculating...
            </span>
          ) : outputAmount ? (
            <div className="flex items-center w-full">
              <span className="text-lg flex-grow">
                {outputAmount}
              </span>
              {outputToken && (
                <span className="text-lg ml-2">
                  {outputToken.symbol}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500">Enter an amount to preview</span>
          )}
        </div>
        
        {outputToken && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>
                Balance: {outputToken.isNative 
                  ? (poolInfo?.userNativeBalance ? `${parseFloat(poolInfo.userNativeBalance).toFixed(2)} ${outputToken.symbol}` : "Loading...")
                  : (poolInfo?.userToken1Balance ? `${parseFloat(poolInfo.userToken1Balance).toFixed(2)} ${outputToken.symbol}` : "Loading...")
                }
              </span>
              <button
                onClick={() => {
                  console.log("Refreshing output token balance...");
                  loadPoolInfo(true);
                }}
                className="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
                disabled={isRefreshing}
              >
                {isRefreshing ? "⏳" : "🔄"}
              </button>
            </div>
            <div className="text-xs flex items-center gap-1">
              <span className="text-green-400">
                Price: ${tokenPrices[outputToken.symbol as keyof typeof tokenPrices]?.toFixed(2) || "N/A"}
              </span>
              {priceChanges[outputToken.symbol as keyof typeof priceChanges] !== 0 && (
                <span className={`text-xs ${
                  priceChanges[outputToken.symbol as keyof typeof priceChanges] > 0 
                    ? 'text-green-500' 
                    : 'text-red-500'
                }`}>
                  {priceChanges[outputToken.symbol as keyof typeof priceChanges] > 0 ? '↗' : '↘'}
                  {Math.abs(priceChanges[outputToken.symbol as keyof typeof priceChanges]).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}
        
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
          {poolInfo?.fixedRateEnabled && (
            <p className="text-green-400 font-semibold">🔒 Fixed 1:1 Rate Mode</p>
          )}
          <p>Your LP balance: {poolInfo ? `${poolInfo.userBalance}` : "-"}</p>
          <p>Your ASL balance: {poolInfo ? `${poolInfo.userNativeBalance} ASL` : "-"}</p>
          {poolInfo && (
            <>
              <p>Token0 balance: {poolInfo.userToken0Balance}</p>
              <p>Token1 balance: {poolInfo.userToken1Balance}</p>
            </>
          )}
          {selectedPool && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500">
                Pool: {selectedPool.slice(0, 6)}...{selectedPool.slice(-4)}
              </p>
              <button
                onClick={() => {
                  console.log("Force refreshing pool info...");
                  loadPoolInfo(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                disabled={isRefreshing}
              >
                {isRefreshing ? "⏳ Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
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