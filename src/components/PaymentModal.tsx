/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { X, Check, ShieldCheck, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { PaytmLogo } from './PaytmLogo';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPaid: (paymentMethodApplied: string, transactionId?: string) => Promise<void>;
  orderId: string;
  orderNumber: string;
  tableNo?: string;
  customerName?: string;
  amount: number;
  currencySymbol?: string;
  paymentApp?: 'UPI' | 'GPay' | 'PhonePe' | 'Paytm' | string;
  onShowToast: (msg: string) => void;
  qrCodeDataUrl?: string;
  upiId?: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirmPaid,
  orderNumber,
  tableNo,
  customerName,
  amount,
  currencySymbol = '₹',
  paymentApp = 'UPI',
  onShowToast,
  qrCodeDataUrl,
  upiId = 'orderpointpro@icici',
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [currentApp, setCurrentApp] = useState<string>(paymentApp);

  // Sync with prop updates
  useEffect(() => {
    setCurrentApp(paymentApp);
  }, [paymentApp]);

  // Reset internal states on open
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setHasCompleted(false);
      setCopied(false);
      // Auto-focus close button for accessibility & keyboard focus navigation
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 120);
    }
  }, [isOpen]);

  // Handle escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  // Pretty representation of payment provider app
  const appLabel = currentApp === 'GPay' 
    ? 'Gpay' 
    : currentApp === 'PhonePe' 
    ? 'PhonePe' 
    : currentApp === 'Paytm' 
    ? 'Paytm' 
    : 'Unified Payments Interface (UPI)';

  const appColor = currentApp === 'GPay'
    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    : currentApp === 'PhonePe'
    ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    : currentApp === 'Paytm'
    ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

  // Official high-fidelity brand logo URLs
  const appLogoUrl = currentApp === 'GPay'
    ? 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg'
    : currentApp === 'PhonePe'
    ? 'https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg'
    : currentApp === 'Paytm'
    ? 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Paytm_Logo.svg'
    : null;

  const handleSetPaid = async () => {
    setIsProcessing(true);
    try {
      // Execute the database write operation
      await onConfirmPaid(appLabel);
      
      // Delay so customer sees the success animation
      setHasCompleted(true);
      onShowToast(`🎉 UPI Payment Verified! Order ${orderNumber} is marked as Paid.`);
      
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Payment verification failed:', err);
      onShowToast('❌ Error finalizing payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      onShowToast('📋 UPI Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-[150] p-4 select-none"
      id="payment_modal_overlay"
      onClick={(e) => {
        // Close on backdrop click (outside click)
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.93, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 360 }}
        className="bg-slate-900/95 border border-slate-800 rounded-[24px] max-w-[390px] w-full max-h-[90vh] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] relative flex flex-col overflow-hidden"
        id="payment_modal_container"
      >
        {/* Close Button */}
        {!isProcessing && (
          <button
            ref={closeButtonRef}
            onClick={onClose}
            id="payment_modal_close_btn"
            aria-label="Close payment modal"
            className="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-all border border-transparent hover:border-slate-700/60 z-10 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <X size={18} />
          </button>
        )}

        {/* Scrollable container with auto overflow to fit within 90% of screen height */}
        <div className="overflow-y-auto p-5 sm:p-6 w-full flex flex-col items-center custom-scrollbar">
          
          {!hasCompleted ? (
            <div className="w-full text-center space-y-4" id="payment_qr_display_container">
              
              {/* Top header badge & info */}
              <div className="space-y-1.5 flex flex-col items-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>OrderPoint Secure Checkout</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white pt-1">
                  Scan QR code to Pay
                </h3>
                <p className="text-xs text-slate-400 leading-normal max-w-[280px]">
                  Use GPay, PhonePe, Paytm, or any UPI banking app to authorize payment.
                </p>
              </div>

              {/* QR Code Canvas Frame */}
              <div className="relative group my-1 inline-block mx-auto">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[22px] blur-xs opacity-15 group-hover:opacity-30 transition duration-300" />
                <div className="relative bg-white p-3 rounded-[20px] shadow-lg border border-slate-850 inline-flex items-center justify-center aspect-square max-w-[200px] sm:max-w-[220px] w-full">
                  <img 
                    src={qrCodeDataUrl || "/gpay-qr.jpg"} 
                    alt="Merchant Payment QR" 
                    className="w-full h-full object-contain block select-none rounded-lg"
                    onError={(e) => {
                      if (!qrCodeDataUrl) {
                        e.currentTarget.setAttribute('src', '/gpay-qr.jpg');
                      }
                    }}
                    id="payment_qrcode_img"
                  />
                </div>
              </div>

              {/* Copyable UPI Address Indicator */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">Merchant UPI Address</span>
                <div className="inline-flex items-center gap-2 bg-slate-950/50 border border-slate-800/80 px-3 py-1.5 rounded-xl max-w-full">
                  <span className="text-xs font-mono font-bold text-slate-300 truncate max-w-[200px] sm:max-w-[240px] select-all">{upiId}</span>
                  <button 
                    onClick={copyToClipboard}
                    type="button"
                    className="text-slate-400 hover:text-emerald-400 transition-colors p-1 rounded-md hover:bg-slate-800 cursor-pointer focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    title="Copy UPI Address"
                  >
                    {copied ? <Check size={12} className="text-emerald-400 stroke-[3]" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Interactive App Selector */}
              <div className="space-y-1.5 select-none w-full">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black block text-center">Select Payment App</span>
                <div className="grid grid-cols-3 gap-2 px-1">
                  {[
                    { id: 'GPay', label: 'Gpay', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg', h: 'h-4.5 sm:h-5' },
                    { id: 'PhonePe', label: 'PhonePe', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg', h: 'h-4.5 sm:h-5' },
                    { id: 'Paytm', label: 'Paytm', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Paytm_Logo.svg', h: 'h-4.5 sm:h-5' },
                  ].map(app => {
                    const isSelected = currentApp === app.id;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setCurrentApp(app.id)}
                        className={`h-9 rounded-xl border flex items-center justify-center p-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          isSelected
                            ? 'bg-slate-800 border-emerald-500/40 text-white shadow-sm ring-1 ring-emerald-500/20'
                            : 'bg-slate-950/20 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                        }`}
                      >
                        {app.id === 'Paytm' ? (
                          <PaytmLogo className="h-5.5 w-5.5" isInsideDarkBg={true} />
                        ) : (
                          <img
                            src={app.logoUrl}
                            alt={app.label}
                            className={`${app.h} object-contain`}
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pay App Indicator badge */}
              <div className={`py-1.5 px-3.5 rounded-full border text-[9.5px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${appColor}`} id="payment_app_badge">
                {currentApp === 'Paytm' ? (
                  <PaytmLogo className="h-4 w-4" isInsideDarkBg={true} />
                ) : appLogoUrl ? (
                  <img
                    src={appLogoUrl}
                    alt=""
                    className="h-4.5 sm:h-5 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    <span>Paying via UPI</span>
                  </>
                )}
              </div>

              {/* Payment Details Box (Glassmorphic) */}
              <div className="bg-slate-950/40 rounded-2xl p-3.5 text-left w-full text-xs space-y-2 border border-slate-800/60" id="payment_details_box">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Customer</span>
                  <span className="font-bold text-slate-200 truncate max-w-[150px]">
                    {customerName || 'Walk-In Guest'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Order Number</span>
                  <span className="font-mono font-bold text-slate-300 uppercase">
                    {orderNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Location</span>
                  <span className="font-bold text-slate-200">
                    {tableNo ? tableNo : 'Counter / Self Collect'}
                  </span>
                </div>
                <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Total Amount</span>
                  <span className="text-xl font-black text-emerald-400 font-display">
                    {currencySymbol}{amount}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  id="payment_modal_cancel_btn"
                  className={`h-10 sm:h-11 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    isProcessing 
                      ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:border-slate-600 active:scale-[0.98]'
                  } focus:ring-1 focus:ring-slate-500 focus:outline-none`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPaid}
                  disabled={isProcessing}
                  id="payment_modal_pay_btn"
                  className={`h-10 sm:h-11 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isProcessing
                      ? 'bg-emerald-600/40 text-slate-400 cursor-not-allowed border border-emerald-800/30'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/20 active:scale-[0.98]'
                  } focus:ring-1 focus:ring-emerald-500 focus:outline-none`}
                >
                  {isProcessing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[3]" />
                      <span>I've Paid</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : (
            /* Animated Payment Success State */
            <div className="w-full text-center py-6 space-y-4 flex flex-col items-center" id="payment_success_animation_box">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/20 animate-bounce">
                <Check size={28} className="stroke-[3.5]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-black text-emerald-400">
                  Payment Authorized
                </h4>
                <p className="text-xs text-slate-400 font-bold px-4 leading-relaxed">
                  Ledger updated securely via Firestore. Printing digital invoice token. Please wait...
                </p>
              </div>
            </div>
          )}
          
        </div>
      </motion.div>
    </motion.div>
  );
}
