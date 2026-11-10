/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChefHat, Check, User, Calendar, CreditCard, Printer, Download } from 'lucide-react';
import { formatISTDateTime } from '../lib/dateUtils';
import { formatInvoiceNumberDisplay, formatTokenDisplay, formatOrderNumberDisplay } from '../lib/orderSeriesUtils';

export function OrderPointCubeLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" fill="#10B981" />
      <path d="M12 2L21 7L12 12L3 7L12 2Z" fill="#34D399" />
      <path d="M12 12V22L3 17V7L12 12Z" fill="#059669" />
      <path d="M12 12L21 7V17L12 22V12Z" fill="#047857" />
    </svg>
  );
}

export interface BrandedInvoiceData {
  invoiceNumber: string;
  tokenNumber: string;
  orderNumber: string;
  restaurantName?: string;
  restaurantAddress?: string;
  reservationType: string;
  timestamp: number | string | Date;
  paymentMethod: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  taxLabel?: string;
  totalPaid: number;
  paymentStatus?: string;
  paidAt?: number | string | Date;
}

interface BrandedInvoiceCardProps {
  data: BrandedInvoiceData;
  onPrint?: () => void;
  onDownloadPDF?: () => void;
  showActions?: boolean;
}

export default function BrandedInvoiceCard({
  data,
  onPrint,
  onDownloadPDF,
  showActions = true
}: BrandedInvoiceCardProps) {
  const currencySymbol = '₹';
  const restName = data.restaurantName || 'The Royal Feast';
  const restAddr = data.restaurantAddress || '123 Royal Palace Avenue, India';
  const invNumber = formatInvoiceNumberDisplay(data.invoiceNumber);
  const tkNumber = formatTokenDisplay(data.tokenNumber);
  const paymentMethodLabel = (data.paymentMethod || 'UPI').toUpperCase();
  const taxText = data.taxLabel || 'GST (5%)';
  const dateFormatted = formatISTDateTime(data.timestamp);
  const paidDateFormatted = formatISTDateTime(data.paidAt || data.timestamp);

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-150 font-sans text-gray-900 select-none animate-fade-in print:shadow-none print:border-none print:max-w-none">
      
      {/* Top Branded Bar */}
      <div className="bg-[#042817] text-white px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OrderPointCubeLogo size={20} />
          <span className="font-extrabold text-sm tracking-tight text-white">OrderPoint Pro</span>
        </div>
        <span className="text-[8.5px] font-bold tracking-widest text-emerald-300 uppercase font-mono">
          SMART POS • FASTER BILLING • BETTER BUSINESS
        </span>
      </div>

      {/* Invoice Title & Pill Box */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-950 tracking-tight leading-none">INVOICE</h1>
          <p className="text-xs text-gray-400 font-medium mt-1">Thank you for your order.</p>
        </div>
        
        {/* INV pill box */}
        <div className="bg-[#eaf7ee] border border-[#cbebd3] px-5 py-2 rounded-2xl text-center shadow-2xs shrink-0">
          <span className="text-base font-black text-gray-950 block leading-tight tracking-tight">
            {invNumber}
          </span>
        </div>
      </div>

      {/* Restaurant Info Card */}
      <div className="px-5 py-1.5">
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-[#046c38] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ChefHat size={22} className="stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-gray-950 leading-tight truncate">{restName}</h3>
            <p className="text-xs text-gray-400 font-medium leading-tight mt-0.5 truncate">{restAddr}</p>
          </div>
        </div>
      </div>

      {/* Order Metadata Row */}
      <div className="px-5 py-2">
        <div className="flex items-center justify-between text-xs text-gray-700 bg-gray-50/90 px-4 py-2.5 rounded-xl border border-gray-150 font-medium">
          <div className="flex items-center gap-1.5 font-bold text-gray-900">
            <User size={13} className="text-gray-500" />
            <span>{data.reservationType || 'Dine-In'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5 text-gray-600 font-medium text-[11px]">
            <Calendar size={13} className="text-gray-400" />
            <span>{dateFormatted}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5 font-bold text-gray-900">
            <CreditCard size={13} className="text-gray-500" />
            <span>{paymentMethodLabel}</span>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="px-5 py-2">
        <div className="bg-[#eaf7ee] text-xs font-bold text-gray-900 px-4 py-2.5 rounded-t-xl border border-b-0 border-[#d1ebd7]">
          Items
        </div>
        <div className="border border-[#d1ebd7] rounded-b-xl overflow-hidden bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/60">
                <th className="py-2 px-3 text-left">Item</th>
                <th className="py-2 px-3 text-center w-14">Qty</th>
                <th className="py-2 px-3 text-right w-20">Price</th>
                <th className="py-2 px-3 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {data.items.map((it, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40">
                  <td className="py-2.5 px-3 font-bold text-gray-950 text-xs">
                    {it.name}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-gray-900 text-xs">
                    {it.quantity}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600 font-mono text-xs">
                    {currencySymbol}{Number(it.price).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-gray-950 font-mono text-xs">
                    {currencySymbol}{Number(it.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Summary Section */}
      <div className="px-5 py-2">
        <div className="bg-[#eaf7ee] text-xs font-bold text-gray-900 px-4 py-2.5 rounded-t-xl border border-b-0 border-[#d1ebd7]">
          Bill Summary
        </div>
        <div className="border border-[#d1ebd7] rounded-b-xl p-3.5 space-y-2 bg-white text-xs">
          <div className="flex justify-between items-center text-gray-700 font-medium">
            <span>Subtotal</span>
            <span className="font-bold text-gray-950 font-mono">{currencySymbol}{Number(data.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-gray-700 font-medium">
            <span>{taxText}</span>
            <span className="font-bold text-gray-950 font-mono">{currencySymbol}{Number(data.taxAmount).toFixed(2)}</span>
          </div>
          
          {/* Total Paid Green Banner */}
          <div className="bg-[#eaf7ee] border border-[#cbebd3] rounded-xl p-3.5 flex justify-between items-center mt-2.5">
            <span className="text-base font-black text-gray-950 tracking-tight">Total Paid</span>
            <span className="text-2xl font-black text-[#046c38] font-mono tracking-tight">
              {currencySymbol}{Number(data.totalPaid).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Status Section */}
      <div className="px-5 py-2">
        <div className="bg-[#eaf7ee] text-xs font-bold text-gray-900 px-4 py-2.5 rounded-t-xl border border-b-0 border-[#d1ebd7]">
          Payment Status
        </div>
        <div className="border border-[#d1ebd7] rounded-b-xl p-3.5 bg-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#046c38] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Check size={16} strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-[#046c38] leading-tight">Payment Successful</h4>
              <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5 truncate">
                {currencySymbol}{Number(data.totalPaid).toFixed(2)} paid via {paymentMethodLabel}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-gray-400 shrink-0 font-mono">
            {paidDateFormatted}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium mt-1">
        <span>Thank you for choosing OrderPoint Pro!</span>
        <div className="flex items-center gap-1.5 font-bold text-gray-800">
          <OrderPointCubeLogo size={14} />
          <span>OrderPoint Pro</span>
        </div>
      </div>

      {/* Print and Download Actions */}
      {showActions && (
        <div className="p-4 bg-gray-50 border-t border-gray-150 flex gap-2.5 print:hidden">
          {onDownloadPDF && (
            <button
              type="button"
              onClick={onDownloadPDF}
              className="flex-1 h-11 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-none shadow-xs active:scale-[0.98]"
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="flex-1 h-11 bg-white hover:bg-gray-100 border border-gray-300 text-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Printer size={14} />
              <span>Print Invoice</span>
            </button>
          )}
        </div>
      )}

    </div>
  );
}
