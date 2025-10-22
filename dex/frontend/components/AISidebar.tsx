"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { V3_TOKENS, type V3TokenInfo } from "@/lib/v3Tokens";
import { aiCopilot, type TokenAnalysis, type TradingSignal, type MarketAnalysis } from "@/lib/ai-copilot";
import { tradingAutomation, type TradingBotConfig } from "@/lib/trading-automation";
import { clsx } from "clsx";

interface AISidebarProps {
  tokenPrices: Record<string, number>;
  priceChanges: Record<string, number>;
  onExecuteTrade?: (signal: TradingSignal) => void;
}

export default function AISidebar({ tokenPrices, priceChanges, onExecuteTrade }: AISidebarProps) {
  const { address, isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botConfig, setBotConfig] = useState<TradingBotConfig>(tradingAutomation.getConfig());
  const [transactionHistory, setTransactionHistory] = useState<Array<{
    success: boolean;
    transactionHash: string;
    fromToken: string;
    toToken: string;
    amountIn: string;
    amountOut: string;
    gasUsed: string;
    timestamp: number;
  }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Listen for swap completion events
  useEffect(() => {
    const handleSwapCompleted = (event: CustomEvent) => {
      const transaction = event.detail;
      console.log('Swap completed:', transaction);
      
      // Add to transaction history
      setTransactionHistory(prev => [transaction, ...prev.slice(0, 9)]); // Keep last 10 transactions
      
      // Add transaction summary to chat
      const summaryMessage = `✅ **Transaction Completed Successfully!**

**Swap Details:**
• From: ${transaction.amountIn} ${transaction.fromToken}
• To: ${transaction.amountOut} ${transaction.toToken}
• Transaction Hash: \`${transaction.transactionHash}\`
• Gas Used: ${transaction.gasUsed}
• Timestamp: ${new Date(transaction.timestamp).toLocaleTimeString()}

The swap has been executed and confirmed on the blockchain. Your balances have been updated.`;

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        message: summaryMessage 
      }]);
    };

    window.addEventListener('swapCompleted', handleSwapCompleted as EventListener);
    
    return () => {
      window.removeEventListener('swapCompleted', handleSwapCompleted as EventListener);
    };
  }, []);

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    
    const userMessage = chatMessage;
    setChatMessage('');
    setLoading(true);
    setError(null);
    
    // Add user message to history
    setChatHistory(prev => [...prev, { role: 'user', message: userMessage }]);
    
    try {
      // Check if this is a trading command
      const tradingCommand = parseTradingCommand(userMessage);
      if (tradingCommand) {
        await handleTradingCommand(tradingCommand);
        return;
      }
      
      // Check for confirmation responses
      if (userMessage.toLowerCase().includes('yes') && (window as any).pendingTradeSignal) {
        await confirmTrade();
        return;
      }
      
      // Regular chat
      const context = {
        tokens: V3_TOKENS,
        prices: tokenPrices
      };
      const response = await aiCopilot.chatWithCopilot(userMessage, context);
      setChatHistory(prev => [...prev, { role: 'assistant', message: response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process message');
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        message: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const parseTradingCommand = (message: string): { action: string, amount: number, fromToken: string, toToken: string } | null => {
    const lowerMessage = message.toLowerCase();
    
    // Patterns like "swap 20 ASL to AUSD", "buy 100 ASL", "sell 50 WASL"
    const swapPattern = /(?:swap|exchange|convert)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for)\s+(\w+)/i;
    const buyPattern = /(?:buy|purchase)\s+(\d+(?:\.\d+)?)\s+(\w+)/i;
    const sellPattern = /(?:sell|sell off)\s+(\d+(?:\.\d+)?)\s+(\w+)/i;
    
    let match = message.match(swapPattern);
    if (match) {
      return {
        action: 'swap',
        amount: parseFloat(match[1]),
        fromToken: match[2].toUpperCase(),
        toToken: match[3].toUpperCase()
      };
    }
    
    match = message.match(buyPattern);
    if (match) {
      return {
        action: 'buy',
        amount: parseFloat(match[1]),
        fromToken: 'AUSD', // Assume buying with AUSD
        toToken: match[2].toUpperCase()
      };
    }
    
    match = message.match(sellPattern);
    if (match) {
      return {
        action: 'sell',
        amount: parseFloat(match[1]),
        fromToken: match[2].toUpperCase(),
        toToken: 'AUSD' // Assume selling to AUSD
      };
    }
    
    return null;
  };

  const handleTradingCommand = async (command: { action: string, amount: number, fromToken: string, toToken: string }) => {
    try {
      // Find tokens
      const fromTokenObj = V3_TOKENS.find(t => t.symbol === command.fromToken);
      const toTokenObj = V3_TOKENS.find(t => t.symbol === command.toToken);
      
      if (!fromTokenObj || !toTokenObj) {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          message: `Sorry, I couldn't find tokens ${command.fromToken} or ${command.toToken}. Available tokens: ${V3_TOKENS.map(t => t.symbol).join(', ')}` 
        }]);
        return;
      }

      // Generate trading signal with both tokens
      const currentPrice = tokenPrices[fromTokenObj.symbol] || 0;
      const signal: TradingSignal = {
        action: command.action === 'sell' ? 'sell' : 'buy',
        token: fromTokenObj,
        amount: command.amount,
        confidence: 85, // High confidence for direct commands
        reasoning: `User requested ${command.action} of ${command.amount} ${command.fromToken}`,
        riskAssessment: 'medium',
        expectedReturn: 0
      };

      // Store both tokens for the swap
      (window as any).pendingSwapTokens = {
        fromToken: fromTokenObj,
        toToken: toTokenObj,
        amount: command.amount
      };

      // Check if bot is enabled for immediate execution
      if (botConfig.enabled && tradingAutomation.shouldExecuteTrade(signal)) {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          message: `🤖 Executing ${command.action} of ${command.amount} ${command.fromToken} automatically...` 
        }]);
        
        const result = await tradingAutomation.executeTrade(signal, address || '');
        if (result.success) {
          setChatHistory(prev => [...prev, { 
            role: 'assistant', 
            message: `✅ Trade executed successfully! Transaction: ${result.transactionHash}` 
          }]);
        } else {
          setChatHistory(prev => [...prev, { 
            role: 'assistant', 
            message: `❌ Trade failed: ${result.error}` 
          }]);
        }
      } else {
        // Ask for confirmation
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          message: `I can help you ${command.action} ${command.amount} ${command.fromToken}${command.toToken ? ` for ${command.toToken}` : ''}. This will execute a trade on the DEX. Do you want me to proceed? (Type "yes" to confirm)` 
        }]);
        
        // Store the signal for potential execution
        (window as any).pendingTradeSignal = signal;
      }
      
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        message: `Sorry, I couldn't process that trading command. Please try again.` 
      }]);
    }
  };

  const confirmTrade = async () => {
    const signal = (window as any).pendingTradeSignal;
    const swapTokens = (window as any).pendingSwapTokens;
    
    if (!signal) return;

    setChatHistory(prev => [...prev, { 
      role: 'assistant', 
      message: `Executing trade...` 
    }]);

    try {
      // Send trade request with both tokens if available
      if (swapTokens) {
        const tradeEvent = new CustomEvent('aiTradeRequest', {
          detail: {
            signal,
            action: signal.action,
            amount: signal.amount,
            token: signal.token,
            fromToken: swapTokens.fromToken,
            toToken: swapTokens.toToken,
            autoExecute: true, // Enable automatic execution
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(tradeEvent);
      }

      if (onExecuteTrade) {
        onExecuteTrade(signal);
      }

      // Also try automated execution if bot is enabled
      if (botConfig.enabled && tradingAutomation.shouldExecuteTrade(signal)) {
        const result = await tradingAutomation.executeTrade(signal, address || '');
        if (result.success) {
          setChatHistory(prev => [...prev, { 
            role: 'assistant', 
            message: `✅ Trade executed successfully! Transaction: ${result.transactionHash}` 
          }]);
        } else {
          setChatHistory(prev => [...prev, { 
            role: 'assistant', 
            message: `❌ Trade failed: ${result.error}` 
          }]);
        }
      } else {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          message: `✅ Trade request sent to DEX interface. The swap form has been filled with your requested amounts.` 
        }]);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        message: `❌ Trade execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }]);
    }

    // Clear pending signals
    (window as any).pendingTradeSignal = null;
    (window as any).pendingSwapTokens = null;
  };


  const slideContainerClasses = clsx(
    "fixed inset-y-0 right-0 flex items-center transform transition-transform duration-300 z-50",
    isOpen ? "translate-x-0" : "translate-x-full"
  );

  if (!isConnected) {
    return (
      <>
        {/* Toggle Handle - Always visible */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "fixed top-1/2 right-0 transform -translate-y-1/2 z-50 flex flex-col items-center justify-center gap-2 w-12 h-32 rounded-l-xl shadow-lg border border-border border-r-0 text-white transition-colors duration-300",
            isOpen ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-accent/80"
          )}
          title="AI Trading Assistant"
        >
          <span className="text-2xl">{isOpen ? '✕' : '🤖'}</span>
        </button>

        {/* Sidebar Content */}
        <div className={slideContainerClasses}>
          <div className="w-80 bg-surface border-l border-border rounded-l-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs text-gray-400">Connect your wallet to get started</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              Link your wallet to unlock AI-powered trading analysis, market insights, and automation tools.
            </p>
          </div>
        </div>
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30"
            onClick={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Toggle Handle - Always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "fixed top-1/2 right-0 transform -translate-y-1/2 z-50 flex flex-col items-center justify-center gap-2 w-12 h-32 rounded-l-xl shadow-lg border border-border border-r-0 text-white transition-colors duration-300",
          isOpen ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-accent/80"
        )}
        title="AI Trading Assistant"
      >
        <span className="text-2xl">
          {isOpen ? '✕' : '🤖'}
        </span>
      </button>

      {/* Sidebar Content */}
      <div className={slideContainerClasses}>
        <div className="h-full w-80 bg-surface border-l border-border shadow-xl z-40">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h3 className="font-semibold">AI Copilot</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={clsx(
                      "w-2 h-2 rounded-full",
                      botConfig.enabled ? "bg-green-400" : "bg-gray-400"
                    )} />
                    <span className="text-xs text-gray-400">
                      {botConfig.enabled ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <div className="flex flex-col h-full">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <div className="text-4xl mb-2">🤖</div>
                        <p className="text-sm">Ask me to analyze tokens, generate trading signals, or execute trades!</p>
                        <p className="text-xs mt-2">Try: "swap 20 ASL to AUSD" or "analyze ASL"</p>
                      </div>
                    )}
                    {chatHistory.map((msg, index) => (
                      <div key={index} className={clsx(
                        "flex",
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}>
                        <div className={clsx(
                          "max-w-xs px-3 py-2 rounded-lg text-sm",
                          msg.role === 'user' 
                            ? 'bg-accent text-white' 
                            : 'bg-black/30 text-gray-300'
                        )}>
                          <p>{msg.message}</p>
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-black/30 text-gray-300 px-3 py-2 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            Thinking...
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  
                  {/* Chat Input */}
                  <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={botConfig.enabled}
                          onChange={(e) => {
                            const newConfig = { ...botConfig, enabled: e.target.checked };
                            setBotConfig(newConfig);
                            tradingAutomation.updateConfig({ enabled: e.target.checked });
                          }}
                          className="rounded"
                        />
                        <span className="text-gray-400">Auto-trading enabled</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Ask me anything..."
                        className="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        onClick={sendChatMessage}
                        disabled={!chatMessage.trim() || loading}
                        className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-50 text-sm"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
            <div className="p-4 bg-red-100 border-t border-red-300 text-red-800 text-sm">
                {error}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
