"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ethers } from "ethers";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { V3_TOKENS, findV3Token, type V3TokenInfo } from "@/lib/v3Tokens";
import { clsx } from "clsx";

// TokenBalanceDisplay component
function TokenBalanceDisplay({ token, tokenPrices, priceChanges, poolInfo, calculateASLPrice }: { 
  token: V3TokenInfo; 
  tokenPrices: any; 
  priceChanges: any;
  poolInfo?: PoolInfo | null;
  calculateASLPrice?: () => number;
}) {
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
          // Format to reasonable decimal places, but don't truncate large numbers
          const numericFormatted = parseFloat(formatted);
          const formatted2dp = numericFormatted > 1000 
            ? numericFormatted.toFixed(0) 
            : numericFormatted.toFixed(2);
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
          // Format to reasonable decimal places, but don't truncate large numbers
          const numericFormatted = parseFloat(formatted);
          const formatted2dp = numericFormatted > 1000 
            ? numericFormatted.toFixed(0) 
            : numericFormatted.toFixed(2);
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
      </div>
      <div className="text-xs flex items-center gap-1">
        <span className="text-green-400">
          Price: ${token.symbol === 'ASL' && poolInfo && calculateASLPrice
            ? calculateASLPrice().toFixed(3) 
            : token.symbol === 'ASL' && !poolInfo
            ? "Loading..."
            : tokenPrices[token.symbol as keyof typeof tokenPrices]?.toFixed(2) || "N/A"}
        </span>
        {(() => {
          const priceChange = priceChanges[token.symbol as keyof typeof priceChanges];
          console.log(`🔍 Price change for ${token.symbol}:`, priceChange);
          return priceChange !== 0 && (
            <span className={`text-xs ${
              priceChange > 0 
                ? 'text-green-500' 
                : 'text-red-500'
            }`}>
              {priceChange > 0 ? '↗' : '↘'}
              {Math.abs(priceChange).toFixed(3)}
            </span>
          );
        })()}
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
    <div className="flex flex-col gap-1">
      {label && <span className="text-xl font-semibold text-white">{label}</span>}
      <select
        value={value?.address || ""}
        onChange={(e) => {
          const token = tokens.find(t => t.address === e.target.value);
          if (token) onChange(token);
        }}
        className="w-36 bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Select token</option>
        {tokens.map((token) => (
          <option key={token.address} value={token.address}>
            {token.symbol}
          </option>
        ))}
      </select>
    </div>
  );
}

