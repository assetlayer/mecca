"use client";

import { useState, useEffect } from "react";
import { tradingAutomation, type TradingBotConfig } from "@/lib/trading-automation";
import { clsx } from "clsx";

interface TradingBotConfigProps {
  onConfigChange?: (config: TradingBotConfig) => void;
}

export default function TradingBotConfig({ onConfigChange }: TradingBotConfigProps) {
  const [config, setConfig] = useState<TradingBotConfig>(tradingAutomation.getConfig());
  const [dailyStats, setDailyStats] = useState(tradingAutomation.getDailyStats());
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDailyStats(tradingAutomation.getDailyStats());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (updates: Partial<TradingBotConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    tradingAutomation.updateConfig(updates);
    onConfigChange?.(newConfig);
  };

  const handleEmergencyStop = () => {
    tradingAutomation.emergencyStop();
    setConfig(prev => ({ ...prev, enabled: false }));
    alert('Trading bot emergency stopped!');
  };

  const handleResetStats = () => {
    tradingAutomation.resetDailyStats();
    setDailyStats(tradingAutomation.getDailyStats());
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <span>🤖</span>
          Trading Bot Configuration
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-400 hover:text-white"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
        </div>
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black/20 border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{dailyStats.trades}</div>
          <div className="text-sm text-gray-400">Trades Today</div>
        </div>
        <div className="bg-black/20 border border-border rounded-lg p-4 text-center">
          <div className={clsx(
            "text-2xl font-bold",
            dailyStats.pnl >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {dailyStats.pnl >= 0 ? '+' : ''}{dailyStats.pnl.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-400">Daily P&L</div>
        </div>
        <div className="bg-black/20 border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {config.maxDailyTrades - dailyStats.trades}
          </div>
          <div className="text-sm text-gray-400">Trades Remaining</div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="space-y-4">
        {/* Enable/Disable Bot */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Trading Bot</div>
            <div className="text-sm text-gray-400">Enable automated trading</div>
          </div>
          <button
            onClick={() => handleConfigChange({ enabled: !config.enabled })}
            className={clsx(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              config.enabled ? "bg-green-500" : "bg-gray-600"
            )}
          >
            <span
              className={clsx(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                config.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Max Trade Amount */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Max Trade Amount (USD)
          </label>
          <input
            type="number"
            value={config.maxTradeAmount}
            onChange={(e) => handleConfigChange({ maxTradeAmount: Number(e.target.value) })}
            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            min="1"
            max="10000"
          />
        </div>

        {/* Min Confidence */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Minimum Confidence Level ({config.minConfidence}%)
          </label>
          <input
            type="range"
            min="50"
            max="95"
            value={config.minConfidence}
            onChange={(e) => handleConfigChange({ minConfidence: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>50%</span>
            <span>95%</span>
          </div>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="font-medium text-gray-300">Advanced Settings</h4>
            
            {/* Max Daily Trades */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Daily Trades
              </label>
              <input
                type="number"
                value={config.maxDailyTrades}
                onChange={(e) => handleConfigChange({ maxDailyTrades: Number(e.target.value) })}
                className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                min="1"
                max="100"
              />
            </div>

            {/* Max Daily Loss */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Daily Loss ({config.maxDailyLoss}%)
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={config.maxDailyLoss}
                onChange={(e) => handleConfigChange({ maxDailyLoss: Number(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Stop Loss */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Stop Loss ({config.stopLossPercentage}%)
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={config.stopLossPercentage}
                onChange={(e) => handleConfigChange({ stopLossPercentage: Number(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1%</span>
                <span>20%</span>
              </div>
            </div>

            {/* Take Profit */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Take Profit ({config.takeProfitPercentage}%)
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={config.takeProfitPercentage}
                onChange={(e) => handleConfigChange({ takeProfitPercentage: Number(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5%</span>
                <span>50%</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={handleResetStats}
            className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
          >
            Reset Stats
          </button>
          <button
            onClick={handleEmergencyStop}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Emergency Stop
          </button>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-4 p-3 rounded-lg bg-black/20 border border-border">
        <div className="flex items-center gap-2">
          <div className={clsx(
            "w-2 h-2 rounded-full",
            config.enabled ? "bg-green-400" : "bg-gray-400"
          )} />
          <span className="text-sm text-gray-300">
            {config.enabled ? 'Bot is active' : 'Bot is inactive'}
          </span>
        </div>
        {config.enabled && (
          <div className="text-xs text-gray-400 mt-1">
            Will execute trades with {config.minConfidence}%+ confidence
          </div>
        )}
      </div>
    </div>
  );
}
