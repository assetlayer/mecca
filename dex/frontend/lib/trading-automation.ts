import { ethers } from "ethers";
import { V3TokenInfo } from "./v3Tokens";
import { TradingSignal } from "./ai-copilot";

// Pool addresses (same as in V3SwapBox)
const POOL_ADDRESSES = {
  "asl-wasl": "0x6647924906278DB6C645519435B7c8eF74773E63",
  "asl-ausd": "0x46f1F8F63B70188F06b23771A0FAaEc910782F95",
  "wasl-ausd": "0x9A8EDB20743755bb3C0D16672AaaCe94bF37755a"
};

// Native V3 Pool ABI
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

export interface TradeExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
  actualAmountIn?: string;
  actualAmountOut?: string;
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
      const poolAddress = this.getPoolForTokens(signal.token, signal.token);
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

      // Get pool reserves
      const reserves = await poolContract.getReserves();
      const isToken0Native = poolAddress === POOL_ADDRESSES["asl-wasl"] || poolAddress === POOL_ADDRESSES["asl-ausd"];

      // Calculate amounts
      const amountIn = ethers.parseUnits(signal.amount.toString(), signal.token.decimals);
      
      // For simplicity, we'll use a 1:1 swap ratio
      // In a real implementation, you'd calculate this based on pool reserves
      const amountOut = amountIn; // Simplified for demo

      // Determine swap parameters
      let amount0Out, amount1Out;
      if (signal.token.isNative === isToken0Native) {
        amount0Out = 0;
        amount1Out = amountOut;
      } else {
        amount0Out = amountOut;
        amount1Out = 0;
      }

      // Execute swap
      let tx;
      if (signal.token.isNative) {
        // Native token swap
        tx = await poolContract.swap(amount0Out, amount1Out, userAddress, {
          value: amountIn
        });
      } else {
        // ERC20 token swap
        const tokenContract = new ethers.Contract(signal.token.address, ERC20_ABI, signer);
        
        // Check and approve if needed
        const allowance = await tokenContract.allowance(userAddress, poolAddress);
        if (allowance < amountIn) {
          const approveTx = await tokenContract.approve(poolAddress, amountIn);
          await approveTx.wait();
        }

        tx = await poolContract.swap(amount0Out, amount1Out, userAddress);
      }

      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        actualAmountIn: ethers.formatUnits(amountIn, signal.token.decimals),
        actualAmountOut: ethers.formatUnits(amountOut, signal.token.decimals)
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
