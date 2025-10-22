import { ethers } from "ethers";
import { V3TokenInfo } from "./v3Tokens";
import { TradingSignal } from "./ai-copilot";

// Pool addresses (same as in V3SwapBox)
const POOL_ADDRESSES = {
  "asl-wasl": "0xC6c1fCd59976a3CEBA5d0dbd1b347618526A2826",
  "asl-ausd": "0x70AC194EdC0f2FB9D6f9B20692Af882AeF7601Bc",
  "wasl-ausd": "0x79a07040731C3a56f5B4385C4c716544a8D5c32B"
};

// Native V3 Pool ABI
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

export interface TradeExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
  actualAmountIn?: string;
  actualAmountOut?: string;
  fromToken?: string;
  toToken?: string;
  timestamp?: number;
}

export interface TradingBotConfig {
  maxTradeAmount: number; // Maximum amount to trade per signal
  maxDailyLoss: number; // Maximum daily loss percentage
  maxDailyTrades: number; // Maximum number of trades per day
  stopLossPercentage: number; // Stop loss percentage
  takeProfitPercentage: number; // Take profit percentage
  minConfidence: number; // Minimum confidence level to execute trades
  enabled: boolean; // Whether the bot is enabled
}

export class TradingAutomation {
  private static instance: TradingAutomation;
  private config: TradingBotConfig;
  private dailyStats: {
    trades: number;
    pnl: number;
    lastReset: Date;
  };

  constructor() {
    this.config = {
      maxTradeAmount: 1000, // $1000 max per trade
      maxDailyLoss: 10, // 10% max daily loss
      maxDailyTrades: 20,
      stopLossPercentage: 5, // 5% stop loss
      takeProfitPercentage: 10, // 10% take profit
      minConfidence: 70, // 70% minimum confidence
      enabled: false
    };
    
    this.dailyStats = {
      trades: 0,
      pnl: 0,
      lastReset: new Date()
    };
  }

  static getInstance(): TradingAutomation {
    if (!TradingAutomation.instance) {
      TradingAutomation.instance = new TradingAutomation();
    }
    return TradingAutomation.instance;
  }

  updateConfig(newConfig: Partial<TradingBotConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): TradingBotConfig {
    return { ...this.config };
  }

  getDailyStats() {
    // Reset daily stats if it's a new day
    const today = new Date().toDateString();
    if (this.dailyStats.lastReset.toDateString() !== today) {
      this.dailyStats = {
        trades: 0,
        pnl: 0,
        lastReset: new Date()
      };
    }
    return { ...this.dailyStats };
  }

