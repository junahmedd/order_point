/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import PageLayout from './PageLayout';
import { 
  Receipt, 
  CheckCircle, 
  Printer, 
  CreditCard, 
  Download, 
  ArrowLeft, 
  ArrowRight,
  User, 
  Calendar,
  Check,
  Banknote,
  Send,
  Armchair,
  ChefHat,
  ShoppingBag,
  Sparkles,
  Clock
} from 'lucide-react';
import { Order, MenuItem } from '../types';
import { jsPDF } from 'jspdf';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { formatISTDateTime } from '../lib/dateUtils';
import { 
  getNextInvoiceNumber, 
  formatInvoiceNumberDisplay, 
  formatTokenDisplay, 
  formatOrderNumberDisplay 
} from '../lib/orderSeriesUtils';
import BrandedInvoiceCard, { BrandedInvoiceData } from './BrandedInvoiceCard';

interface BillingProps {
  orders: Order[];
  menuItems: MenuItem[];
  onMarkOrderPaid: (
    orderId: string, 
    paymentMethod: 'cash' | 'upi' | 'card' | string, 
    details?: { 
      discount?: number; 
      invoiceNo?: string; 
      customerPhone?: string; 
      customerName?: string;
      customerEmail?: string;
      pdfDataUri?: string;
      transactionId?: string;
    }
  ) => void;
  onSendWhatsAppBill: (orderId: string, phone: string) => void;
  onShowToast: (msg: string) => void;
  settings?: any;
  onNavigateToTab?: (tab: any) => void;
}

