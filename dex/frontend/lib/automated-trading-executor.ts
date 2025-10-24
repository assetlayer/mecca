import { ethers } from "ethers";
import { V3TokenInfo } from "./v3Tokens";
import { TradingSignal } from "./ai-copilot";

// Automated Trading Vault ABI
const AUTOMATED_TRADING_VAULT_ABI = [
  "function enableAutomation(uint256 _maxDailySpend, uint256 _maxSingleTrade, address[] calldata _approvedTokens, uint256[] calldata _tokenAllowances) external",
  "function disableAutomation() external",
  "function updateSpendingLimits(uint256 _maxDailySpend, uint256 _maxSingleTrade) external",
  "function addApprovedToken(address token, uint256 allowance) external",
  "function removeApprovedToken(address token) external",
  "function depositFunds(address token, uint256 amount) external payable",
  "function withdrawFunds(address token, uint256 amount) external",
  "function executeAutomatedTrade(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address poolAddress) external returns (bool success, uint256 actualAmountOut)",
  "function getUserConfig(address user) external view returns (bool automationEnabled, uint256 maxDailySpend, uint256 maxSingleTrade, uint256 dailySpent, uint256 lastResetDay, address[] memory approvedTokens)",
  "function getTokenAllowance(address user, address token) external view returns (uint256)",
  "function getAvailableBalance(address user, address token) external view returns (uint256)",
  "function isAutomationEnabled(address user) external view returns (bool)",
  "event UserConfigUpdated(address indexed user, bool automationEnabled, uint256 maxDailySpend)",
  "event TradeExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, bool success)"
];

export interface AutomationConfig {
  maxDailySpend: number;
  maxSingleTrade: number;
  approvedTokens: {
    token: V3TokenInfo;
    allowance: number;
  }[];
  enabled: boolean;
}

export interface AutomationStatus {
  isEnabled: boolean;
  dailySpent: number;
  maxDailySpend: number;
  remainingDailySpend: number;
  lastResetDay: number;
  approvedTokens: string[];
}

export class AutomatedTradingExecutor {
  private static instance: AutomatedTradingExecutor;
  private vaultAddress: string;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private vaultContract: ethers.Contract | null = null;

  constructor() {
    // Get vault address from addresses.json
    this.vaultAddress = this.getVaultAddress();
  }

  static getInstance(): AutomatedTradingExecutor {
    if (!AutomatedTradingExecutor.instance) {
      AutomatedTradingExecutor.instance = new AutomatedTradingExecutor();
    }
    return AutomatedTradingExecutor.instance;
  }

  private getVaultAddress(): string {
    try {
      const addresses = require('./addresses.json');
      return addresses.automatedTradingVault;
    } catch (error) {
      console.error('Failed to load vault address:', error);
      return '';
    }
  }

  async initialize(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('No wallet connected');
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer = await this.provider.getSigner();
    this.vaultContract = new ethers.Contract(this.vaultAddress, AUTOMATED_TRADING_VAULT_ABI, this.signer);
  }

  async enableAutomation(config: AutomationConfig): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const tokenAddresses = config.approvedTokens.map(t => t.token.address);
      const allowances = config.approvedTokens.map(t => 
        ethers.parseUnits(t.allowance.toString(), t.token.decimals)
      );

      const tx = await this.vaultContract!.enableAutomation(
        ethers.parseEther(config.maxDailySpend.toString()),
        ethers.parseEther(config.maxSingleTrade.toString()),
        tokenAddresses,
        allowances
      );

