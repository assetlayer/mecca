"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { V3_TOKENS, type V3TokenInfo } from "@/lib/v3Tokens";
import { aiCopilot, type TokenAnalysis, type TradingSignal, type MarketAnalysis } from "@/lib/ai-copilot";
import { tradingAutomation, type TradingBotConfig } from "@/lib/trading-automation";
import TradingBotConfig from "./TradingBotConfig";
import SafetyDialog from "./SafetyDialog";
import AutomatedTradingManager from "./AutomatedTradingManager";
import { clsx } from "clsx";

interface AICopilotProps {
  tokenPrices: Record<string, number>;
  priceChanges: Record<string, number>;
  onExecuteTrade?: (signal: TradingSignal) => void;
}

export default function AICopilot({ tokenPrices, priceChanges, onExecuteTrade }: AICopilotProps) {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'analysis' | 'signals' | 'chat' | 'market' | 'automation'>('analysis');
  const [selectedToken, setSelectedToken] = useState<V3TokenInfo>(V3_TOKENS[0]);
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);
  const [tradingSignals, setTradingSignals] = useState<TradingSignal[]>([]);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', message: string }>>([]);
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showBotConfig, setShowBotConfig] = useState(false);
  const [botConfig, setBotConfig] = useState<TradingBotConfig>(tradingAutomation.getConfig());
  const [safetyDialog, setSafetyDialog] = useState<{
    isOpen: boolean;
    signal: TradingSignal | null;
  }>({ isOpen: false, signal: null });
  const [userBalance, setUserBalance] = useState(1000); // Mock balance
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (activeTab === 'analysis' && selectedToken) {
        analyzeToken(selectedToken);
      } else if (activeTab === 'market') {
        analyzeMarket();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, selectedToken]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const analyzeToken = async (token: V3TokenInfo) => {
    setLoading(true);
    setError(null);
    
    try {
      const currentPrice = tokenPrices[token.symbol] || 0;
      const priceChange = priceChanges[token.symbol] || 0;
      const result = await aiCopilot.analyzeToken(token, currentPrice, priceChange);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze token');
    } finally {
      setLoading(false);
    }
  };

  const analyzeMarket = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await aiCopilot.getMarketAnalysis(V3_TOKENS, tokenPrices);
      setMarketAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze market');
    } finally {
      setLoading(false);
    }
  };

  const generateTradingSignals = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const signals: TradingSignal[] = [];
      for (const token of V3_TOKENS) {
        const currentPrice = tokenPrices[token.symbol] || 0;
        const userBalance = 1000; // This would be fetched from wallet
        const signal = await aiCopilot.generateTradingSignal(token, currentPrice, userBalance, riskTolerance);
        signals.push(signal);
      }
      setTradingSignals(signals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate trading signals');
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    
    const userMessage = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', message: userMessage }]);
    
    try {
      const context = {
        tokens: V3_TOKENS,
        prices: tokenPrices
      };
      const response = await aiCopilot.chatWithCopilot(userMessage, context);
      setChatHistory(prev => [...prev, { role: 'assistant', message: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        message: 'Sorry, I encountered an error. Please try again.' 
      }]);
    }
  };

  const executeTrade = async (signal: TradingSignal) => {
    // Show safety dialog for manual trades
    setSafetyDialog({ isOpen: true, signal });
  };

  const confirmTrade = async () => {
    const signal = safetyDialog.signal;
    if (!signal) return;

    if (onExecuteTrade) {
      onExecuteTrade(signal);
    }
    
    // Also try automated execution if bot is enabled
    if (botConfig.enabled && tradingAutomation.shouldExecuteTrade(signal)) {
      try {
        const result = await tradingAutomation.executeTrade(signal, address || '');
        if (result.success) {
          console.log('Automated trade executed:', result);
        } else {
          console.log('Automated trade failed:', result.error);
        }
      } catch (error) {
        console.error('Automated trade error:', error);
      }
    }

    setSafetyDialog({ isOpen: false, signal: null });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'high': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      default: return '➡️';
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-4xl mx-auto shadow-2xl">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold mb-4">AI Trading Copilot</h2>
          <p className="text-gray-400 mb-6">Connect your wallet to access AI-powered trading insights</p>
          <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg">
            <p className="text-sm">
              <strong>Note:</strong> This feature requires wallet connection to analyze your holdings and provide personalized recommendations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-3xl p-8 w-full max-w-6xl mx-auto shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🤖</div>
          <div>
            <h2 className="text-2xl font-bold">AI Trading Copilot</h2>
            <p className="text-gray-400 text-sm">Powered by OpenAI GPT-4</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => setShowBotConfig(!showBotConfig)}
            className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
          >
            {showBotConfig ? 'Hide' : 'Show'} Bot Config
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {[
          { id: 'analysis', label: 'Token Analysis', icon: '📊' },
          { id: 'signals', label: 'Trading Signals', icon: '🎯' },
          { id: 'market', label: 'Market Overview', icon: '🌍' },
          { id: 'chat', label: 'Chat', icon: '💬' },
          { id: 'automation', label: 'Full Automation', icon: '🤖' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              activeTab === tab.id
                ? "bg-accent text-white"
                : "text-gray-400 hover:text-white hover:bg-black/30"
            )}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bot Configuration Panel */}
      {showBotConfig && (
        <div className="mb-6">
          <TradingBotConfig onConfigChange={setBotConfig} />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Token Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <select
              value={selectedToken?.address || ''}
              onChange={(e) => {
                const token = V3_TOKENS.find(t => t.address === e.target.value);
                if (token) setSelectedToken(token);
              }}
              className="bg-black/30 border border-border rounded-lg px-3 py-2"
            >
              {V3_TOKENS.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => analyzeToken(selectedToken)}
              disabled={loading}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze Token'}
            </button>
          </div>

          {analysis && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Technical Analysis */}
              <div className="bg-black/20 border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  📈 Technical Analysis
                  <span className={getConfidenceColor(analysis.technicalAnalysis.confidence)}>
                    ({analysis.technicalAnalysis.confidence}% confidence)
                  </span>
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Trend:</span>
                    <span className="flex items-center gap-2">
                      {getTrendIcon(analysis.technicalAnalysis.trend)}
                      <span className="capitalize">{analysis.technicalAnalysis.trend}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Support:</span>
                    <span>${analysis.technicalAnalysis.support.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Resistance:</span>
                    <span>${analysis.technicalAnalysis.resistance.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">RSI:</span>
                    <span>{analysis.technicalAnalysis.rsi}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Recommendation:</span>
                    <span className={clsx(
                      "px-2 py-1 rounded text-sm font-medium",
                      analysis.technicalAnalysis.recommendation === 'buy' && "bg-green-500/20 text-green-400",
                      analysis.technicalAnalysis.recommendation === 'sell' && "bg-red-500/20 text-red-400",
                      analysis.technicalAnalysis.recommendation === 'hold' && "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {analysis.technicalAnalysis.recommendation.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fundamental Analysis */}
              <div className="bg-black/20 border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  🏛️ Fundamental Analysis
                  <span className={getConfidenceColor(analysis.fundamentalAnalysis.confidence)}>
                    ({analysis.fundamentalAnalysis.confidence}% confidence)
                  </span>
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Liquidity:</span>
                    <span className={getRiskColor(analysis.fundamentalAnalysis.liquidity)}>
                      {analysis.fundamentalAnalysis.liquidity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Volatility:</span>
                    <span className={getRiskColor(analysis.fundamentalAnalysis.volatility)}>
                      {analysis.fundamentalAnalysis.volatility.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Risk Level:</span>
                    <span className={getRiskColor(analysis.fundamentalAnalysis.riskLevel)}>
                      {analysis.fundamentalAnalysis.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Recommendation:</span>
                    <span className={clsx(
                      "px-2 py-1 rounded text-sm font-medium",
                      analysis.fundamentalAnalysis.recommendation === 'buy' && "bg-green-500/20 text-green-400",
                      analysis.fundamentalAnalysis.recommendation === 'sell' && "bg-red-500/20 text-red-400",
                      analysis.fundamentalAnalysis.recommendation === 'hold' && "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {analysis.fundamentalAnalysis.recommendation.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="lg:col-span-2 bg-black/20 border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">🧠 AI Insights</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-300 mb-2">Summary</h4>
                    <p className="text-gray-400 text-sm">{analysis.aiInsights.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-300 mb-2">Key Factors</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        {analysis.aiInsights.keyFactors.map((factor, index) => (
                          <li key={index}>• {factor}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-300 mb-2">Risks</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        {analysis.aiInsights.risks.map((risk, index) => (
                          <li key={index}>• {risk}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-300 mb-2">Price Targets</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-gray-400">Short Term</div>
                        <div className="font-medium">${analysis.aiInsights.priceTarget.short.toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Medium Term</div>
                        <div className="font-medium">${analysis.aiInsights.priceTarget.medium.toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Long Term</div>
                        <div className="font-medium">${analysis.aiInsights.priceTarget.long.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trading Signals Tab */}
      {activeTab === 'signals' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <select
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value as any)}
              className="bg-black/30 border border-border rounded-lg px-3 py-2"
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
            <button
              onClick={generateTradingSignals}
              disabled={loading}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Signals'}
            </button>
          </div>

          {tradingSignals.length > 0 && (
            <div className="space-y-4">
              {tradingSignals.map((signal, index) => (
                <div key={index} className="bg-black/20 border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {signal.action === 'buy' ? '🟢' : signal.action === 'sell' ? '🔴' : '🟡'}
                      </span>
                      <div>
                        <h3 className="font-semibold">{signal.token.symbol}</h3>
                        <p className="text-sm text-gray-400">{signal.token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={getConfidenceColor(signal.confidence)}>
                        {signal.confidence}% confidence
                      </div>
                      <div className={getRiskColor(signal.riskAssessment)}>
                        {signal.riskAssessment.toUpperCase()} RISK
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Amount</div>
                      <div className="font-medium">{signal.amount.toFixed(2)} {signal.token.symbol}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Expected Return</div>
                      <div className="font-medium">{signal.expectedReturn.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Action</div>
                      <div className="font-medium capitalize">{signal.action}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">Reasoning</div>
                    <p className="text-sm text-gray-300">{signal.reasoning}</p>
                  </div>

                  {(signal.stopLoss || signal.takeProfit) && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {signal.stopLoss && (
                        <div>
                          <div className="text-sm text-gray-400">Stop Loss</div>
                          <div className="font-medium text-red-400">${signal.stopLoss.toFixed(2)}</div>
                        </div>
                      )}
                      {signal.takeProfit && (
                        <div>
                          <div className="text-sm text-gray-400">Take Profit</div>
                          <div className="font-medium text-green-400">${signal.takeProfit.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => executeTrade(signal)}
                    disabled={signal.action === 'hold'}
                    className={clsx(
                      "w-full py-2 px-4 rounded-lg font-medium transition-colors",
                      signal.action === 'buy' && "bg-green-500/20 text-green-400 hover:bg-green-500/30",
                      signal.action === 'sell' && "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                      signal.action === 'hold' && "bg-gray-500/20 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    {signal.action === 'hold' ? 'HOLD - No Action' : `Execute ${signal.action.toUpperCase()}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Market Overview Tab */}
      {activeTab === 'market' && (
        <div className="space-y-6">
          <button
            onClick={analyzeMarket}
            disabled={loading}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-50"
          >
            {loading ? 'Analyzing Market...' : 'Analyze Market'}
          </button>

          {marketAnalysis && (
            <div className="space-y-6">
              <div className="bg-black/20 border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">🌍 Market Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Overall Trend</div>
                    <div className="text-2xl font-bold flex items-center justify-center gap-2">
                      {getTrendIcon(marketAnalysis.overallTrend)}
                      <span className="capitalize">{marketAnalysis.overallTrend}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Market Sentiment</div>
                    <div className="text-2xl font-bold capitalize">{marketAnalysis.marketSentiment}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Risk Level</div>
                    <div className={clsx("text-2xl font-bold", getRiskColor(marketAnalysis.riskLevel))}>
                      {marketAnalysis.riskLevel.toUpperCase()}
                    </div>
                  </div>
                </div>
                <p className="text-gray-300">{marketAnalysis.summary}</p>
              </div>

              {marketAnalysis.keyEvents.length > 0 && (
                <div className="bg-black/20 border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">📰 Key Events</h3>
                  <ul className="space-y-2">
                    {marketAnalysis.keyEvents.map((event, index) => (
                      <li key={index} className="text-sm text-gray-300">• {event}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          <div className="bg-black/20 border border-border rounded-xl p-4 h-96 overflow-y-auto">
            <div className="space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-2">🤖</div>
                  <p>Start a conversation with your AI trading copilot!</p>
                  <p className="text-sm mt-2">Ask about market trends, token analysis, or trading strategies.</p>
                </div>
              )}
              {chatHistory.map((msg, index) => (
                <div key={index} className={clsx(
                  "flex",
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  <div className={clsx(
                    "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                    msg.role === 'user' 
                      ? 'bg-accent text-white' 
                      : 'bg-black/30 text-gray-300'
                  )}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="Ask your AI copilot anything..."
              className="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatMessage.trim()}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Full Automation Tab */}
      {activeTab === 'automation' && (
        <div>
          <AutomatedTradingManager />
        </div>
      )}

      {/* Safety Dialog */}
      {safetyDialog.signal && (
        <SafetyDialog
          signal={safetyDialog.signal}
          isOpen={safetyDialog.isOpen}
          onClose={() => setSafetyDialog({ isOpen: false, signal: null })}
          onConfirm={confirmTrade}
          userBalance={userBalance}
        />
      )}
    </div>
  );
}
