import OpenAI from 'openai';
import { V3_TOKENS, V3TokenInfo } from './v3Tokens';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for client-side usage
});

export interface TokenAnalysis {
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange24h: number;
  marketCap?: number;
  volume24h?: number;
  technicalAnalysis: {
    trend: 'bullish' | 'bearish' | 'neutral';
    support: number;
    resistance: number;
    rsi: number;
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number; // 0-100
  };
  fundamentalAnalysis: {
    liquidity: 'high' | 'medium' | 'low';
    volatility: 'high' | 'medium' | 'low';
    riskLevel: 'low' | 'medium' | 'high';
    utility: string;
    recommendation: 'buy' | 'sell' | 'hold';
    confidence: number; // 0-100
  };
  aiInsights: {
    summary: string;
    keyFactors: string[];
    risks: string[];
    opportunities: string[];
    priceTarget: {
      short: number; // 1-7 days
      medium: number; // 1-4 weeks
      long: number; // 1-3 months
    };
  };
}

export interface TradingSignal {
  action: 'buy' | 'sell' | 'hold';
  token: V3TokenInfo;
  counterToken: V3TokenInfo;
  amount: number;
  confidence: number;
  reasoning: string;
  riskAssessment: 'low' | 'medium' | 'high';
  expectedReturn: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface MarketAnalysis {
  overallTrend: 'bullish' | 'bearish' | 'neutral';
  marketSentiment: 'positive' | 'negative' | 'neutral';
  keyEvents: string[];
  recommendations: TradingSignal[];
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
}

export class AICopilot {
  private static instance: AICopilot;
  private analysisCache: Map<string, TokenAnalysis> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AICopilot {
    if (!AICopilot.instance) {
      AICopilot.instance = new AICopilot();
    }
    return AICopilot.instance;
  }

  async analyzeToken(token: V3TokenInfo, currentPrice: number, priceChange24h: number = 0): Promise<TokenAnalysis> {
    const cacheKey = `${token.symbol}-${currentPrice}-${priceChange24h}`;
    const cached = this.analysisCache.get(cacheKey);
    
    if (cached && Date.now() - (cached as any).timestamp < this.cacheTimeout) {
      return cached;
    }

    try {
      const prompt = this.buildTokenAnalysisPrompt(token, currentPrice, priceChange24h);
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert cryptocurrency analyst and trading advisor. Provide detailed technical and fundamental analysis with specific recommendations. Always consider risk management and provide confidence levels for your assessments."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const analysis = this.parseTokenAnalysis(response.choices[0].message.content || '', token, currentPrice, priceChange24h);
      
      // Cache the result
      (analysis as any).timestamp = Date.now();
      this.analysisCache.set(cacheKey, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing token:', error);
      throw new Error('Failed to analyze token. Please try again.');
    }
  }

  async getMarketAnalysis(tokens: V3TokenInfo[], prices: Record<string, number>): Promise<MarketAnalysis> {
    try {
      const prompt = this.buildMarketAnalysisPrompt(tokens, prices);
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert cryptocurrency market analyst. Analyze the overall market conditions and provide trading recommendations. Focus on risk management and portfolio optimization."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2500
      });

      return this.parseMarketAnalysis(response.choices[0].message.content || '', tokens, prices);
    } catch (error) {
      console.error('Error analyzing market:', error);
      throw new Error('Failed to analyze market. Please try again.');
    }
  }