export default function Billing({ 
  orders, 
  menuItems, 
  onMarkOrderPaid, 
  onSendWhatsAppBill, 
  onShowToast, 
  settings, 
  onNavigateToTab 
}: BillingProps) {
  const currencySymbol = settings?.prefCurrency || '₹';
  const gstPercentage = settings?.gstPercentage !== undefined ? settings.gstPercentage : 5;
  const taxEnabled = settings?.taxEnabled !== undefined ? settings.taxEnabled : true;
  const gstRate = taxEnabled ? (gstPercentage / 100) : 0;
  
  // Navigation & Selection state - initial selectedOrderId is empty so occupied tables list shows first!
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [billingTab, setBillingTab] = useState<'pending' | 'history'>('pending');
  
  // Payment settlement state - pre-billing options are Cash and Card only (no separate pre-billing UPI)
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card'>('cash');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<boolean>(false);

  // Filter ONLY occupied tables / active orders that need billing (search bar removed completely)
  const occupiedTableOrders = useMemo(() => {
    const list = orders.filter(o => !o.isPaid && o.status !== 'Cancelled' && o.status !== 'Completed');
    // Sort oldest active orders first
    list.sort((a, b) => a.timestamp - b.timestamp);
    return list;
  }, [orders]);

  // Paid orders history
  const paidOrders = useMemo(() => {
    const list = orders.filter(o => o.isPaid || o.status === 'Completed' && (o as any).invoiceNumber);
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [orders]);

  // Active Order Object - STRICT RULE: ONLY returns an order when selectedOrderId is set (when BILL NOW is clicked!)
  const activeOrderObj = useMemo(() => {
    if (!selectedOrderId) return null;
    if (billingTab === 'history') {
      return paidOrders.find(o => o.id === selectedOrderId) || null;
    } else {
      return occupiedTableOrders.find(o => o.id === selectedOrderId) || null;
    }
  }, [selectedOrderId, billingTab, paidOrders, occupiedTableOrders]);

  // Synchronize phone number when active order changes
  useEffect(() => {
    if (activeOrderObj) {
      setCustomerPhone(activeOrderObj.customerPhone || '');
      if (activeOrderObj.isPaid) {
        const method = (activeOrderObj.paymentMethod || 'cash').toLowerCase();
        if (method === 'card') setSelectedMethod('card');
        else setSelectedMethod('cash');
      }
    }
  }, [activeOrderObj]);

  // Sequential Series Numbers
  const activeInvoiceNo = useMemo(() => {
    if (!activeOrderObj) return getNextInvoiceNumber(orders);
    if ((activeOrderObj as any).invoiceNumber) {
      return formatInvoiceNumberDisplay((activeOrderObj as any).invoiceNumber);
    }
    return getNextInvoiceNumber(orders);
  }, [activeOrderObj, orders]);

  const activeTokenNo = useMemo(() => {
    if (!activeOrderObj) return 'TK-01';
    return formatTokenDisplay((activeOrderObj as any).orderToken || activeOrderObj.orderNumber);
  }, [activeOrderObj]);

  // Itemized calculations
  const calculatedItems = useMemo(() => {
    if (!activeOrderObj) return [];
    return activeOrderObj.items.map(item => {
      const rate = item.unitPrice !== undefined ? item.unitPrice : (item.menuItem?.price || 0);
      const qty = item.quantity || 1;
      const img = item.menuItem?.imageUrl || '';
      return {
        id: item.menuItem?.id || item.productName || Math.random().toString(),
        name: item.productName || item.menuItem?.name || 'Dish Item',
        quantity: qty,
        price: rate,
        amount: rate * qty,
        imageUrl: img
      };
    });
  }, [activeOrderObj]);

  const subtotal = useMemo(() => {
    return calculatedItems.reduce((sum, item) => sum + item.amount, 0);
  }, [calculatedItems]);

  const taxAmount = Math.round(subtotal * gstRate);
  // Total without discount per requirement (Discount field completely removed)
  const totalAmountVal = subtotal + taxAmount;

  // Formatted Customer & Table labels
  const formattedCustomerLabel = useMemo(() => {
    if (!activeOrderObj) return 'Dine-In (Table 1)';
    if (activeOrderObj.type === 'Takeaway') {
      return activeOrderObj.customerName || (activeOrderObj.customerPhone ? `Takeaway (${activeOrderObj.customerPhone})` : 'Takeaway Guest');
    }
    const cleanTable = activeOrderObj.tableNo ? (activeOrderObj.tableNo.toLowerCase().startsWith('table') ? activeOrderObj.tableNo : `Table ${activeOrderObj.tableNo}`) : 'Table 1';
    return `Dine-In (${cleanTable})`;
  }, [activeOrderObj]);

  // Branded Invoice Data for Image 2 layout
  const brandedInvoiceData: BrandedInvoiceData | null = useMemo(() => {
    if (!activeOrderObj) return null;
    return {
      invoiceNumber: activeInvoiceNo,
      tokenNumber: activeTokenNo,
      orderNumber: formatOrderNumberDisplay(activeOrderObj.orderNumber),
      restaurantName: settings?.restaurantInfo?.name || 'The Royal Feast',
      restaurantAddress: settings?.restaurantInfo?.address || '123 Royal Palace Avenue, India',
      reservationType: formattedCustomerLabel,
      timestamp: activeOrderObj.timestamp || Date.now(),
      paymentMethod: selectedMethod.toUpperCase(),
      items: calculatedItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        amount: i.amount
      })),
      subtotal,
      taxAmount,
      taxLabel: `Tax (GST ${gstPercentage}%)`,
      totalPaid: totalAmountVal,
      paymentStatus: 'Payment Successful',
      paidAt: (activeOrderObj as any).paymentAt || Date.now()
    };
  }, [activeOrderObj, activeInvoiceNo, activeTokenNo, settings, formattedCustomerLabel, selectedMethod, calculatedItems, subtotal, taxAmount, gstPercentage, totalAmountVal]);

  // PDF Generator Helper
  const handleDownloadPDF = () => {
    if (!brandedInvoiceData) return;
    try {
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(brandedInvoiceData.restaurantName || 'OrderPoint Pro', 40, 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(brandedInvoiceData.restaurantAddress || '', 40, 15, { align: 'center' });
      
      doc.setFont('helvetica', 'bold');
      doc.text(`INVOICE: ${brandedInvoiceData.invoiceNumber}  |  TOKEN: ${brandedInvoiceData.tokenNumber}`, 40, 22, { align: 'center' });
      doc.line(5, 25, 75, 25);

      let y = 30;
      doc.setFontSize(8);
      brandedInvoiceData.items.forEach(it => {
        doc.text(`${it.name} x${it.quantity}`, 5, y);
        doc.text(`Rs. ${it.amount.toFixed(2)}`, 75, y, { align: 'right' });
        y += 5;
      });

      doc.line(5, y, 75, y);
      y += 5;
      doc.text(`Subtotal:`, 5, y);
      doc.text(`Rs. ${brandedInvoiceData.subtotal.toFixed(2)}`, 75, y, { align: 'right' });
      y += 4;
      doc.text(`GST (${gstPercentage}%):`, 5, y);
      doc.text(`Rs. ${brandedInvoiceData.taxAmount.toFixed(2)}`, 75, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`TOTAL:`, 5, y);
      doc.text(`Rs. ${brandedInvoiceData.totalPaid.toFixed(2)}`, 75, y, { align: 'right' });

      doc.save(`Invoice_${brandedInvoiceData.invoiceNumber}.pdf`);
      onShowToast(`PDF saved • ${brandedInvoiceData.invoiceNumber}`);
    } catch (e) {
      console.error(e);
      onShowToast('Could not compile PDF.');
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  // FINALIZE PAYMENT ACTION (Confirm Billing)
  const handleFinalizePayment = async () => {
    if (!activeOrderObj) return;
    setIsProcessing(true);

    try {
      const restId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const assignedInvoiceNo = activeInvoiceNo;
      const assignedTokenNo = activeTokenNo;

      // 1. Mark Order as Paid and Completed in Firestore (Automatically releases table!)
      await onMarkOrderPaid(activeOrderObj.id, selectedMethod, {
        discount: 0,
        invoiceNo: assignedInvoiceNo,
        customerPhone: cleanPhone || activeOrderObj.customerPhone || '',
        customerName: activeOrderObj.customerName || formattedCustomerLabel
      });

      // 2. Persist Dedicated Invoice Record in Firestore
      try {
        const invoiceDocRef = doc(db, `restaurants/${restId}/invoices/${assignedInvoiceNo}`);
        await setDoc(invoiceDocRef, {
          invoiceNumber: assignedInvoiceNo,
          invoiceNo: assignedInvoiceNo,
          tokenNumber: assignedTokenNo,
          orderNumber: formatOrderNumberDisplay(activeOrderObj.orderNumber),
          orderId: activeOrderObj.id,
          tableNo: activeOrderObj.tableNo || '',
          reservationType: formattedCustomerLabel,
          type: activeOrderObj.type,
          customerPhone: cleanPhone,
          customerName: activeOrderObj.customerName || formattedCustomerLabel,
          items: calculatedItems,
          subtotal,
          taxes: taxAmount,
          taxAmount,
          total: totalAmountVal,
          totalAmount: totalAmountVal,
          paymentMethod: selectedMethod.toUpperCase(),
          paymentStatus: 'Paid',
          isPaid: true,
          timestamp: activeOrderObj.timestamp || Date.now(),
          paymentAt: Date.now()
        }, { merge: true });
      } catch (invSaveErr) {
        console.warn('Could not write invoice subcollection:', invSaveErr);
      }

      // 3. Automatically Open WhatsApp with Customer's Mobile Number
      const publicInvoiceLink = `${window.location.origin}/?invoice=${assignedInvoiceNo}&store=${restId}`;
      const whatsappMessage = `Hi! Thank you for dining with us. 😊\n\nYour invoice is ready. View or download your bill here:\n\n📄 "View Invoice PDF" (${publicInvoiceLink})\n\nThank you for choosing us! ❤️`;

      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(waUrl, '_blank');
      }

      onShowToast(`Payment finalized • ${assignedInvoiceNo} (${assignedTokenNo})`);

      // 4. Open Invoice Modal / View for instant Cashier confirmation
      setViewInvoiceModal(true);
    } catch (err: any) {
      console.error('Finalize payment error:', err);
      onShowToast('Error finalizing payment. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <PageLayout
      title="Billing"
      subtitle="Generate invoices and manage customer payments."
      id="billing_view"
      activeTab="Billing"
      onTabChange={onNavigateToTab}
      pillVariant="green"
    >
      <div className="w-full font-sans select-none pb-8">
        
        {/* SUB-TABS: Occupied Tables vs Paid Invoices */}
        <div className="flex items-center justify-between gap-3 mb-4 max-w-2xl mx-auto">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { setBillingTab('pending'); setSelectedOrderId(''); setViewInvoiceModal(false); }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                billingTab === 'pending'
                  ? 'bg-white text-gray-950 shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              Occupied Tables ({occupiedTableOrders.length})
            </button>
            <button
              type="button"
              onClick={() => { setBillingTab('history'); setSelectedOrderId(''); setViewInvoiceModal(false); }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                billingTab === 'history'
                  ? 'bg-white text-gray-950 shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              Paid Invoices ({paidOrders.length})
            </button>
          </div>

          {activeOrderObj && (
            <button
              type="button"
              onClick={() => { setSelectedOrderId(''); setViewInvoiceModal(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer border-none shrink-0"
            >
              <ArrowLeft size={13} />
              <span>Occupied Tables</span>
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: OCCUPIED TABLES LIST (Only displays occupied tables!) */}
        {/* Search bar removed completely. Billing opens ONLY on BILL NOW! */}
        {/* ============================================================== */}
        {!activeOrderObj ? (
          <div className="max-w-2xl mx-auto space-y-3.5 animate-fade-in">
            
            {billingTab === 'pending' ? (
              <>
                {occupiedTableOrders.length === 0 ? (
                  <div className="py-16 text-center bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 space-y-3 shadow-2xs">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                      <CheckCircle size={32} className="stroke-[2]" />
                    </div>
                    <h3 className="text-base font-black text-gray-950">No Occupied Tables</h3>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                      All restaurant tables are currently available and bills are settled. When a waiter or POS places an order, the occupied table will appear here with a <strong className="text-gray-700">BILL NOW</strong> option.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 px-1">
                      <span>OCCUPIED TABLES REQUIRING BILLING ({occupiedTableOrders.length})</span>
                      <span className="text-[11px] text-emerald-700 font-bold">Live Synced</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {occupiedTableOrders.map((ord, idx) => {
                        const tk = formatTokenDisplay((ord as any).orderToken || ord.orderNumber, idx + 1);
                        const inv = formatInvoiceNumberDisplay((ord as any).invoiceNumber, ord.orderNumber, idx + 1);
                        const isTakeaway = ord.type === 'Takeaway' || !ord.tableNo;
                        const tableName = isTakeaway 
                          ? 'Takeaway' 
                          : (ord.tableNo.toLowerCase().startsWith('table') ? ord.tableNo : `Table ${ord.tableNo}`);

                        // Preview of items
                        const itemsSummary = ord.items.map(i => `${i.productName || i.menuItem?.name} (x${i.quantity})`).join(', ');

                        return (
                          <div
                            key={ord.id}
                            className="bg-white border-2 border-emerald-600/30 hover:border-emerald-600 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              {/* Top Table Header & Badges */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isTakeaway ? (
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                                      <ShoppingBag size={16} />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#046c38] flex items-center justify-center shrink-0">
                                      <Armchair size={16} />
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="font-black text-sm text-gray-950 leading-tight">
                                      {tableName}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 block font-medium">
                                      {ord.customerName || 'Guest'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                                  <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded border border-gray-200">
                                    {inv}
                                  </span>
                                  <span className="bg-black text-white px-1.5 py-0.5 rounded">
                                    {tk}
                                  </span>
                                </div>
                              </div>

                              {/* Ordered Items Preview */}
                              <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-150">
                                <span className="text-[10.5px] text-gray-500 font-medium line-clamp-2 leading-relaxed">
                                  {itemsSummary || 'Food items'}
                                </span>
                              </div>
                            </div>

                            {/* Bottom Total Amount and Prominent BILL NOW button */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Bill Total</span>
                                <span className="text-base sm:text-lg font-black text-gray-950 font-mono leading-none">
                                  {currencySymbol}{ord.totalAmount}
                                </span>
                              </div>

                              {/* BILL NOW BUTTON (Automatically opens the billing receipt for this specific table) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderId(ord.id);
                                  setViewInvoiceModal(false);
                                }}
                                className="h-10 px-4 bg-[#046c38] hover:bg-[#03542b] active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border-none"
                              >
                                <span>BILL NOW</span>
                                <ArrowRight size={13} />
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* PAID INVOICES TAB */
              <div className="space-y-2.5">
                {paidOrders.length === 0 ? (
                  <div className="py-14 text-center bg-white border border-gray-150 rounded-2xl p-6 space-y-2">
                    <Receipt size={36} className="mx-auto text-gray-300 stroke-[1.5]" />
                    <h3 className="text-sm font-black text-gray-900">No Paid Invoices Recorded Yet</h3>
                  </div>
                ) : (
                  paidOrders.map((ord, idx) => {
                    const tk = formatTokenDisplay((ord as any).orderToken || ord.orderNumber, idx + 1);
                    const inv = formatInvoiceNumberDisplay((ord as any).invoiceNumber, ord.orderNumber, idx + 1);
                    const tbl = ord.tableNo ? (ord.tableNo.toLowerCase().startsWith('table') ? ord.tableNo : `Table ${ord.tableNo}`) : (ord.type || 'Dine-In');

                    return (
                      <div
                        key={ord.id}
                        onClick={() => { setSelectedOrderId(ord.id); setViewInvoiceModal(true); }}
                        className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-gray-950">{tbl}</span>
                            <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">{inv}</span>
                            <span className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.5 rounded">{tk}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate">
                            {formatISTDateTime(ord.timestamp)} • {ord.paymentMethod || 'CASH'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-black text-gray-950 font-mono block">
                            {currencySymbol}{ord.totalAmount}
                          </span>
                          <span className="text-[9.5px] font-bold text-emerald-600 uppercase">View Bill →</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        ) : viewInvoiceModal || (activeOrderObj.isPaid && billingTab === 'history') ? (
          
          /* VIEW INVOICE (IMAGE 4 DESIGN) */
          <div className="max-w-md mx-auto space-y-3 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-gray-150 print:hidden">
              <button
                type="button"
                onClick={() => { setSelectedOrderId(''); setViewInvoiceModal(false); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none"
              >
                <ArrowLeft size={13} />
                <span>Back to Occupied Tables</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="h-8 px-2.5 rounded-lg bg-white border border-gray-300 text-gray-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-gray-50 cursor-pointer"
                >
                  <Printer size={12} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="h-8 px-2.5 rounded-lg bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-neutral-800 cursor-pointer border-none"
                >
                  <Download size={12} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {brandedInvoiceData && (
              <BrandedInvoiceCard
                data={brandedInvoiceData}
                onPrint={handlePrintInvoice}
                onDownloadPDF={handleDownloadPDF}
                showActions={false}
              />
            )}
          </div>

        ) : (

          /* ============================================================== */
          /* VIEW 2: CASHIER BILLING RECEIPT (PIXEL-PERFECT MATCH TO IMAGE 2) */
          /* Centered properly on laptops, compact and responsive on mobile */
          /* ============================================================== */
          <div className="w-full max-w-xl mx-auto space-y-3 animate-fade-in">
            
            {/* Top Bar with Back Arrow and Sequential Number Tags */}
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => { setSelectedOrderId(''); setViewInvoiceModal(false); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer border-none"
              >
                <ArrowLeft size={14} />
                <span>Back to Occupied Tables</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                  {activeInvoiceNo}
                </span>
                <span className="text-[11px] font-mono font-bold text-white bg-black px-2.5 py-1 rounded-lg">
                  {activeTokenNo}
                </span>
              </div>
            </div>

            {/* MAIN WHITE RECEIPT CONTAINER (IMAGE 2 MOCKUP LAYOUT) */}
            <div className="bg-white border border-gray-200 rounded-3xl p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4 font-sans">
              
              {/* 1. RESTAURANT HEADER CARD (Image 2) */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#046c38] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ChefHat size={22} className="stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10.5px] sm:text-xs font-black text-[#046c38] uppercase tracking-wider block">
                    ORDERPOINT PRO
                  </span>
                  <h2 className="text-sm sm:text-base font-black text-gray-950 leading-tight truncate">
                    {settings?.restaurantInfo?.name || 'The Royal Feast'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-gray-400 font-medium leading-tight truncate mt-0.5">
                    {settings?.restaurantInfo?.address || '123 Royal Palace Avenue, India'}
                  </p>
                </div>
              </div>

              {/* 2. TWO-COLUMN METADATA GRID (Image 2) */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50/70 border border-gray-150 rounded-2xl text-xs">
                {/* Left Column */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[10.5px] font-medium text-gray-400 block">Customer</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">
                      {formattedCustomerLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-medium text-gray-400 block">Token No.</span>
                    <span className="font-black text-xs sm:text-sm text-gray-900 font-mono block">
                      {activeTokenNo}
                    </span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[10.5px] font-medium text-gray-400 block">Order Date &amp; Time</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">
                      {formatISTDateTime(activeOrderObj.timestamp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-medium text-gray-400 block">Payment Method</span>
                    <span className="font-black text-xs sm:text-sm text-gray-900 uppercase block">
                      {selectedMethod}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. ORDERED ITEMS SECTION (Image 2) */}
              <div className="overflow-hidden rounded-2xl border border-[#d1ebd7]">
                <div className="bg-[#eaf7ee] text-xs font-black text-gray-900 px-3.5 py-2">
                  Ordered Items
                </div>
                <div className="bg-white overflow-x-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/40">
                        <th className="py-2 px-2.5 sm:px-3 text-left">Item</th>
                        <th className="py-2 px-2 text-center w-10 sm:w-14">Qty</th>
                        <th className="py-2 px-2 text-right w-16 sm:w-20">Price</th>
                        <th className="py-2 px-2.5 sm:px-3 text-right w-18 sm:w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {calculatedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-2.5 sm:px-3">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-gray-100 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 font-black text-[10px]">
                                  {item.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-bold text-xs sm:text-sm text-gray-950 truncate max-w-[130px] sm:max-w-none">
                                {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-xs sm:text-sm text-gray-900 font-mono">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-2 text-right text-gray-600 font-mono text-xs">
                            {currencySymbol}{item.price.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-2.5 sm:px-3 text-right font-black text-gray-950 font-mono text-xs sm:text-sm">
                            {currencySymbol}{item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. BILL SUMMARY SECTION (Image 2) */}
              <div className="overflow-hidden rounded-2xl border border-[#d1ebd7]">
                <div className="bg-[#eaf7ee] text-xs font-black text-gray-900 px-3.5 py-2">
                  Bill Summary
                </div>
                <div className="p-3 sm:p-3.5 bg-white space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-gray-700 font-medium">
                    <span>Subtotal</span>
                    <span className="font-bold text-gray-950 font-mono">{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700 font-medium">
                    <span>Tax (GST {gstPercentage}%)</span>
                    <span className="font-bold text-gray-950 font-mono">{currencySymbol}{taxAmount.toFixed(2)}</span>
                  </div>

                  {/* TOTAL GREEN BANNER (Label is strictly "TOTAL") */}
                  <div className="bg-[#eaf7ee] border border-[#cbebd3] rounded-xl p-3 flex justify-between items-center mt-2.5">
                    <span className="text-base sm:text-lg font-black text-gray-950 tracking-tight">TOTAL</span>
                    <span className="text-xl sm:text-2xl font-black text-[#046c38] font-mono tracking-tight">
                      {currencySymbol}{totalAmountVal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. PAYMENT METHOD (Cash and Card only - UPI removed before billing) */}
              <div className="space-y-1.5 select-none pt-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cash */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('cash')}
                    className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'cash'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Banknote size={17} className="text-gray-700" />
                    <span>Cash</span>
                    {selectedMethod === 'cash' && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('card')}
                    className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'card'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={17} className="text-gray-700" />
                    <span>Card</span>
                    {selectedMethod === 'card' && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* 6. WHATSAPP MOBILE NUMBER (Word "Optional" removed!) */}
              <div className="space-y-1 select-none">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Send size={12} className="text-[#046c38]" />
                  <span>Customer WhatsApp Number</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full h-11 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:border-[#046c38]"
                    maxLength={10}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">
                  Upon finalizing payment, OrderPoint Pro automatically opens WhatsApp with the customer's PDF bill link.
                </p>
              </div>

              {/* 7. FINALIZE PAYMENT BUTTON */}
              <div className="pt-1">
                <button
                  type="button"
                  id="btn_confirm_billing"
                  disabled={isProcessing}
                  onClick={handleFinalizePayment}
                  className="w-full h-12 sm:h-13 bg-[#046c38] hover:bg-[#03542b] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm sm:text-base font-black tracking-wider uppercase shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer border-none flex items-center justify-center gap-2"
                >
                  <span>{isProcessing ? 'Finalizing Payment...' : 'Finalize Payment'}</span>
                </button>
              </div>

            </div>

          </div>

        )}

      </div>
    </PageLayout>
  );
}
