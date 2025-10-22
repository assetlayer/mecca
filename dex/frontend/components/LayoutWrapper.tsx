"use client";

import { useState, useEffect } from "react";
import AISidebar from "./AISidebar";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [tokenPrices, setTokenPrices] = useState({
    ASL: 2.00,
    WASL: 2.00,
    AUSD: 1.00
  });
  const [priceChanges, setPriceChanges] = useState({
    ASL: 0,
    WASL: 0,
    AUSD: 0
  });

  // Simulate price fluctuations
  useEffect(() => {
    const updatePrices = () => {
      setTokenPrices(prevPrices => {
        const newPrices = { ...prevPrices };
        const newChanges = { ...priceChanges };
        
        // ASL price fluctuates between $1.50 and $2.50
        const aslChange = (Math.random() - 0.5) * 0.07;
        const oldASL = prevPrices.ASL;
        newPrices.ASL = Math.max(1.50, Math.min(2.50, prevPrices.ASL + aslChange));
        newChanges.ASL = newPrices.ASL - oldASL;
        
        // WASL follows ASL with slight variation
        const waslChange = (Math.random() - 0.5) * 0.015;
        const oldWASL = prevPrices.WASL;
        newPrices.WASL = Math.max(1.50, Math.min(2.50, newPrices.ASL + waslChange));
        newChanges.WASL = newPrices.WASL - oldWASL;
        
        // AUSD has slight stablecoin volatility
        const ausdChange = (Math.random() - 0.5) * 0.007;
        const oldAUSD = prevPrices.AUSD;
        newPrices.AUSD = Math.max(0.995, Math.min(1.005, prevPrices.AUSD + ausdChange));
        newChanges.AUSD = newPrices.AUSD - oldAUSD;
        
        setPriceChanges(newChanges);
        return newPrices;
      });
    };

    const interval = setInterval(updatePrices, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [priceChanges]);

  const handleExecuteTrade = (signal: any) => {
    // Dispatch a custom event to communicate with the swap interface
    const tradeEvent = new CustomEvent('aiTradeRequest', {
      detail: {
        signal,
        action: signal.action,
        amount: signal.amount,
        token: signal.token,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(tradeEvent);
    
    console.log('AI Trade Request dispatched:', signal);
  };

  return (
    <>
      {children}
      <AISidebar
        tokenPrices={tokenPrices}
        priceChanges={priceChanges}
        onExecuteTrade={handleExecuteTrade}
      />
    </>
  );
}