  async generateTradingSignal(
    token: V3TokenInfo,
    currentPrice: number,
    userBalance: number,
    riskTolerance: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<TradingSignal> {
    try {
      const prompt = this.buildTradingSignalPrompt(token, currentPrice, userBalance, riskTolerance);
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert trading advisor. Generate specific trading signals with clear entry/exit points, risk management, and position sizing. Always prioritize capital preservation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      return this.parseTradingSignal(response.choices[0].message.content || '', token, currentPrice, userBalance);
    } catch (error) {
      console.error('Error generating trading signal:', error);
      throw new Error('Failed to generate trading signal. Please try again.');
    }
  }

  async chatWithCopilot(message: string, context?: { tokens: V3TokenInfo[], prices: Record<string, number> }): Promise<string> {
    try {
      const systemPrompt = context 
        ? `You are an AI trading copilot for a DEX. Current context: ${JSON.stringify(context)}`
        : "You are an AI trading copilot for a DEX. Help users with trading decisions, token analysis, and market insights.";
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content || 'Sorry, I could not process your request.';
    } catch (error) {
      console.error('Error in chat:', error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  }

  private buildTokenAnalysisPrompt(token: V3TokenInfo, currentPrice: number, priceChange24h: number): string {
    return `
Analyze the following token for trading:

Token: ${token.name} (${token.symbol})
Current Price: $${currentPrice}
24h Change: ${priceChange24h}%
Decimals: ${token.decimals}
Is Native: ${token.isNative}

Please provide a comprehensive analysis including:

1. Technical Analysis:
   - Trend direction (bullish/bearish/neutral)
   - Support and resistance levels
   - RSI level
   - Trading recommendation with confidence level

2. Fundamental Analysis:
   - Liquidity assessment
   - Volatility level
   - Risk assessment
   - Utility and use case
   - Investment recommendation with confidence level

3. AI Insights:
   - Market summary
   - Key factors affecting price
   - Potential risks
   - Opportunities
   - Price targets (short/medium/long term)

Format your response as JSON with the following structure:
{
  "technicalAnalysis": {
    "trend": "bullish|bearish|neutral",
    "support": number,
    "resistance": number,
    "rsi": number,
    "recommendation": "buy|sell|hold",
    "confidence": number
  },
  "fundamentalAnalysis": {
    "liquidity": "high|medium|low",
    "volatility": "high|medium|low",
    "riskLevel": "low|medium|high",
    "utility": "string",
    "recommendation": "buy|sell|hold",
    "confidence": number
  },
  "aiInsights": {
    "summary": "string",
    "keyFactors": ["string"],
    "risks": ["string"],
    "opportunities": ["string"],
    "priceTarget": {
      "short": number,
      "medium": number,
      "long": number
    }
  }
}
    `;
  }

  private buildMarketAnalysisPrompt(tokens: V3TokenInfo[], prices: Record<string, number>): string {
    const tokenData = tokens.map(token => ({
      symbol: token.symbol,
      name: token.name,
      price: prices[token.symbol] || 0
    }));

    return `
Analyze the overall market conditions for this DEX:

Tokens: ${JSON.stringify(tokenData)}

Provide a comprehensive market analysis including:

1. Overall market trend
2. Market sentiment
3. Key events affecting the market
4. Trading recommendations for each token
5. Risk assessment
6. Market summary

Format as JSON with trading signals for each token.
    `;
  }

  private buildTradingSignalPrompt(
    token: V3TokenInfo,
    currentPrice: number,
    userBalance: number,
    riskTolerance: string
  ): string {
    return `
Generate a specific trading signal for:

Token: ${token.name} (${token.symbol})
Current Price: $${currentPrice}
User Balance: ${userBalance} ${token.symbol}
Risk Tolerance: ${riskTolerance}

Provide:
1. Specific action (buy/sell/hold)
2. Recommended amount
3. Confidence level (0-100)
4. Reasoning
5. Risk assessment
6. Expected return
7. Stop loss and take profit levels
8. Counter token symbol to trade against (default to AUSD if not specified)

Format as JSON with specific trading parameters.
    `;
  }

  private parseTokenAnalysis(response: string, token: V3TokenInfo, currentPrice: number, priceChange24h: number): TokenAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        symbol: token.symbol,
        name: token.name,
        currentPrice,
        priceChange24h,
        technicalAnalysis: parsed.technicalAnalysis,
        fundamentalAnalysis: parsed.fundamentalAnalysis,
        aiInsights: parsed.aiInsights
      };
    } catch (error) {
      console.error('Error parsing token analysis:', error);
      // Return default analysis if parsing fails
      return this.getDefaultTokenAnalysis(token, currentPrice, priceChange24h);
    }
  }

