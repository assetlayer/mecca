# AI Trading Copilot 🤖

A sophisticated AI-powered trading assistant integrated with your DEX that provides token analysis, trading signals, and automated trading capabilities using OpenAI's GPT-4.

## Features

### 🔍 Token Analysis
- **Technical Analysis**: RSI, support/resistance levels, trend analysis
- **Fundamental Analysis**: Liquidity assessment, volatility analysis, risk evaluation
- **AI Insights**: Market summary, key factors, risks, opportunities, price targets
- **Real-time Updates**: Auto-refresh capabilities with configurable intervals

### 🎯 Trading Signals
- **Personalized Recommendations**: AI-generated buy/sell/hold signals
- **Risk Assessment**: Low/medium/high risk categorization
- **Confidence Levels**: 0-100% confidence scoring for each signal
- **Position Sizing**: Intelligent position sizing based on risk tolerance
- **Stop Loss & Take Profit**: Automated risk management levels

### 🤖 Automated Trading Bot
- **Configurable Parameters**: Max trade amount, daily limits, confidence thresholds
- **Risk Management**: Daily loss limits, position sizing controls
- **Safety Features**: Emergency stop, daily trade limits
- **Real-time Monitoring**: Live P&L tracking and trade statistics

### 💬 AI Chat Interface
- **Natural Language**: Chat with your AI copilot about market conditions
- **Context Awareness**: Understands your current holdings and market data
- **Strategy Discussion**: Get insights on trading strategies and market trends

### 🛡️ Safety & Security
- **Confirmation Dialogs**: Multi-step confirmation for all trades
- **Risk Warnings**: Clear risk disclosures and warnings
- **Manual Override**: Ability to disable automation at any time
- **Audit Trail**: Complete logging of all trading decisions

## Setup Instructions

### 1. Environment Variables
Add your OpenAI API key to `.env.local`:
```bash
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Dependencies
The required dependencies are already installed:
- `openai`: For AI integration
- `ethers`: For blockchain interactions
- `wagmi`: For wallet connectivity

### 3. Usage

#### Access the AI Copilot
Navigate to `/ai-copilot` in your DEX application or click the "🤖 AI Copilot" link in the navigation.

#### Token Analysis
1. Select a token from the dropdown
2. Click "Analyze Token" to get comprehensive analysis
3. View technical, fundamental, and AI insights
4. Enable auto-refresh for real-time updates

#### Trading Signals
1. Set your risk tolerance (low/medium/high)
2. Click "Generate Signals" to get AI recommendations
3. Review confidence levels and risk assessments
4. Execute trades with safety confirmations

#### Automated Trading
1. Click "Show Bot Config" to access bot settings
2. Configure your trading parameters:
   - Max trade amount
   - Daily trade limits
   - Confidence thresholds
   - Risk management settings
3. Enable the bot to start automated trading
4. Monitor performance in real-time

#### AI Chat
1. Switch to the "Chat" tab
2. Ask questions about market conditions, tokens, or strategies
3. Get personalized insights based on your holdings

## Configuration Options

### Trading Bot Settings
- **Max Trade Amount**: Maximum USD value per trade
- **Min Confidence**: Minimum AI confidence level to execute trades
- **Max Daily Trades**: Maximum number of trades per day
- **Max Daily Loss**: Maximum daily loss percentage
- **Stop Loss**: Automatic stop loss percentage
- **Take Profit**: Automatic take profit percentage

### Safety Settings
- **Emergency Stop**: Immediately disable all automated trading
- **Daily Limits**: Prevent excessive trading or losses
- **Confirmation Required**: Manual confirmation for all trades
- **Risk Warnings**: Clear disclosure of trading risks

## API Integration

### AI Copilot Service
```typescript
import { aiCopilot } from '@/lib/ai-copilot';

// Analyze a token
const analysis = await aiCopilot.analyzeToken(token, currentPrice, priceChange);

// Get market analysis
const marketAnalysis = await aiCopilot.getMarketAnalysis(tokens, prices);

