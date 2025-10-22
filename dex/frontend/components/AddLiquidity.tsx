"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { V3TokenInfo, V3_TOKENS } from "../lib/v3Tokens";

// Pool addresses
const POOL_ADDRESSES = {
  "asl-wasl": "0x6647924906278DB6C645519435B7c8eF74773E63", // ASL/WASL Pool
  "asl-ausd": "0x46f1F8F63B70188F06b23771A0FAaEc910782F95", // ASL/AUSD Pool
  "wasl-ausd": "0x9A8EDB20743755bb3C0D16672AaaCe94bF37755a"  // WASL/AUSD Pool
};

const NATIVE_V3_POOL_ABI = [
  "function mint(uint256 amount0, uint256 amount1) external payable",
  "function getReserves() external view returns (uint256, uint256)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function balanceOf(address account) external view returns (uint256)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

interface PoolInfo {
  reserve0: string;
  reserve1: string;
  token0: string;
  token1: string;
  isToken0Native: boolean;
  userToken0Balance: string;
  userToken1Balance: string;
  userNativeBalance: string;
}

export default function AddLiquidity() {
  const { address, isConnected } = useAccount();
  
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [tokenA, setTokenA] = useState<V3TokenInfo | undefined>();
  const [tokenB, setTokenB] = useState<V3TokenInfo | undefined>();
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Ensure component only renders on client side
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Load pool information
  const loadPoolInfo = async (showRefreshIndicator = false) => {
    if (!window.ethereum || !selectedPool || !address) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, provider);
      
      // Get basic pool info
      let token0, isToken0Native, reserves;
      
      try {
        [token0, reserves] = await Promise.all([
          poolContract.token0(),
          poolContract.getReserves()
        ]);
        
        // Determine isToken0Native based on pool address
        isToken0Native = selectedPool === POOL_ADDRESSES["asl-wasl"] || selectedPool === POOL_ADDRESSES["asl-ausd"];
        
        console.log("Pool data loaded:", {
          token0,
          isToken0Native,
          reserves: reserves.map((r: any) => ethers.formatEther(r))
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
      let userToken0Balance: bigint = 0n;
      let userToken1Balance: bigint = 0n;
      
      if (isToken0Native) {
        // Token0 is native ASL, Token1 is ERC20
        userToken0Balance = userNativeBalance;
        if (token1) {
          const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
          userToken1Balance = await token1Contract.balanceOf(address);
        }
      } else {
        // Token0 is ERC20, Token1 is native ASL
        if (token0) {
          const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
          userToken0Balance = await token0Contract.balanceOf(address);
        }
        userToken1Balance = userNativeBalance;
      }
      
      setPoolInfo({
        reserve0: ethers.formatEther(reserves[0]),
        reserve1: ethers.formatEther(reserves[1]),
        token0,
        token1,
        isToken0Native,
        userToken0Balance: ethers.formatEther(userToken0Balance),
        userToken1Balance: ethers.formatEther(userToken1Balance),
        userNativeBalance: ethers.formatEther(userNativeBalance)
      });
      
    } catch (error) {
      console.error("Error loading pool info:", error);
      setMessage(`Error loading pool info: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
    }
  };

  // Update selected pool when tokens change
  useEffect(() => {
    const poolAddress = getPoolForTokens(tokenA, tokenB);
    setSelectedPool(poolAddress || "");
  }, [tokenA, tokenB]);

  // Load pool info when pool changes
  useEffect(() => {
    if (isConnected && address && selectedPool) {
      loadPoolInfo();
    }
  }, [isConnected, address, selectedPool]);

  // Calculate proportional amounts
  const calculateProportionalAmounts = (inputAmount: string, inputToken: V3TokenInfo) => {
    if (!poolInfo || !inputAmount || inputAmount === "0") {
      setAmountB("");
      return;
    }

    try {
      const amountInWei = ethers.parseUnits(inputAmount, inputToken.decimals);
      
      let reserveIn, reserveOut, outputToken;
      
      if (inputToken.isNative === poolInfo.isToken0Native) {
        // Input token is token0
        reserveIn = ethers.parseUnits(poolInfo.reserve0, inputToken.decimals);
        reserveOut = ethers.parseUnits(poolInfo.reserve1, tokenB?.decimals || 18);
        outputToken = tokenB;
      } else {
        // Input token is token1
        reserveIn = ethers.parseUnits(poolInfo.reserve1, inputToken.decimals);
        reserveOut = ethers.parseUnits(poolInfo.reserve0, tokenB?.decimals || 18);
        outputToken = tokenB;
      }

      if (reserveIn === 0n || reserveOut === 0n) {
        setAmountB("");
        return;
      }

      // Calculate proportional amount
      const amountOut = (amountInWei * reserveOut) / reserveIn;
      const amountOutFormatted = ethers.formatUnits(amountOut, outputToken?.decimals || 18);
      setAmountB(amountOutFormatted);
      
    } catch (error) {
      console.error("Error calculating proportional amounts:", error);
      setAmountB("");
    }
  };

  // Handle amount A change
  const handleAmountAChange = (value: string) => {
    setAmountA(value);
    if (tokenA) {
      calculateProportionalAmounts(value, tokenA);
    }
  };

  // Handle amount B change
  const handleAmountBChange = (value: string) => {
    setAmountB(value);
    if (tokenB) {
      calculateProportionalAmounts(value, tokenB);
    }
  };

  // Add liquidity
  const handleAddLiquidity = async () => {
    if (!window.ethereum || !address || !poolInfo || !tokenA || !tokenB || !selectedPool) return;
    
    setLoading(true);
    setMessage("");
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(selectedPool, NATIVE_V3_POOL_ABI, signer);
      
      const amountAWei = ethers.parseUnits(amountA, tokenA.decimals);
      const amountBWei = ethers.parseUnits(amountB, tokenB.decimals);
      
      // Approve ERC20 tokens if needed
      if (!tokenA.isNative) {
        const tokenAContract = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
        const approveATx = await tokenAContract.approve(selectedPool, amountAWei);
        await approveATx.wait();
        console.log("Token A approved");
      }
      
      if (!tokenB.isNative) {
        const tokenBContract = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
        const approveBTx = await tokenBContract.approve(selectedPool, amountBWei);
        await approveBTx.wait();
        console.log("Token B approved");
      }
      
      // Determine parameter order based on token configuration
      let tx;
      if (tokenA.isNative === poolInfo.isToken0Native) {
        // TokenA is token0
        tx = await poolContract.mint(amountAWei, amountBWei, { value: tokenA.isNative ? amountAWei : 0n });
      } else {
        // TokenB is token0
        tx = await poolContract.mint(amountBWei, amountAWei, { value: tokenB.isNative ? amountBWei : 0n });
      }
      
      await tx.wait();
      setMessage("✅ Liquidity added successfully!");
      
      // Refresh pool info
      setTimeout(() => {
        loadPoolInfo(true);
        setAmountA("");
        setAmountB("");
      }, 2000);
      
    } catch (error) {
      console.error("Error adding liquidity:", error);
      setMessage(`❌ Failed to add liquidity: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div className="flex items-center justify-center flex-1">Loading...</div>;
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-surface/50 border border-border rounded-2xl p-6 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Add Liquidity</h1>
            <p className="text-sm text-gray-400 mt-1">Add tokens to liquidity pools</p>
          </div>

          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Connect your wallet to add liquidity</p>
              <p className="text-sm text-gray-500">Use the Connect Wallet button in the navigation bar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Token A Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Token A
                </label>
                <select
                  value={tokenA?.address || ""}
                  onChange={(e) => {
                    const token = V3_TOKENS.find(t => t.address === e.target.value);
                    setTokenA(token);
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Select Token A</option>
                  {V3_TOKENS.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Token B Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Token B
                </label>
                <select
                  value={tokenB?.address || ""}
                  onChange={(e) => {
                    const token = V3_TOKENS.find(t => t.address === e.target.value);
                    setTokenB(token);
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Select Token B</option>
                  {V3_TOKENS.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount A Input */}
              {tokenA && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount {tokenA.symbol}
                  </label>
                  <div className="bg-background border border-border rounded-lg px-4 py-3">
                    <input
                      value={amountA}
                      onChange={(e) => handleAmountAChange(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-transparent text-white focus:outline-none"
                      type="number"
                      min="0"
                    />
                    <div className="text-sm text-gray-400 mt-1">
                      Balance: {tokenA.isNative 
                        ? (poolInfo?.userNativeBalance ? `${parseFloat(poolInfo.userNativeBalance).toFixed(2)} ${tokenA.symbol}` : "Loading...")
                        : (poolInfo?.userToken0Balance ? `${parseFloat(poolInfo.userToken0Balance).toFixed(2)} ${tokenA.symbol}` : "Loading...")
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* Amount B Input */}
              {tokenB && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount {tokenB.symbol}
                  </label>
                  <div className="bg-background border border-border rounded-lg px-4 py-3">
                    <input
                      value={amountB}
                      onChange={(e) => handleAmountBChange(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-transparent text-white focus:outline-none"
                      type="number"
                      min="0"
                    />
                    <div className="text-sm text-gray-400 mt-1">
                      Balance: {tokenB.isNative 
                        ? (poolInfo?.userNativeBalance ? `${parseFloat(poolInfo.userNativeBalance).toFixed(2)} ${tokenB.symbol}` : "Loading...")
                        : (poolInfo?.userToken1Balance ? `${parseFloat(poolInfo.userToken1Balance).toFixed(2)} ${tokenB.symbol}` : "Loading...")
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* Pool Info */}
              {poolInfo && (
                <div className="text-sm text-gray-300 space-y-1">
                  <p>Pool reserves: {poolInfo.reserve0} / {poolInfo.reserve1}</p>
                  <p>Pool: {selectedPool.slice(0, 6)}...{selectedPool.slice(-4)}</p>
                </div>
              )}

              {/* Add Liquidity Button */}
              <button
                onClick={handleAddLiquidity}
                disabled={loading || !amountA || !amountB || !tokenA || !tokenB}
                className="w-full bg-accent hover:bg-accent/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition"
              >
                {loading ? "Adding Liquidity..." : "Add Liquidity"}
              </button>

              {/* Message */}
              {message && (
                <div className={`text-sm p-3 rounded-lg ${
                  message.includes("✅") ? "text-green-400" : "text-red-400"
                }`}>
                  {message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
