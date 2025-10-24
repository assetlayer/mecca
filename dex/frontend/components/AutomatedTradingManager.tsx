import React, { useState, useEffect } from 'react';
import { V3_TOKENS, V3TokenInfo } from '@/lib/v3Tokens';
import { automatedTradingExecutor, AutomationConfig, AutomationStatus } from '@/lib/automated-trading-executor';

interface AutomatedTradingManagerProps {
  onStatusChange?: (status: AutomationStatus | null) => void;
}

export default function AutomatedTradingManager({ onStatusChange }: AutomatedTradingManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [config, setConfig] = useState<AutomationConfig>({
    maxDailySpend: 1000,
    maxSingleTrade: 100,
    approvedTokens: [],
    enabled: false
  });
  const [selectedToken, setSelectedToken] = useState<V3TokenInfo | null>(null);
  const [tokenAllowance, setTokenAllowance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [selectedDepositToken, setSelectedDepositToken] = useState<V3TokenInfo | null>(null);
  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<V3TokenInfo | null>(null);

  useEffect(() => {
    loadAutomationStatus();
  }, []);

  const loadAutomationStatus = async () => {
    try {
      setIsLoading(true);
      const status = await automatedTradingExecutor.getAutomationStatus();
      setAutomationStatus(status);
      onStatusChange?.(status);
    } catch (error) {
      console.error('Failed to load automation status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const enableAutomation = async () => {
    if (config.approvedTokens.length === 0) {
      alert('Please add at least one approved token');
      return;
    }

    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.enableAutomation(config);
      if (success) {
        await loadAutomationStatus();
        alert('✅ Automation enabled successfully!');
      } else {
        alert('❌ Failed to enable automation');
      }
    } catch (error) {
      console.error('Failed to enable automation:', error);
      alert('❌ Failed to enable automation');
    } finally {
      setIsLoading(false);
    }
  };

  const disableAutomation = async () => {
    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.disableAutomation();
      if (success) {
        await loadAutomationStatus();
        alert('✅ Automation disabled successfully!');
      } else {
        alert('❌ Failed to disable automation');
      }
    } catch (error) {
      console.error('Failed to disable automation:', error);
      alert('❌ Failed to disable automation');
    } finally {
      setIsLoading(false);
    }
  };

  const addApprovedToken = async () => {
    if (!selectedToken || tokenAllowance <= 0) {
      alert('Please select a token and enter allowance amount');
      return;
    }

    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.addApprovedToken(selectedToken, tokenAllowance);
      if (success) {
        setConfig(prev => ({
          ...prev,
          approvedTokens: [...prev.approvedTokens, { token: selectedToken, allowance: tokenAllowance }]
        }));
        setSelectedToken(null);
        setTokenAllowance(0);
        alert(`✅ Added ${selectedToken.symbol} with allowance ${tokenAllowance}`);
      } else {
        alert('❌ Failed to add approved token');
      }
    } catch (error) {
      console.error('Failed to add approved token:', error);
      alert('❌ Failed to add approved token');
    } finally {
      setIsLoading(false);
    }
  };

  const removeApprovedToken = async (token: V3TokenInfo) => {
    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.removeApprovedToken(token);
      if (success) {
        setConfig(prev => ({
          ...prev,
          approvedTokens: prev.approvedTokens.filter(t => t.token.address !== token.address)
        }));
        alert(`✅ Removed ${token.symbol}`);
      } else {
        alert('❌ Failed to remove approved token');
      }
    } catch (error) {
      console.error('Failed to remove approved token:', error);
      alert('❌ Failed to remove approved token');
    } finally {
      setIsLoading(false);
    }
  };

  const depositFunds = async () => {
    if (!selectedDepositToken || depositAmount <= 0) {
      alert('Please select a token and enter deposit amount');
      return;
    }

    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.depositFunds(selectedDepositToken, depositAmount);
      if (success) {
        alert(`✅ Deposited ${depositAmount} ${selectedDepositToken.symbol} to vault`);
        setDepositAmount(0);
        setSelectedDepositToken(null);
      } else {
        alert('❌ Failed to deposit funds');
      }
    } catch (error) {
      console.error('Failed to deposit funds:', error);
      alert('❌ Failed to deposit funds');
    } finally {
      setIsLoading(false);
    }
  };

  const withdrawFunds = async () => {
    if (!selectedWithdrawToken || withdrawAmount <= 0) {
      alert('Please select a token and enter withdrawal amount');
      return;
    }

    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.withdrawFunds(selectedWithdrawToken, withdrawAmount);
      if (success) {
        alert(`✅ Withdrew ${withdrawAmount} ${selectedWithdrawToken.symbol} from vault`);
        setWithdrawAmount(0);
        setSelectedWithdrawToken(null);
      } else {
        alert('❌ Failed to withdraw funds');
      }
    } catch (error) {
      console.error('Failed to withdraw funds:', error);
      alert('❌ Failed to withdraw funds');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSpendingLimits = async () => {
    try {
      setIsLoading(true);
      const success = await automatedTradingExecutor.updateSpendingLimits(
        config.maxDailySpend,
        config.maxSingleTrade
      );
      if (success) {
        alert('✅ Spending limits updated successfully!');
        await loadAutomationStatus();
      } else {
        alert('❌ Failed to update spending limits');
      }
    } catch (error) {
      console.error('Failed to update spending limits:', error);
      alert('❌ Failed to update spending limits');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🤖 Automated Trading Manager</h2>
        {automationStatus?.isEnabled && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">Automation Active</span>
          </div>
        )}
      </div>

      {/* Status Overview */}
      {automationStatus && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">📊 Automation Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Status:</span>
              <span className={`ml-2 ${automationStatus.isEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {automationStatus.isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Daily Spent:</span>
              <span className="ml-2 text-white">
                ${automationStatus.dailySpent.toFixed(2)} / ${automationStatus.maxDailySpend.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Remaining:</span>
              <span className="ml-2 text-white">${automationStatus.remainingDailySpend.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">Approved Tokens:</span>
              <span className="ml-2 text-white">{automationStatus.approvedTokens.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">⚙️ Configuration</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Daily Spend ($)
              </label>
              <input
                type="number"
                value={config.maxDailySpend}
                onChange={(e) => setConfig(prev => ({ ...prev, maxDailySpend: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Single Trade ($)
              </label>
              <input
                type="number"
                value={config.maxSingleTrade}
                onChange={(e) => setConfig(prev => ({ ...prev, maxSingleTrade: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
              />
            </div>
          </div>

          <button
            onClick={updateSpendingLimits}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {isLoading ? 'Updating...' : 'Update Spending Limits'}
          </button>
        </div>
      </div>

      {/* Approved Tokens */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">🪙 Approved Tokens</h3>
        
        <div className="space-y-4">
          <div className="flex space-x-2">
            <select
              value={selectedToken?.address || ''}
              onChange={(e) => setSelectedToken(V3_TOKENS.find(t => t.address === e.target.value) || null)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Token</option>
              {V3_TOKENS.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={tokenAllowance}
              onChange={(e) => setTokenAllowance(Number(e.target.value))}
              className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Allowance"
            />
            <button
              onClick={addApprovedToken}
              disabled={isLoading || !selectedToken || tokenAllowance <= 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {config.approvedTokens.map(({ token, allowance }) => (
              <div key={token.address} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                <div className="flex items-center space-x-3">
                  <span className="text-white font-medium">{token.symbol}</span>
                  <span className="text-gray-400">Allowance: {allowance}</span>
                </div>
                <button
                  onClick={() => removeApprovedToken(token)}
                  disabled={isLoading}
                  className="text-red-400 hover:text-red-300 font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fund Management */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">💰 Fund Management</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deposit */}
          <div className="space-y-3">
            <h4 className="text-md font-medium text-white">Deposit Funds</h4>
            <div className="space-y-2">
              <select
                value={selectedDepositToken?.address || ''}
                onChange={(e) => setSelectedDepositToken(V3_TOKENS.find(t => t.address === e.target.value) || null)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Token</option>
                {V3_TOKENS.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Amount"
              />
              <button
                onClick={depositFunds}
                disabled={isLoading || !selectedDepositToken || depositAmount <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Deposit
              </button>
            </div>
          </div>

          {/* Withdraw */}
          <div className="space-y-3">
            <h4 className="text-md font-medium text-white">Withdraw Funds</h4>
            <div className="space-y-2">
              <select
                value={selectedWithdrawToken?.address || ''}
                onChange={(e) => setSelectedWithdrawToken(V3_TOKENS.find(t => t.address === e.target.value) || null)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Token</option>
                {V3_TOKENS.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Amount"
              />
              <button
                onClick={withdrawFunds}
                disabled={isLoading || !selectedWithdrawToken || withdrawAmount <= 0}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex space-x-4">
        {!automationStatus?.isEnabled ? (
          <button
            onClick={enableAutomation}
            disabled={isLoading || config.approvedTokens.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-md transition-colors"
          >
            {isLoading ? 'Enabling...' : '🚀 Enable Full Automation'}
          </button>
        ) : (
          <button
            onClick={disableAutomation}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-md transition-colors"
          >
            {isLoading ? 'Disabling...' : '🛑 Disable Automation'}
          </button>
        )}
        
        <button
          onClick={loadAutomationStatus}
          disabled={isLoading}
          className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-md transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Warning */}
      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="text-yellow-400 text-xl">⚠️</div>
          <div>
            <h4 className="text-yellow-400 font-semibold mb-2">Important Safety Notice</h4>
            <p className="text-yellow-200 text-sm">
              Full automation allows the AI to execute trades without your approval. 
              Make sure you understand the risks and have set appropriate spending limits. 
              You can disable automation at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