// Generate trading signal
const signal = await aiCopilot.generateTradingSignal(token, price, balance, riskTolerance);

// Chat with copilot
const response = await aiCopilot.chatWithCopilot(message, context);
```

### Trading Automation
```typescript
import { tradingAutomation } from '@/lib/trading-automation';

// Execute a trade
const result = await tradingAutomation.executeTrade(signal, userAddress);

// Update configuration
tradingAutomation.updateConfig({
  maxTradeAmount: 500,
  minConfidence: 80,
  enabled: true
});

// Emergency stop
tradingAutomation.emergencyStop();
```

## Safety Features

### Multi-Layer Protection
1. **Confidence Thresholds**: Only execute high-confidence signals
2. **Daily Limits**: Prevent excessive trading or losses
3. **Position Sizing**: Never risk more than configured percentage
4. **Manual Confirmation**: Required confirmation for all trades
5. **Emergency Stop**: Instant disable of all automation

### Risk Management
- **Stop Loss**: Automatic loss cutting at configured levels
- **Take Profit**: Automatic profit taking at target levels
- **Position Limits**: Maximum position size controls
- **Daily P&L Tracking**: Real-time profit/loss monitoring

## Customization

### Adding New Tokens
1. Update `V3_TOKENS` in `/lib/v3Tokens.ts`
2. Add corresponding pool addresses
3. Update price feeds if needed

### Modifying AI Prompts
Edit the prompt templates in `/lib/ai-copilot.ts`:
- `buildTokenAnalysisPrompt()`
- `buildMarketAnalysisPrompt()`
- `buildTradingSignalPrompt()`

### Custom Risk Models
Extend the risk management in `/lib/trading-automation.ts`:
- `calculatePositionSize()`
- `shouldExecuteTrade()`
- Add custom risk checks

## Monitoring & Analytics

### Real-time Dashboard
- Daily trade count and P&L
- Current bot status
- Risk metrics
- Performance statistics

### Logging
All trading decisions and AI interactions are logged for:
- Audit purposes
- Performance analysis
- Debugging
- Compliance

## Security Considerations

### API Key Security
- Store OpenAI API key in environment variables
- Never commit API keys to version control
- Use different keys for development/production

### Trading Security
- All trades require wallet confirmation
- No private key storage
- Decentralized execution through smart contracts

### Data Privacy
- No sensitive data stored locally
- AI interactions are not permanently stored
- User data remains in their wallet

## Troubleshooting

### Common Issues

#### "Failed to analyze token"
- Check OpenAI API key is valid
- Verify network connectivity
- Check API rate limits

#### "Trading bot not executing trades"
- Verify bot is enabled in configuration
- Check confidence thresholds
- Ensure daily limits not exceeded
- Verify wallet connection

#### "Safety dialog not appearing"
- Check browser console for errors
- Verify component imports
- Ensure proper state management

### Debug Mode
Enable debug logging by setting:
```typescript
console.log('AI Copilot Debug:', { signal, config, result });
```

## Future Enhancements

### Planned Features
- **Portfolio Optimization**: AI-driven portfolio rebalancing
- **Advanced Analytics**: More sophisticated technical indicators
- **Social Trading**: Share and follow trading strategies
- **Mobile App**: Native mobile application
- **API Access**: REST API for external integrations

### Integration Opportunities
- **Price Feeds**: Real-time price data integration
- **News Analysis**: Sentiment analysis from news sources
- **Social Sentiment**: Twitter/Reddit sentiment analysis
- **On-chain Analytics**: DeFi protocol analysis

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Verify all dependencies are installed
4. Ensure proper environment configuration

## Disclaimer

⚠️ **Important**: This AI copilot is for educational and informational purposes only. It does not constitute financial advice. Always do your own research and consider your risk tolerance before making any trading decisions. Past performance does not guarantee future results. Trading cryptocurrencies involves substantial risk of loss.

The AI recommendations are generated by machine learning models and may not always be accurate. Use at your own risk and never invest more than you can afford to lose.
