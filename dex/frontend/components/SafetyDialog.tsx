"use client";

import { useState } from "react";
import { TradingSignal } from "@/lib/ai-copilot";
import { clsx } from "clsx";

interface SafetyDialogProps {
  signal: TradingSignal;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userBalance: number;
}

export default function SafetyDialog({ 
  signal, 
  isOpen, 
  onClose, 
  onConfirm, 
  userBalance 
}: SafetyDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [acknowledgeRisks, setAcknowledgeRisks] = useState(false);
  const [acknowledgeAmount, setAcknowledgeAmount] = useState(false);

  const requiredText = `EXECUTE ${signal.action.toUpperCase()}`;
  const isConfirmValid = confirmText === requiredText && acknowledgeRisks && acknowledgeAmount;

  const handleConfirm = () => {
    if (isConfirmValid) {
      onConfirm();
      onClose();
    }
  };

  const resetForm = () => {
    setConfirmText('');
    setAcknowledgeRisks(false);
    setAcknowledgeAmount(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-red-400 flex items-center gap-2">
            <span>⚠️</span>
            Safety Confirmation
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-black/30 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Trade Details */}
        <div className="bg-black/20 border border-border rounded-xl p-4 mb-6">
          <h4 className="font-semibold mb-3">Trade Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Action:</span>
              <span className={clsx(
                "font-medium",
                signal.action === 'buy' && "text-green-400",
                signal.action === 'sell' && "text-red-400",
                signal.action === 'hold' && "text-yellow-400"
              )}>
                {signal.action.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token:</span>
              <span className="font-medium">{signal.token.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Amount:</span>
              <span className="font-medium">{signal.amount.toFixed(2)} {signal.token.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Confidence:</span>
              <span className={clsx(
                "font-medium",
                signal.confidence >= 80 ? "text-green-400" : 
                signal.confidence >= 60 ? "text-yellow-400" : "text-red-400"
              )}>
                {signal.confidence}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Risk Level:</span>
              <span className={clsx(
                "font-medium",
                signal.riskAssessment === 'low' && "text-green-400",
                signal.riskAssessment === 'medium' && "text-yellow-400",
                signal.riskAssessment === 'high' && "text-red-400"
              )}>
                {signal.riskAssessment.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expected Return:</span>
              <span className="font-medium">{signal.expectedReturn.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Risk Warnings */}
        <div className="bg-red-100 border border-red-300 text-red-800 rounded-lg p-4 mb-6">
          <h4 className="font-semibold mb-2">⚠️ Risk Warnings</h4>
          <ul className="text-sm space-y-1">
            <li>• Trading cryptocurrencies involves substantial risk of loss</li>
            <li>• Past performance does not guarantee future results</li>
            <li>• AI recommendations are not financial advice</li>
            <li>• You may lose some or all of your invested capital</li>
            <li>• Market conditions can change rapidly</li>
          </ul>
        </div>

        {/* Confirmation Requirements */}
        <div className="space-y-4">
          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={acknowledgeRisks}
                onChange={(e) => setAcknowledgeRisks(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-gray-300">
                I acknowledge the risks and understand that I may lose money
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={acknowledgeAmount}
                onChange={(e) => setAcknowledgeAmount(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-gray-300">
                I confirm that I want to trade {signal.amount.toFixed(2)} {signal.token.symbol} 
                (${(signal.amount * 2).toFixed(2)} estimated value)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Type "{requiredText}" to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={requiredText}
              className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmValid}
            className={clsx(
              "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
              isConfirmValid
                ? signal.action === 'buy' 
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : signal.action === 'sell'
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-yellow-500 text-white hover:bg-yellow-600"
                : "bg-gray-500 text-gray-300 cursor-not-allowed"
            )}
          >
            {isConfirmValid ? `Execute ${signal.action.toUpperCase()}` : 'Complete Requirements'}
          </button>
        </div>

        {/* Additional Safety Info */}
        <div className="mt-4 p-3 bg-blue-100 border border-blue-300 text-blue-800 rounded-lg text-xs">
          <p>
            <strong>Note:</strong> This is a demo implementation. In a production environment, 
            additional safety measures would include position sizing limits, maximum daily loss limits, 
            and integration with your existing risk management systems.
          </p>
        </div>
      </div>
    </div>
  );
}