  async executeTrade(signal: TradingSignal, userAddress: string): Promise<TradeExecutionResult> {
    // Check if bot is enabled
    if (!this.config.enabled) {
      return {
        success: false,
        error: "Trading bot is disabled"
      };
    }

    // Check confidence level
    if (signal.confidence < this.config.minConfidence) {
      return {
        success: false,
        error: `Confidence level ${signal.confidence}% is below minimum ${this.config.minConfidence}%`
      };
    }

    // Check daily limits
    const stats = this.getDailyStats();
    if (stats.trades >= this.config.maxDailyTrades) {
      return {
        success: false,
        error: "Daily trade limit reached"
      };
    }

    // Check daily loss limit
    if (stats.pnl <= -this.config.maxDailyLoss) {
      return {
        success: false,
        error: "Daily loss limit reached"
      };
    }

    // Check if it's a hold signal
    if (signal.action === 'hold') {
      return {
        success: false,
        error: "Hold signal - no action required"
      };
    }

    try {
      // Get the appropriate pool for the trade
      const poolAddress = this.getPoolForTokens(signal.token, signal.counterToken);
      if (!poolAddress) {
        return {
          success: false,
          error: "No pool found for this token pair"
        };
      }

      // Execute the trade
      const result = await this.performSwap(signal, poolAddress, userAddress);
      
      if (result.success) {
        // Update daily stats
        this.dailyStats.trades++;
        // Note: PnL calculation would require more complex tracking
      }

      return result;
    } catch (error) {
      console.error('Error executing trade:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private getPoolForTokens(tokenA: V3TokenInfo, tokenB: V3TokenInfo): string | null {
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
  }

  private async performSwap(
    signal: TradingSignal,
    poolAddress: string,
    userAddress: string
  ): Promise<TradeExecutionResult> {
    if (!window.ethereum) {
      return {
        success: false,
        error: "No wallet connected"
      };
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(poolAddress, NATIVE_V3_POOL_ABI, signer);

      const zeroAddress = ethers.ZeroAddress.toLowerCase();
      // For swap commands, use token as input and counterToken as output
      // For buy/sell commands, use the original logic
      const inputToken = signal.token;
      const outputToken = signal.counterToken;

      const amountIn = ethers.parseUnits(signal.amount.toString(), inputToken.decimals);
      
      // Get pool reserves to calculate proper output amount
      const reserves = await poolContract.getReserves();
      const reserve0 = reserves[0];
      const reserve1 = reserves[1];
      
      // Get pool token addresses (same logic as manual swap)
      const token0Address = (await poolContract.token0()).toLowerCase();
      const isToken0Native = await poolContract.isToken0Native();
      
      // Determine pool token addresses
      const poolToken0 = isToken0Native ? zeroAddress : token0Address;
      const poolToken1 = isToken0Native ? token0Address : zeroAddress;
      
      // Determine input/output token addresses
      const inputTokenAddress = inputToken.isNative ? zeroAddress : inputToken.address.toLowerCase();
      const outputTokenAddress = outputToken.isNative ? zeroAddress : outputToken.address.toLowerCase();
      
      // Check if tokens are supported by pool
      if (![poolToken0, poolToken1].includes(inputTokenAddress) || ![poolToken0, poolToken1].includes(outputTokenAddress)) {
        return {
          success: false,
          error: "Selected tokens are not supported by this pool"
        };
      }
      
      // Determine which token is which (same logic as manual swap)
      const isInputToken0 = inputTokenAddress === poolToken0;
      const isOutputToken0 = outputTokenAddress === poolToken0;
      
      // Calculate output amount based on AMM formula (same logic as manual swap)
      const reserveIn = isInputToken0 ? reserve0 : reserve1;
      const reserveOut = isInputToken0 ? reserve1 : reserve0;
      
      if (reserveIn === 0n || reserveOut === 0n) {
        return {
          success: false,
          error: "Pool has no liquidity"
        };
      }
      
      // Use the same proportional formula as the pool contract
      // amountOut = (amountIn * reserveOut) / reserveIn
      const amountOut = (amountIn * reserveOut) / reserveIn;
      
      // Check if the output amount is reasonable (not more than 50% of the reserve)
      const maxOutput = reserveOut / 2n; // 50% of reserve
      if (amountOut > maxOutput) {
        console.log(`❌ Output amount too large: ${ethers.formatUnits(amountOut, outputToken.decimals)} > ${ethers.formatUnits(maxOutput, outputToken.decimals)} (50% of reserve)`);
        return {
          success: false,
          error: `Swap amount too large. Maximum output is ${ethers.formatUnits(maxOutput, outputToken.decimals)} ${outputToken.symbol} (50% of pool reserve)`
        };
      }
      
      // Calculate the required input amount (same as manual swap)
      const amountInRequired = (amountOut * reserveIn) / reserveOut;
      
      // Check if amountOut is valid
      if (amountOut === 0n) {
        console.log("❌ ERROR: Calculated output amount is zero!");
        console.log("Amount In:", ethers.formatUnits(amountIn, inputToken.decimals), inputToken.symbol);
        console.log("Reserve In:", ethers.formatUnits(reserveIn, inputToken.decimals));
        console.log("Reserve Out:", ethers.formatUnits(reserveOut, outputToken.decimals));
        return {
          success: false,
          error: "Calculated output amount is zero. Please check your input amount and try again."
        };
      }

      // Check if we're trying to get more output than available
      if (amountOut >= reserveOut) {
        console.log("❌ ERROR: Requested output exceeds available reserves!");
        console.log("Amount Out:", ethers.formatUnits(amountOut, outputToken.decimals), outputToken.symbol);
        console.log("Reserve Out:", ethers.formatUnits(reserveOut, outputToken.decimals), outputToken.symbol);
        return {
          success: false,
          error: "Requested output amount exceeds available pool reserves."
        };
      }

      const amount0Out = isOutputToken0 ? amountOut : 0n;
      const amount1Out = isOutputToken0 ? 0n : amountOut;
      
      console.log("=== AUTO-TRADING SWAP DEBUG ===");
      console.log("Signal Action:", signal.action);
      console.log("Signal Token:", signal.token.symbol);
      console.log("Signal CounterToken:", signal.counterToken.symbol);
      console.log("Input Token:", inputToken.symbol, "Amount:", ethers.formatUnits(amountIn, inputToken.decimals));
      console.log("Output Token:", outputToken.symbol, "Amount:", ethers.formatUnits(amountOut, outputToken.decimals));
      console.log("PoolToken0:", poolToken0, "PoolToken1:", poolToken1);
      console.log("InputTokenAddress:", inputTokenAddress, "OutputTokenAddress:", outputTokenAddress);
      console.log("IsInputToken0:", isInputToken0, "IsOutputToken0:", isOutputToken0);
      console.log("Reserve In:", ethers.formatUnits(reserveIn, inputToken.decimals));
      console.log("Reserve Out:", ethers.formatUnits(reserveOut, outputToken.decimals));
      console.log("Amount0Out:", amount0Out.toString());
      console.log("Amount1Out:", amount1Out.toString());
      console.log("Amount In Wei:", amountIn.toString());
      console.log("Amount In Required Wei:", amountInRequired.toString());
      console.log("Amount Out Wei:", amountOut.toString());
      console.log("Reserve In Wei:", reserveIn.toString());
      console.log("Reserve Out Wei:", reserveOut.toString());
      console.log("=== END AUTO-TRADING DEBUG ===");

      let tx;
      if (inputToken.isNative) {
        tx = await poolContract.swap(amount0Out, amount1Out, userAddress, {
          value: amountInRequired
        });
      } else {
        const tokenContract = new ethers.Contract(inputToken.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, poolAddress);
        if (allowance < amountInRequired) {
          const approveTx = await tokenContract.approve(poolAddress, amountInRequired);
          await approveTx.wait();
        }

        tx = await poolContract.swap(amount0Out, amount1Out, userAddress);
      }

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        actualAmountIn: ethers.formatUnits(amountIn, inputToken.decimals),
        actualAmountOut: ethers.formatUnits(amountOut, outputToken.decimals),
        fromToken: inputToken.symbol,
        toToken: outputToken.symbol,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Swap execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed'
      };
    }
  }

  // Safety functions
  emergencyStop(): void {
    this.config.enabled = false;
    console.log('Trading bot emergency stopped');
  }

  resetDailyStats(): void {
    this.dailyStats = {
      trades: 0,
      pnl: 0,
      lastReset: new Date()
    };
  }

  // Risk management
  calculatePositionSize(signal: TradingSignal, accountBalance: number): number {
    const maxAmount = Math.min(
      this.config.maxTradeAmount,
      accountBalance * 0.1 // Never risk more than 10% of account
    );
    
    // Adjust based on confidence level
    const confidenceMultiplier = signal.confidence / 100;
    return maxAmount * confidenceMultiplier;
  }

  shouldExecuteTrade(signal: TradingSignal): boolean {
    if (!this.config.enabled) return false;
    if (signal.confidence < this.config.minConfidence) return false;
    if (signal.action === 'hold') return false;
    
    const stats = this.getDailyStats();
    if (stats.trades >= this.config.maxDailyTrades) return false;
    if (stats.pnl <= -this.config.maxDailyLoss) return false;
    
    return true;
  }
}

export const tradingAutomation = TradingAutomation.getInstance();