  private parseMarketAnalysis(response: string, tokens: V3TokenInfo[], prices: Record<string, number>): MarketAnalysis {
    try {
      const parsed = JSON.parse(response);
      const recommendations: TradingSignal[] = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((rec: any) => this.normalizeTradingSignal(rec))
        : [];
      return {
        overallTrend: parsed.overallTrend || 'neutral',
        marketSentiment: parsed.marketSentiment || 'neutral',
        keyEvents: parsed.keyEvents || [],
        recommendations,
        riskLevel: parsed.riskLevel || 'medium',
        summary: parsed.summary || 'Market analysis unavailable'
      };
    } catch (error) {
      console.error('Error parsing market analysis:', error);
      return {
        overallTrend: 'neutral',
        marketSentiment: 'neutral',
        keyEvents: [],
        recommendations: [],
        riskLevel: 'medium',
        summary: 'Market analysis unavailable'
      };
    }
  }

  private parseTradingSignal(response: string, token: V3TokenInfo, currentPrice: number, userBalance: number): TradingSignal {
    try {
      const parsed = JSON.parse(response);
      return this.normalizeTradingSignal(parsed, token);
    } catch (error) {
      console.error('Error parsing trading signal:', error);
      return {
        action: 'hold',
        token,
        counterToken: this.getDefaultCounterToken(token),
        amount: 0,
        confidence: 50,
        reasoning: 'Analysis unavailable',
        riskAssessment: 'medium',
        expectedReturn: 0
      };
    }
  }

  private normalizeTradingSignal(rawSignal: any, fallbackToken?: V3TokenInfo): TradingSignal {
    const resolvedToken = this.resolveToken(rawSignal?.token || rawSignal?.tokenSymbol, fallbackToken) || (fallbackToken || V3_TOKENS[0]);
    const resolvedCounter = this.resolveToken(
      rawSignal?.counterToken || rawSignal?.counterTokenSymbol,
      this.getDefaultCounterToken(resolvedToken)
    );

    return {
      action: rawSignal?.action || 'hold',
      token: resolvedToken,
      counterToken: resolvedCounter,
      amount: rawSignal?.amount || 0,
      confidence: rawSignal?.confidence || 50,
      reasoning: rawSignal?.reasoning || 'No reasoning provided',
      riskAssessment: rawSignal?.riskAssessment || 'medium',
      expectedReturn: rawSignal?.expectedReturn || 0,
      stopLoss: rawSignal?.stopLoss,
      takeProfit: rawSignal?.takeProfit
    };
  }

  private resolveToken(tokenCandidate: any, fallback?: V3TokenInfo): V3TokenInfo {
    if (!tokenCandidate) {
      return fallback || V3_TOKENS[0];
    }

    if (typeof tokenCandidate === 'object' && tokenCandidate.symbol) {
      const match = V3_TOKENS.find(token => token.symbol.toUpperCase() === String(tokenCandidate.symbol).toUpperCase());
      if (match) return match;
    }

    const symbol = typeof tokenCandidate === 'string'
      ? tokenCandidate
      : tokenCandidate?.tokenSymbol;

    if (symbol) {
      const match = V3_TOKENS.find(token => token.symbol.toUpperCase() === String(symbol).toUpperCase());
      if (match) return match;
    }

    return fallback || V3_TOKENS[0];
  }

  private getDefaultCounterToken(token: V3TokenInfo): V3TokenInfo {
    if (token.symbol === 'AUSD') {
      return V3_TOKENS.find(t => t.symbol === 'ASL') || token;
    }

    return V3_TOKENS.find(t => t.symbol === 'AUSD') || token;
  }

  private getDefaultTokenAnalysis(token: V3TokenInfo, currentPrice: number, priceChange24h: number): TokenAnalysis {
    return {
      symbol: token.symbol,
      name: token.name,
      currentPrice,
      priceChange24h,
      technicalAnalysis: {
        trend: 'neutral',
        support: currentPrice * 0.9,
        resistance: currentPrice * 1.1,
        rsi: 50,
        recommendation: 'hold',
        confidence: 50
      },
      fundamentalAnalysis: {
        liquidity: 'medium',
        volatility: 'medium',
        riskLevel: 'medium',
        utility: 'DEX utility token',
        recommendation: 'hold',
        confidence: 50
      },
      aiInsights: {
        summary: 'Analysis unavailable',
        keyFactors: ['Market data unavailable'],
        risks: ['Unknown risks'],
        opportunities: ['Potential opportunities'],
        priceTarget: {
          short: currentPrice,
          medium: currentPrice,
          long: currentPrice
        }
      }
    };
  }
}

export const aiCopilot = AICopilot.getInstance();