// Native V3 Pool ABI (supports native token swaps)
const NATIVE_V3_POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function isToken0Native() view returns (bool)",
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
  token0Decimals: number;
  token1Decimals: number;
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
  const [slippageBps, setSlippageBps] = useState(10); // 0.1% (more conservative default)
  const [mounted, setMounted] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string>("");
  const [lastSwapTime, setLastSwapTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastInputChange, setLastInputChange] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Function to show message with auto-dismiss
  const showMessage = useCallback((msg: string, duration: number = 5000) => {
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
  }, [messageTimeout]);
  
  // Dynamic price oracle with pool-based pricing
  const [tokenPrices, setTokenPrices] = useState({
    ASL: 0.80, // More realistic default based on typical pool ratios
    WASL: 0.80,
    AUSD: 1.00
  });
  const [priceChanges, setPriceChanges] = useState({
    ASL: 0,
    WASL: 0,
    AUSD: 0
  });

  // Calculate real ASL price from pool reserves
  const calculateASLPrice = useCallback(() => {
    if (!poolInfo) return 0.80; // More realistic default fallback
    
    try {
      const aslReserve = poolInfo.isToken0Native 
        ? parseFloat(ethers.formatUnits(BigInt(poolInfo.reserve0), poolInfo.token0Decimals))
        : parseFloat(ethers.formatUnits(BigInt(poolInfo.reserve1), poolInfo.token1Decimals));
      const ausdReserve = poolInfo.isToken0Native 
        ? parseFloat(ethers.formatUnits(BigInt(poolInfo.reserve1), poolInfo.token1Decimals))
        : parseFloat(ethers.formatUnits(BigInt(poolInfo.reserve0), poolInfo.token0Decimals));
      
      if (aslReserve > 0) {
        const realASLPrice = ausdReserve / aslReserve;
        console.log("💰 Real ASL price from pool:", realASLPrice, "USD");
        console.log("Pool reserves:", aslReserve, "ASL /", ausdReserve, "AUSD");
        return realASLPrice;
      }
    } catch (error) {
      console.error("Error calculating ASL price from pool:", error);
    }
    
    return 0.80; // Default fallback
  }, [poolInfo]);

  // Pool addresses (deployed on AssetLayer Testnet - updated with CORRECT ASL/AUSD pool)
  const POOL_ADDRESSES = {
    "asl-wasl": "0xC6c1fCd59976a3CEBA5d0dbd1b347618526A2826", // ASL/WASL Pool
    "asl-ausd": "0x70AC194EdC0f2FB9D6f9B20692Af882AeF7601Bc", // CORRECT ASL/AUSD Pool
    "wasl-ausd": "0x79a07040731C3a56f5B4385C4c716544a8D5c32B"  // WASL/AUSD Pool
  };

  // Function to determine pool based on selected tokens
  const getPoolForTokens = (tokenA: V3TokenInfo | undefined, tokenB: V3TokenInfo | undefined) => {
    if (!tokenA || !tokenB) {
      console.log("getPoolForTokens: Missing tokens", { tokenA: tokenA?.symbol, tokenB: tokenB?.symbol });
      return null;
    }
    
    const isASL = (token: V3TokenInfo) => token.isNative;
    const isWASL = (token: V3TokenInfo) => token.symbol === "WASL";
    const isAUSD = (token: V3TokenInfo) => token.symbol === "AUSD";
    
    console.log("getPoolForTokens: Checking token combination", {
      tokenA: { symbol: tokenA.symbol, isNative: tokenA.isNative },
      tokenB: { symbol: tokenB.symbol, isNative: tokenB.isNative },
      isASL_A: isASL(tokenA),
      isWASL_A: isWASL(tokenA),
      isAUSD_A: isAUSD(tokenA),
      isASL_B: isASL(tokenB),
      isWASL_B: isWASL(tokenB),
      isAUSD_B: isAUSD(tokenB)
    });
    
    if ((isASL(tokenA) && isWASL(tokenB)) || (isWASL(tokenA) && isASL(tokenB))) {
      console.log("Selected ASL/WASL pool");
      return POOL_ADDRESSES["asl-wasl"];
    } else if ((isASL(tokenA) && isAUSD(tokenB)) || (isAUSD(tokenA) && isASL(tokenB))) {
      console.log("Selected ASL/AUSD pool");
      return POOL_ADDRESSES["asl-ausd"];
    } else if ((isWASL(tokenA) && isAUSD(tokenB)) || (isAUSD(tokenA) && isWASL(tokenB))) {
      // Temporarily disable WASL/AUSD pool until it's seeded
      console.log("WASL/AUSD pool temporarily disabled - no liquidity");
      return null;
    }
    console.log("No matching pool found");
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

  const loadPoolInfo = useCallback(async (showRefreshIndicator = false) => {
    if (!window.ethereum || !selectedPool || !address) {
      console.log("loadPoolInfo: Missing requirements", { 
        hasEthereum: !!window.ethereum, 
        selectedPool, 
        address 
      });
      return;
    }

    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      console.log("Loading pool info for:", selectedPool);
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // First, check if the contract exists by trying to get the code
      const code = await provider.getCode(selectedPool);
      if (code === "0x") {
        throw new Error("No contract found at this address");
      }
      console.log("Contract code found, length:", code.length);
      
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, provider);

      const zeroAddress = ethers.ZeroAddress.toLowerCase();

      console.log("Calling pool contract methods...");
      
      // Try calling methods one by one to identify which one fails
      let rawToken0, isToken0Native, rawReserves;
      
      try {
        console.log("Calling token0()...");
        rawToken0 = await poolContract.token0();
        console.log("token0() result:", rawToken0);
      } catch (error) {
        console.error("token0() failed:", error);
        throw error;
      }
      
      try {
        console.log("Calling isToken0Native()...");
        isToken0Native = await poolContract.isToken0Native();
        console.log("isToken0Native() result:", isToken0Native);
      } catch (error) {
        console.error("isToken0Native() failed:", error);
        throw error;
      }
      
      try {
        console.log("Calling getReserves()...");
        rawReserves = await poolContract.getReserves();
        console.log("getReserves() result:", rawReserves);
      } catch (error) {
        console.error("getReserves() failed:", error);
        throw error;
      }

      let fixedRateEnabled = false;
      try {
        console.log("Calling fixedRateEnabled()...");
        fixedRateEnabled = await poolContract.fixedRateEnabled();
        console.log("fixedRateEnabled() result:", fixedRateEnabled);
      } catch (error) {
        console.log("fixedRateEnabled not available, defaulting to false");
        fixedRateEnabled = false;
      }

      const token0Address = isToken0Native ? zeroAddress : rawToken0.toLowerCase();
      // For native pools, we need to determine the correct token1 address
      // The pool contract should have both tokens, let's get the actual token1
      let token1Address;
      try {
        // Try to get token1 directly from the pool
        const token1Result = await poolContract.token1();
        token1Address = token1Result.toLowerCase();
        console.log("token1() result:", token1Result);
      } catch (error) {
        console.log("token1() not available, using fallback logic");
        // Fallback: determine token1 based on the pool type and token0
        // If token0 is native, token1 should be the ERC20 token
        // If token0 is ERC20, token1 should be native (zero address)
        if (isToken0Native) {
          // Token0 is native (ASL), so token1 should be the ERC20 token (AUSD)
          // The token0() function returns the ERC20 token address when isToken0Native = true
          token1Address = rawToken0.toLowerCase(); // Use the ERC20 token address
        } else {
          // Token0 is ERC20, so token1 should be native
          token1Address = zeroAddress;
        }
      }

      console.log("=== POOL DATA DEBUG ===");
      console.log("Selected pool address:", selectedPool);
      console.log("Raw token0 from contract:", rawToken0);
      console.log("Token0 address:", token0Address);
      console.log("Token1 address:", token1Address);
      console.log("Is token0 native:", isToken0Native);
      console.log("Zero address:", zeroAddress);
      console.log("Reserves:", [rawReserves[0].toString(), rawReserves[1].toString()]);
      console.log("Fixed rate enabled:", fixedRateEnabled);
      console.log("=== END POOL DEBUG ===");

      // Determine token info based on which is native
      const token0Info = isToken0Native 
        ? V3_TOKENS.find(t => t.isNative) 
        : findV3Token(token0Address);
      const token1Info = isToken0Native 
        ? findV3Token(token1Address) 
        : V3_TOKENS.find(t => t.isNative);

      const token0Decimals = token0Info?.decimals ?? 18;
      const token1Decimals = token1Info?.decimals ?? 18;

      const userNativeBalance = await provider.getBalance(address);

      let userToken0Balance: bigint = 0n;
      let userToken1Balance: bigint = 0n;

      if (isToken0Native) {
        // Token0 is native ASL, Token1 is ERC20
        userToken0Balance = userNativeBalance;
        if (token0Address !== zeroAddress) {
          const token1Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
          userToken1Balance = await token1Contract.balanceOf(address);
          console.log("Token1 (ERC20) balance (raw):", userToken1Balance.toString());
        }
      } else {
        // Token0 is ERC20, Token1 is native ASL
        if (token0Address !== zeroAddress) {
          const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
          userToken0Balance = await token0Contract.balanceOf(address);
          console.log("Token0 (ERC20) balance (raw):", userToken0Balance.toString());
        }
        userToken1Balance = userNativeBalance;
      }

      const userLPBalance = await poolContract.balanceOf(address);

      const formattedToken0Balance = isToken0Native
        ? ethers.formatEther(userToken0Balance)
        : ethers.formatUnits(userToken0Balance, token0Decimals);
      const formattedToken1Balance = isToken0Native
        ? ethers.formatUnits(userToken1Balance, token1Decimals)
        : ethers.formatEther(userToken1Balance);

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
        token0: token0Address,
        token1: token1Address,
        reserve0: rawReserves[0].toString(),
        reserve1: rawReserves[1].toString(),
        token0Decimals,
        token1Decimals,
        userBalance: ethers.formatUnits(userLPBalance, 18),
        userNativeBalance: ethers.formatEther(userNativeBalance),
        isToken0Native: isToken0Native,
        poolAddress: selectedPool,
        userToken0Balance: formattedToken0Balance,
        userToken1Balance: formattedToken1Balance,
        fixedRateEnabled
      });
    } catch (error) {
      console.error("Error loading pool info:", error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("call revert exception")) {
          showMessage("Pool contract not found or not deployed at this address");
        } else if (error.message.includes("network")) {
          showMessage("Network connection error. Please check your wallet connection.");
        } else if (error.message.includes("gas")) {
          showMessage("Transaction failed due to gas estimation error");
        } else {
          showMessage(`Error loading pool information: ${error.message}`);
        }
      } else {
        showMessage("Error loading pool information");
      }
    } finally {
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
    }
  }, [address, selectedPool, showMessage]);

  const handleSwap = useCallback(async () => {
    if (!window.ethereum || !address || !poolInfo || !inputToken || !outputToken || !selectedPool) return;

    // Validate input amount
    if (!inputAmount || inputAmount === "0" || inputAmount === "0." || inputAmount === ".") {
      showMessage("Please enter a valid amount to swap");
      return;
    }

    const numericAmount = parseFloat(inputAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showMessage("Please enter a valid amount greater than 0");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, signer);

      // Calculate the expected output amount using AMM formula
      const amountIn = ethers.parseUnits(inputAmount, inputToken.decimals);
      const zeroAddress = ethers.ZeroAddress.toLowerCase();
      const poolToken0 = poolInfo.token0.toLowerCase();
      const poolToken1 = poolInfo.token1.toLowerCase();
      const inputTokenAddress = inputToken.isNative ? zeroAddress : inputToken.address.toLowerCase();
      const outputTokenAddress = outputToken.isNative ? zeroAddress : outputToken.address.toLowerCase();

      console.log("=== TOKEN ADDRESS DEBUG ===");
      console.log("Pool Token0:", poolToken0);
      console.log("Pool Token1:", poolToken1);
      console.log("Input Token:", inputToken.symbol, "Address:", inputTokenAddress, "Is Native:", inputToken.isNative);
      console.log("Output Token:", outputToken.symbol, "Address:", outputTokenAddress, "Is Native:", outputToken.isNative);
      console.log("Input Token Address in pool tokens:", [poolToken0, poolToken1].includes(inputTokenAddress));
      console.log("Output Token Address in pool tokens:", [poolToken0, poolToken1].includes(outputTokenAddress));
      console.log("=== END DEBUG ===");

      if (![poolToken0, poolToken1].includes(inputTokenAddress) || ![poolToken0, poolToken1].includes(outputTokenAddress)) {
        throw new Error("Selected tokens are not supported by this pool");
      }

      const isInputToken0 = inputTokenAddress === poolToken0;
      const isOutputToken0 = outputTokenAddress === poolToken0;

      const reserve0 = BigInt(poolInfo.reserve0);
      const reserve1 = BigInt(poolInfo.reserve1);

      const reserveIn = isInputToken0 ? reserve0 : reserve1;
      const reserveOut = isInputToken0 ? reserve1 : reserve0;
      const formattedReserve0 = ethers.formatUnits(reserve0, poolInfo.token0Decimals);
      const formattedReserve1 = ethers.formatUnits(reserve1, poolInfo.token1Decimals);

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
        // Use the same proportional formula as the pool contract
        // amountOut = (amountIn * reserveOut) / reserveIn
        amountOut = (amountIn * reserveOut) / reserveIn;
        console.log("Using AMM pricing for swap");
        console.log("🔍 AMM Calculation Debug:", {
          amountIn: amountIn.toString(),
          amountInFormatted: ethers.formatUnits(amountIn, inputToken.decimals),
          reserveIn: reserveIn.toString(),
          reserveOut: reserveOut.toString(),
          calculatedAmountOut: amountOut.toString(),
          calculatedAmountOutFormatted: ethers.formatUnits(amountOut, outputToken.decimals)
        });
        
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
      console.log("Pool Reserve0 (formatted):", formattedReserve0);
      console.log("Pool Reserve1 (raw):", poolInfo.reserve1);
      console.log("Pool Reserve1 (formatted):", formattedReserve1);
      console.log("Reserve In (parsed):", reserveIn.toString());
      console.log("Reserve Out (parsed):", reserveOut.toString());
      console.log("Amount Out (calculated):", amountOut.toString());
      console.log("Amount Out (formatted):", ethers.formatUnits(amountOut, outputToken.decimals));
      console.log("Amount In Required (exact):", amountInRequired.toString());
      console.log("Amount In Required (formatted):", ethers.formatUnits(amountInRequired, inputToken.decimals), inputToken.symbol);
      console.log("Amount Out Formatted:", amountOutFormatted);
      console.log("Max Allowed:", ethers.formatUnits(maxAmountOut, outputToken.decimals));
      console.log("Fixed Rate Enabled:", poolInfo.fixedRateEnabled);
      console.log("isInputToken0:", isInputToken0);
      console.log("isOutputToken0:", isOutputToken0);
      console.log("=== END DEBUG ===");

      // Check if amountOut is valid
      if (amountOut === 0n) {
        throw new Error("Calculated output amount is zero. Please check your input amount and try again.");
      }

      // Set swap parameters based on which token we're swapping
      let amount0Out = 0n;
      let amount1Out = 0n;
      if (isOutputToken0) {
        amount0Out = amountOut;
      } else {
        amount1Out = amountOut;
      }

      console.log("=== FINAL SWAP PARAMETERS ===");
      console.log("amount0Out:", amount0Out.toString());
      console.log("amount1Out:", amount1Out.toString());
      console.log("amountIn (msg.value):", amountInRequired.toString());
      console.log("isInputToken0:", isInputToken0);
      console.log("isOutputToken0:", isOutputToken0);
      console.log("=== END FINAL PARAMETERS ===");

      // Handle native token swaps
      if (inputToken.isNative) {
        // For native token swaps, send ETH with the transaction
        let swapTx, receipt;
        try {
          // First, try to estimate gas to catch potential issues early
          const gasEstimate = await poolContract.swap.estimateGas(amount0Out, amount1Out, address, {
            value: amountInRequired
          });
          console.log("Gas estimate:", gasEstimate.toString());
          
          swapTx = await poolContract.swap(amount0Out, amount1Out, address, {
            value: amountInRequired,
            gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
          });
          receipt = await swapTx.wait();
          showMessage("Native token swap completed successfully!");
          setLastSwapTime(Date.now());
        } catch (gasError) {
          console.error("Gas estimation failed:", gasError);
          const errorMessage = gasError instanceof Error ? gasError.message : "Unknown error";
          throw new Error(`Gas estimation failed: ${errorMessage}. Please check if the pool has sufficient liquidity and try again.`);
        }

        // Send transaction summary to AI copilot
        // Get actual amounts from the transaction (use the user's input amount and calculated output)
        const actualAmountIn = inputAmount; // Use the user's actual input amount
        const actualAmountOut = ethers.formatUnits(amountOut, outputToken.decimals);
        
        console.log('📊 Manual Trade Amounts:', {
          userInput: inputAmount,
          calculatedOutput: ethers.formatUnits(amountOut, outputToken.decimals),
          contractInput: ethers.formatUnits(amountInRequired, inputToken.decimals)
        });
        
        console.log('📊 Transaction Summary:', {
          calculated: { amountIn: inputAmount, amountOut: outputAmount },
          formatted: { amountIn: actualAmountIn, amountOut: actualAmountOut },
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol,
          warning: 'Using calculated amountOut - may not reflect actual received amount due to slippage/fees'
        });
        
        const transactionSummary = {
          success: true,
          transactionHash: swapTx.hash,
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          amountIn: actualAmountIn,
          amountOut: actualAmountOut,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: Date.now(),
          source: 'manual' // Flag to indicate this was a manual trade
        };

        console.log('🚀 Dispatching swapCompleted event for manual trade:', transactionSummary);
        console.log('🔍 Transaction Debug:', {
          inputAmount: inputAmount,
          outputAmount: outputAmount,
          actualAmountIn: actualAmountIn,
          actualAmountOut: actualAmountOut,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol
        });
        const summaryEvent = new CustomEvent('swapCompleted', {
          detail: transactionSummary
        });
        window.dispatchEvent(summaryEvent);
        console.log('✅ swapCompleted event dispatched');

        // Immediately update price changes based on the swap
        const preSwapASLPrice = calculateASLPrice();
        console.log("🔍 Pre-swap ASL price:", preSwapASLPrice);
        
        // Calculate expected price change based on swap impact
        const swapAmountASL = parseFloat(inputAmount);
        const expectedPriceChange = -(swapAmountASL * 0.001); // Rough estimate of price impact
        console.log("🔍 Expected price change from swap:", expectedPriceChange);
        
        // Update price changes immediately
        setPriceChanges(prev => {
          const newChanges = {
            ...prev,
            ASL: expectedPriceChange
          };
          console.log("📈 Setting price changes:", newChanges);
          return newChanges;
        });
        
        console.log("📈 Immediate ASL price change update:", expectedPriceChange);

        // Auto-refresh balances after successful swap and track actual price changes
        setTimeout(() => {
          console.log("Auto-refreshing balances after swap...");
          
          loadPoolInfo(true).then(() => {
            // Calculate actual price change after swap
            const postSwapASLPrice = calculateASLPrice();
            const actualPriceChange = postSwapASLPrice - preSwapASLPrice;
            
            console.log("🔍 Post-swap ASL price:", postSwapASLPrice);
            console.log("🔍 Actual price change calculated:", actualPriceChange);
            
            // Update with actual price change
            setPriceChanges(prev => ({
              ...prev,
              ASL: actualPriceChange
            }));
            
            console.log("📈 Actual post-swap ASL price change:", {
              preSwap: preSwapASLPrice,
              postSwap: postSwapASLPrice,
              change: actualPriceChange
            });
            
            // Clear price changes after 30 seconds
            setTimeout(() => {
              setPriceChanges(prev => ({
                ...prev,
                ASL: 0
              }));
              console.log("🔄 Cleared ASL price change indicator");
            }, 30000);
          });
        }, 2000); // Wait 2 seconds for blockchain confirmation


      } else {
        // Handle ERC20 token swaps
        let swapTx, receipt;
        try {
          // Approve token if needed
          const tokenContract = new ethers.Contract(inputToken.address, ERC20_ABI, signer);
          const allowance = await tokenContract.allowance(address, selectedPool);

          if (allowance < amountInRequired) {
            const approveTx = await tokenContract.approve(selectedPool, amountInRequired);
            await approveTx.wait();
            showMessage("Token approved, performing swap...");
          }

          // First, try to estimate gas to catch potential issues early
          const gasEstimate = await poolContract.swap.estimateGas(amount0Out, amount1Out, address);
          console.log("Gas estimate:", gasEstimate.toString());

          // Perform swap
          swapTx = await poolContract.swap(amount0Out, amount1Out, address, {
            gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
          });
          receipt = await swapTx.wait();
          showMessage("Swap completed successfully!");
          setLastSwapTime(Date.now());
        } catch (gasError) {
          console.error("Gas estimation failed:", gasError);
          const errorMessage = gasError instanceof Error ? gasError.message : "Unknown error";
          throw new Error(`Gas estimation failed: ${errorMessage}. Please check if the pool has sufficient liquidity and try again.`);
        }

        // Send transaction summary to AI copilot
        // Get actual amounts from the transaction (use the user's input amount and calculated output)
        const actualAmountIn = inputAmount; // Use the user's actual input amount
        const actualAmountOut = ethers.formatUnits(amountOut, outputToken.decimals);
        
        console.log('📊 Manual Trade Amounts:', {
          userInput: inputAmount,
          calculatedOutput: ethers.formatUnits(amountOut, outputToken.decimals),
          contractInput: ethers.formatUnits(amountInRequired, inputToken.decimals)
        });
        
        console.log('📊 Transaction Summary:', {
          calculated: { amountIn: inputAmount, amountOut: outputAmount },
          formatted: { amountIn: actualAmountIn, amountOut: actualAmountOut },
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol,
          warning: 'Using calculated amountOut - may not reflect actual received amount due to slippage/fees'
        });
        
        const transactionSummary = {
          success: true,
          transactionHash: swapTx.hash,
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          amountIn: actualAmountIn,
          amountOut: actualAmountOut,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: Date.now(),
          source: 'manual' // Flag to indicate this was a manual trade
        };

        console.log('🚀 Dispatching swapCompleted event for manual trade:', transactionSummary);
        console.log('🔍 Transaction Debug:', {
          inputAmount: inputAmount,
          outputAmount: outputAmount,
          actualAmountIn: actualAmountIn,
          actualAmountOut: actualAmountOut,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol
        });
        const summaryEvent = new CustomEvent('swapCompleted', {
          detail: transactionSummary
        });
        window.dispatchEvent(summaryEvent);
        console.log('✅ swapCompleted event dispatched');

        // Immediately update price changes based on the swap
        const preSwapASLPrice = calculateASLPrice();
        console.log("🔍 Pre-swap ASL price:", preSwapASLPrice);
        
        // Calculate expected price change based on swap impact
        const swapAmountASL = parseFloat(inputAmount);
        const expectedPriceChange = -(swapAmountASL * 0.001); // Rough estimate of price impact
        console.log("🔍 Expected price change from swap:", expectedPriceChange);
        
        // Update price changes immediately
        setPriceChanges(prev => {
          const newChanges = {
            ...prev,
            ASL: expectedPriceChange
          };
          console.log("📈 Setting price changes:", newChanges);
          return newChanges;
        });
        
        console.log("📈 Immediate ASL price change update:", expectedPriceChange);

        // Auto-refresh balances after successful swap and track actual price changes
        setTimeout(() => {
          console.log("Auto-refreshing balances after swap...");
          
          loadPoolInfo(true).then(() => {
            // Calculate actual price change after swap
            const postSwapASLPrice = calculateASLPrice();
            const actualPriceChange = postSwapASLPrice - preSwapASLPrice;
            
            console.log("🔍 Post-swap ASL price:", postSwapASLPrice);
            console.log("🔍 Actual price change calculated:", actualPriceChange);
            
            // Update with actual price change
            setPriceChanges(prev => ({
              ...prev,
              ASL: actualPriceChange
            }));
            
            console.log("📈 Actual post-swap ASL price change:", {
              preSwap: preSwapASLPrice,
              postSwap: postSwapASLPrice,
              change: actualPriceChange
            });
            
            // Clear price changes after 30 seconds
            setTimeout(() => {
              setPriceChanges(prev => ({
                ...prev,
                ASL: 0
              }));
              console.log("🔄 Cleared ASL price change indicator");
            }, 30000);
          });
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
  }, [address, poolInfo, inputAmount, inputToken, loadPoolInfo, outputAmount, outputToken, selectedPool, showMessage]);

  // Listen for AI trade requests
  useEffect(() => {
    let autoExecuteTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleAITradeRequest = (event: CustomEvent) => {
      const { signal, action, amount, token, fromToken, toToken, autoExecute } = event.detail;
      console.log('AI Trade Request received:', { signal, action, amount, token, fromToken, toToken, autoExecute });

      // Set the input token (prioritize fromToken if available)
      if (fromToken) {
        setInputToken(fromToken);
      } else if (token) {
        setInputToken(token);
      }

      // Set the output token if available
      if (toToken) {
        setOutputToken(toToken);
      }

      // Set the input amount
      if (amount) {
        setInputAmount(amount.toString());
        // Trigger output calculation by setting a small delay
        setTimeout(() => {
          if (inputToken && outputToken) {
            calculateOutputAmount(amount.toString(), inputToken, outputToken);
          }
        }, 100);
      }

      // Show a message that the form has been filled
      const tokenSymbol = fromToken?.symbol || token?.symbol || 'token';
      showMessage(`AI has filled the swap form: ${amount} ${tokenSymbol}`, 3000);

      // Auto-execute the swap if requested
      if (autoExecute) {
        // Wait a moment for the form to be populated, then execute
        if (autoExecuteTimeout) {
          clearTimeout(autoExecuteTimeout);
        }
        autoExecuteTimeout = setTimeout(() => {
          console.log('Auto-executing swap...');
          handleSwap();
        }, 1000);
      }
    };

    window.addEventListener('aiTradeRequest', handleAITradeRequest as EventListener);

    return () => {
      if (autoExecuteTimeout) {
        clearTimeout(autoExecuteTimeout);
      }
      window.removeEventListener('aiTradeRequest', handleAITradeRequest as EventListener);
    };
  }, [handleSwap, showMessage]);

  // Update selected pool when tokens change
  useEffect(() => {
    const poolAddress = getPoolForTokens(inputToken, outputToken);
    console.log("Selected pool for tokens:", poolAddress);
    console.log("Input token:", inputToken?.symbol);
    console.log("Output token:", outputToken?.symbol);
    console.log("Pool addresses available:", POOL_ADDRESSES);
    setSelectedPool(poolAddress || "");
    
    // Clear pool info when pool changes
    if (!poolAddress) {
      setPoolInfo(null);
    }
  }, [inputToken, outputToken]);

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
  }, [isConnected, address, selectedPool, lastSwapTime, loadPoolInfo]);

  useEffect(() => {
    if (isConnected && address && selectedPool && selectedPool !== "") {
      console.log("Loading pool info for selected pool:", selectedPool);
      loadPoolInfo();
    } else {
      console.log("Not loading pool info:", { isConnected, address, selectedPool });
    }
  }, [isConnected, address, selectedPool, loadPoolInfo]);


  // Update ASL price when pool info changes
  useEffect(() => {
    if (poolInfo) {
      const realASLPrice = calculateASLPrice();
      console.log("🔄 Updating ASL price from pool:", realASLPrice);
      
      setTokenPrices(prev => {
        const oldASLPrice = prev.ASL;
        const priceChange = realASLPrice - oldASLPrice;
        
        // Update price changes to reflect the actual change
        setPriceChanges(prevChanges => ({
          ...prevChanges,
          ASL: priceChange
        }));
        
        console.log("📊 ASL Price Change:", {
          old: oldASLPrice,
          new: realASLPrice,
          change: priceChange
        });
        
        return {
          ...prev,
          ASL: realASLPrice
        };
      });
    }
  }, [poolInfo, calculateASLPrice]);

  // Add small price variations for all tokens
  useEffect(() => {
    const updateTokenPrices = () => {
      setTokenPrices(prev => {
        const newPrices = { ...prev };
        const newChanges = { ...priceChanges };
        
        // AUSD has small stablecoin volatility (±0.1% around $1.00)
        const ausdChange = (Math.random() - 0.5) * 0.002; // ±0.1% change
        const oldAUSD = prev.AUSD;
        newPrices.AUSD = Math.max(0.998, Math.min(1.002, prev.AUSD + ausdChange));
        newChanges.AUSD = newPrices.AUSD - oldAUSD;
        
        // ASL has moderate volatility around the pool price (±0.5%)
        if (prev.ASL > 0) {
          const aslChange = (Math.random() - 0.5) * 0.01; // ±0.5% change
          const oldASL = prev.ASL;
          newPrices.ASL = Math.max(prev.ASL * 0.995, Math.min(prev.ASL * 1.005, prev.ASL + aslChange));
          newChanges.ASL = newPrices.ASL - oldASL;
        }
        
        // WASL follows ASL with slight variation (±0.2% from ASL price)
        if (prev.ASL > 0) {
          const waslChange = (Math.random() - 0.5) * 0.004; // ±0.2% variation from ASL
          const oldWASL = prev.WASL;
          newPrices.WASL = Math.max(prev.ASL * 0.998, Math.min(prev.ASL * 1.002, prev.ASL + waslChange));
          newChanges.WASL = newPrices.WASL - oldWASL;
        }
        
        // Update price changes
        setPriceChanges(newChanges);
        
        console.log("📈 Token price update:", {
          ASL: newPrices.ASL,
          AUSD: newPrices.AUSD,
          WASL: newPrices.WASL,
          changes: newChanges
        });
        
        return newPrices;
      });
    };

    const interval = setInterval(updateTokenPrices, 15000); // Every 15 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);


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
      const zeroAddress = ethers.ZeroAddress.toLowerCase();
      const poolToken0 = poolInfo.token0.toLowerCase();
      const poolToken1 = poolInfo.token1.toLowerCase();
      const inputTokenAddress = tokenIn.isNative ? zeroAddress : tokenIn.address.toLowerCase();
      const outputTokenAddress = tokenOut.isNative ? zeroAddress : tokenOut.address.toLowerCase();

      if (![poolToken0, poolToken1].includes(inputTokenAddress) || ![poolToken0, poolToken1].includes(outputTokenAddress)) {
        console.log("❌ Token mismatch with pool configuration", { inputTokenAddress, outputTokenAddress, poolToken0, poolToken1 });
        setOutputAmount("");
        setIsCalculating(false);
        return;
      }

      const isInputToken0 = inputTokenAddress === poolToken0;
      const reserve0 = BigInt(poolInfo.reserve0);
      const reserve1 = BigInt(poolInfo.reserve1);
      const reserveIn = isInputToken0 ? reserve0 : reserve1;
      const reserveOut = isInputToken0 ? reserve1 : reserve0;
      const formattedReserve0 = ethers.formatUnits(reserve0, poolInfo.token0Decimals);
      const formattedReserve1 = ethers.formatUnits(reserve1, poolInfo.token1Decimals);

      console.log("📊 Swap calculation debug:", {
        amountIn: amountIn,
        amountInWei: amountInWei.toString(),
        reserveIn: reserveIn.toString(),
        reserveOut: reserveOut.toString(),
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        poolReserves: `${formattedReserve0} / ${formattedReserve1}`,
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
        
        // Use the same proportional formula as the pool contract
        // amountOut = (amountIn * reserveOut) / reserveIn
        amountOut = (amountInWei * reserveOut) / reserveIn;
        
        console.log("🔄 Using pool contract proportional formula:");
        console.log(`Reserve In: ${ethers.formatUnits(reserveIn, tokenIn.decimals)} ${tokenIn.symbol}`);
        console.log(`Reserve Out: ${ethers.formatUnits(reserveOut, tokenOut.decimals)} ${tokenOut.symbol}`);
        console.log(`Amount In: ${ethers.formatUnits(amountInWei, tokenIn.decimals)} ${tokenIn.symbol}`);
        console.log(`Calculated Amount Out: ${ethers.formatUnits(amountOut, tokenOut.decimals)} ${tokenOut.symbol}`);
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

  // Direct calculation effect - use pool-based calculation only
  useEffect(() => {
    console.log("🔄 CALCULATION TRIGGERED:", {
      inputAmount,
      inputToken: inputToken?.symbol,
      outputToken: outputToken?.symbol,
      poolInfo: poolInfo ? "loaded" : "not loaded"
    });
    
    // Clear if no input
    if (!inputAmount || inputAmount === "0" || inputAmount === "0." || inputAmount === ".") {
      setOutputAmount("");
      setIsCalculating(false);
      return;
    }
    
    // Clear if no tokens or pool info
    if (!inputToken || !outputToken || !poolInfo) {
      setIsCalculating(false);
      return;
    }
    
    setIsCalculating(true);
    
    // Use the pool-based calculation function
    calculateOutputAmount(inputAmount, inputToken, outputToken);
  }, [inputAmount, inputToken, outputToken, poolInfo]);


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
    <div className="bg-surface border border-border rounded-3xl w-full max-w-md mx-auto shadow-2xl">
      {/* Header with settings */}
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h2 className="text-xl font-semibold text-white">Swap</h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg bg-black/30 border border-border hover:bg-black/50 transition-colors"
          title="Settings"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {/* Sell Section */}
        <div className="bg-black/20 border border-border rounded-2xl p-4 mb-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg text-gray-400">Sell</span>
            {inputToken && (
              <TokenBalanceDisplay 
                key={`input-${inputToken.address}`}
                token={inputToken} 
                tokenPrices={tokenPrices} 
                priceChanges={priceChanges}
                poolInfo={poolInfo}
                calculateASLPrice={calculateASLPrice}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                value={inputAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setInputAmount(value);
                  }
                }}
                placeholder="0.0"
                className="w-full bg-transparent text-2xl text-white placeholder-gray-500 outline-none"
              />
            </div>
            <TokenSelect
              tokens={V3_TOKENS}
              value={inputToken}
              onChange={setInputToken}
              label=""
            />
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center my-2">
          <button
            onClick={switchTokens}
            className="p-3 rounded-full bg-black/30 border border-border hover:bg-black/50 transition-colors"
            title="Swap tokens"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Buy Section */}
        <div className="bg-black/20 border border-border rounded-2xl p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg text-gray-400">Buy</span>
            {outputToken && (
              <TokenBalanceDisplay 
                key={`output-${outputToken.address}`}
                token={outputToken} 
                tokenPrices={tokenPrices} 
                priceChanges={priceChanges}
                poolInfo={poolInfo}
                calculateASLPrice={calculateASLPrice}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 py-3">
              {isCalculating ? (
                <div className="flex items-center gap-2 text-2xl text-gray-400">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Calculating...
                </div>
              ) : outputAmount ? (
                <span className="text-2xl text-white">
                  {outputAmount}
                </span>
              ) : (
                <span className="text-2xl text-gray-500">0.0</span>
              )}
            </div>
            <TokenSelect
              tokens={V3_TOKENS}
              value={outputToken}
              onChange={setOutputToken}
              label=""
            />
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={loading || !inputAmount || !outputAmount || !inputToken || !outputToken}
          className={clsx(
            "w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-200",
            (loading || !inputAmount || !outputAmount || !inputToken || !outputToken)
              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Swapping...</span>
            </div>
          ) : (
            'Swap'
          )}
        </button>

        {/* Pool Info */}
        {poolInfo && (
          <div className="text-center text-sm text-gray-400 mt-4">
            Pool reserves: {poolInfo
              ? (() => {
                  const aslReserveRaw = poolInfo.isToken0Native 
                    ? ethers.formatUnits(BigInt(poolInfo.reserve0), poolInfo.token0Decimals)
                    : ethers.formatUnits(BigInt(poolInfo.reserve1), poolInfo.token1Decimals);
                  const ausdReserveRaw = poolInfo.isToken0Native 
                    ? ethers.formatUnits(BigInt(poolInfo.reserve1), poolInfo.token1Decimals)
                    : ethers.formatUnits(BigInt(poolInfo.reserve0), poolInfo.token0Decimals);
                  
                  const aslReserve = parseFloat(aslReserveRaw) > 1000 
                    ? parseFloat(aslReserveRaw).toFixed(0)
                    : parseFloat(aslReserveRaw).toFixed(2);
                  const ausdReserve = parseFloat(ausdReserveRaw) > 1000 
                    ? parseFloat(ausdReserveRaw).toFixed(0)
                    : parseFloat(ausdReserveRaw).toFixed(2);
                  
                  return `${aslReserve} ASL / ${ausdReserve} AUSD`;
                })()
              : "-"}
          </div>
        )}
        
        {message && (
          <div className={`p-3 rounded-xl mt-4 ${
            message.includes("Error") || message.includes("failed") 
              ? "bg-red-100 text-red-700 border border-red-300" 
              : "bg-green-100 text-green-700 border border-green-300"
          }`}>
            {message}
          </div>
        )}
        
        {!selectedPool && inputToken && outputToken && (
          <div className="p-3 rounded-xl bg-yellow-100 text-yellow-700 border border-yellow-300 mt-4">
            No pool available for {inputToken.symbol}/{outputToken.symbol} pair. Please select different tokens.
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-lg hover:bg-black/30 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Slippage Tolerance */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">Slippage tolerance</span>
                  <div className="group relative">
                    <svg className="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Your transaction will revert if the price changes unfavorably by more than this percentage
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={(slippageBps / 100).toFixed(1)}
                      onChange={(e) => setSlippageBps(Number(e.target.value) * 100)}
                      className="bg-black/30 border border-border rounded-lg px-3 py-2 w-20 text-right"
                      step="0.1"
                      min="0.1"
                      max="50"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  
                  <div className="flex gap-2">
                    {[0.1, 0.5, 1, 3].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setSlippageBps(preset * 100)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          slippageBps === preset * 100
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-black/20 border-border text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction Deadline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">Transaction deadline</span>
                  <div className="group relative">
                    <svg className="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Your transaction will revert if it is pending for more than this long
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value="30"
                    className="bg-black/30 border border-border rounded-lg px-3 py-2 w-20 text-right"
                    readOnly
                  />
                  <span className="text-sm text-gray-500">minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}