      await tx.wait();
      console.log('✅ Automation enabled successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to enable automation:', error);
      return false;
    }
  }

  async disableAutomation(): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const tx = await this.vaultContract!.disableAutomation();
      await tx.wait();
      console.log('✅ Automation disabled successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to disable automation:', error);
      return false;
    }
  }

  async updateSpendingLimits(maxDailySpend: number, maxSingleTrade: number): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const tx = await this.vaultContract!.updateSpendingLimits(
        ethers.parseEther(maxDailySpend.toString()),
        ethers.parseEther(maxSingleTrade.toString())
      );
      await tx.wait();
      console.log('✅ Spending limits updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to update spending limits:', error);
      return false;
    }
  }

  async addApprovedToken(token: V3TokenInfo, allowance: number): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const tx = await this.vaultContract!.addApprovedToken(
        token.address,
        ethers.parseUnits(allowance.toString(), token.decimals)
      );
      await tx.wait();
      console.log(`✅ Added approved token: ${token.symbol}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to add approved token:', error);
      return false;
    }
  }

  async removeApprovedToken(token: V3TokenInfo): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const tx = await this.vaultContract!.removeApprovedToken(token.address);
      await tx.wait();
      console.log(`✅ Removed approved token: ${token.symbol}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to remove approved token:', error);
      return false;
    }
  }

  async depositFunds(token: V3TokenInfo, amount: number): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const amountWei = ethers.parseUnits(amount.toString(), token.decimals);
      
      if (token.isNative) {
        const tx = await this.vaultContract!.depositFunds(
          ethers.ZeroAddress,
          amountWei,
          { value: amountWei }
        );
        await tx.wait();
      } else {
        // First approve the vault to spend the token
        const tokenContract = new ethers.Contract(token.address, [
          "function approve(address spender, uint256 amount) returns (bool)"
        ], this.signer!);
        
        const approveTx = await tokenContract.approve(this.vaultAddress, amountWei);
        await approveTx.wait();
        
        const tx = await this.vaultContract!.depositFunds(token.address, amountWei);
        await tx.wait();
      }
      
      console.log(`✅ Deposited ${amount} ${token.symbol} to vault`);
      return true;
    } catch (error) {
      console.error('❌ Failed to deposit funds:', error);
      return false;
    }
  }

  async withdrawFunds(token: V3TokenInfo, amount: number): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const amountWei = ethers.parseUnits(amount.toString(), token.decimals);
      const tx = await this.vaultContract!.withdrawFunds(
        token.isNative ? ethers.ZeroAddress : token.address,
        amountWei
      );
      await tx.wait();
      console.log(`✅ Withdrew ${amount} ${token.symbol} from vault`);
      return true;
    } catch (error) {
      console.error('❌ Failed to withdraw funds:', error);
      return false;
    }
  }

  async getAutomationStatus(): Promise<AutomationStatus | null> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const userAddress = await this.signer!.getAddress();
      const config = await this.vaultContract!.getUserConfig(userAddress);
      
      const remainingDailySpend = Number(ethers.formatEther(config.maxDailySpend)) - Number(ethers.formatEther(config.dailySpent));
      
      return {
        isEnabled: config.automationEnabled,
        dailySpent: Number(ethers.formatEther(config.dailySpent)),
        maxDailySpend: Number(ethers.formatEther(config.maxDailySpend)),
        remainingDailySpend: Math.max(0, remainingDailySpend),
        lastResetDay: Number(config.lastResetDay),
        approvedTokens: config.approvedTokens
      };
    } catch (error) {
      console.error('❌ Failed to get automation status:', error);
      return null;
    }
  }

  async isAutomationEnabled(): Promise<boolean> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const userAddress = await this.signer!.getAddress();
      return await this.vaultContract!.isAutomationEnabled(userAddress);
    } catch (error) {
      console.error('❌ Failed to check automation status:', error);
      return false;
    }
  }

  async getAvailableBalance(token: V3TokenInfo): Promise<number> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      const userAddress = await this.signer!.getAddress();
      const balance = await this.vaultContract!.getAvailableBalance(
        userAddress,
        token.isNative ? ethers.ZeroAddress : token.address
      );
      return Number(ethers.formatUnits(balance, token.decimals));
    } catch (error) {
      console.error('❌ Failed to get available balance:', error);
      return 0;
    }
  }

  // This method would be called by the AI system to execute trades
  async executeAutomatedTrade(signal: TradingSignal, userAddress: string): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
    actualAmountOut?: string;
  }> {
    if (!this.vaultContract) {
      await this.initialize();
    }

    try {
      // Get the appropriate pool address
      const poolAddress = this.getPoolForTokens(signal.token, signal.counterToken);
      if (!poolAddress) {
        return {
          success: false,
          error: "No pool found for this token pair"
        };
      }

      const amountIn = ethers.parseUnits(signal.amount.toString(), signal.token.decimals);
      const minAmountOut = ethers.parseUnits(
        (signal.amount * 0.95).toString(), // 5% slippage tolerance
        signal.counterToken.decimals
      );

      const tx = await this.vaultContract!.executeAutomatedTrade(
        userAddress,
        signal.token.isNative ? ethers.ZeroAddress : signal.token.address,
        signal.counterToken.isNative ? ethers.ZeroAddress : signal.counterToken.address,
        amountIn,
        minAmountOut,
        poolAddress
      );

      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        actualAmountOut: ethers.formatUnits(minAmountOut, signal.counterToken.decimals)
      };
    } catch (error) {
      console.error('❌ Failed to execute automated trade:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getPoolForTokens(tokenA: V3TokenInfo, tokenB: V3TokenInfo): string | null {
    const isASL = (token: V3TokenInfo) => token.isNative;
    const isWASL = (token: V3TokenInfo) => token.symbol === "WASL";
    const isAUSD = (token: V3TokenInfo) => token.symbol === "AUSD";
    
    if ((isASL(tokenA) && isWASL(tokenB)) || (isWASL(tokenA) && isASL(tokenB))) {
      return "0xC6c1fCd59976a3CEBA5d0dbd1b347618526A2826";
    } else if ((isASL(tokenA) && isAUSD(tokenB)) || (isAUSD(tokenA) && isASL(tokenB))) {
      return "0x70AC194EdC0f2FB9D6f9B20692Af882AeF7601Bc";
    } else if ((isWASL(tokenA) && isAUSD(tokenB)) || (isAUSD(tokenA) && isWASL(tokenB))) {
      return "0x79a07040731C3a56f5B4385C4c716544a8D5c32B";
    }
    return null;
  }
}

export const automatedTradingExecutor = AutomatedTradingExecutor.getInstance();
