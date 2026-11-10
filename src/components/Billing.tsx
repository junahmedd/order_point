/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import PageLayout from './PageLayout';
import { 
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
  ShoppingBag
} from 'lucide-react';
import { Order, MenuItem } from '../types';
import { jsPDF } from 'jspdf';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { formatISTDateTime } from '../lib/dateUtils';
import { 
  getNextInvoiceNumber, 
  formatInvoiceNumberDisplay, 
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

// UPI Shape Icon
function UPIShapeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 4.5L10 12.5L13.5 12.5L9.5 19.5L16 10.5L12.5 10.5L14.5 4.5Z" fill="#F97316" />
      <path d="M7 16L11 8L9.5 8L6.5 14L7 16Z" fill="#10B981" />
    </svg>
  );
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
  
  // Selected order state - does not open receipt automatically until cashier clicks BILL NOW!
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Payment settlement state - supports UPI, Cash, and Card
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'cash' | 'card'>('upi');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<boolean>(false);

  // Orders that are ready for billing:
  // Kitchen clicks Complete -> status becomes 'Ready' / 'Completed' / 'Ready for Billing'
  // Or takeaway orders that are ready for cashier billing
  const readyOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.isPaid || o.status === 'Cancelled') return false;
      const isReadyInKitchen = o.status === 'Ready' || 
                               o.status === 'Completed' || 
                               o.kitchenStatus === 'Completed' || 
                               o.kitchenStatus === 'Prepared' || 
                               o.kitchenStatus === 'Served' || 
                               o.billingStatus === 'Ready for Billing';
      return isReadyInKitchen || o.type === 'Takeaway';
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [orders]);

  // Active Order Object for the receipt view
  const activeOrderObj = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [selectedOrderId, orders]);

  // Synchronize customer phone when active order is selected
  useEffect(() => {
    if (activeOrderObj) {
      setCustomerPhone(activeOrderObj.customerPhone || '');
      if (activeOrderObj.isPaid && activeOrderObj.paymentMethod) {
        const m = activeOrderObj.paymentMethod.toLowerCase();
        if (m === 'cash') setSelectedMethod('cash');
        else if (m === 'card') setSelectedMethod('card');
        else setSelectedMethod('upi');
      }
    }
  }, [activeOrderObj]);

  // Sequential Invoice Number
  const activeInvoiceNo = useMemo(() => {
    if (!activeOrderObj) return getNextInvoiceNumber(orders);
    if ((activeOrderObj as any).invoiceNumber) {
      return formatInvoiceNumberDisplay((activeOrderObj as any).invoiceNumber);
    }
    return getNextInvoiceNumber(orders);
  }, [activeOrderObj, orders]);

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
  // Total without discount
  const totalAmountVal = subtotal + taxAmount;

  // Branded Invoice Data for print/download
  const brandedInvoiceData: BrandedInvoiceData | null = useMemo(() => {
    if (!activeOrderObj) return null;
    return {
      invoiceNumber: activeInvoiceNo,
      tokenNumber: '',
      orderNumber: formatOrderNumberDisplay(activeOrderObj.orderNumber),
      restaurantName: settings?.restaurantInfo?.name || 'The Royal Feast',
      restaurantAddress: settings?.restaurantInfo?.address || '123 Royal Palace Avenue, India',
      reservationType: activeOrderObj.type === 'Takeaway' ? 'Takeaway' : 'Dine In',
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
  }, [activeOrderObj, activeInvoiceNo, settings, selectedMethod, calculatedItems, subtotal, taxAmount, gstPercentage, totalAmountVal]);

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
      doc.text(`INVOICE: ${brandedInvoiceData.invoiceNumber}`, 40, 22, { align: 'center' });
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

  // CONFIRM BILLING ACTION
  const handleConfirmBilling = async () => {
    if (!activeOrderObj) return;
    setIsProcessing(true);

    try {
      const restId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const assignedInvoiceNo = activeInvoiceNo;

      // 1. Mark Order as Paid and Completed in Firestore (Automatically releases table!)
      await onMarkOrderPaid(activeOrderObj.id, selectedMethod, {
        discount: 0,
        invoiceNo: assignedInvoiceNo,
        customerPhone: cleanPhone || activeOrderObj.customerPhone || '',
        customerName: activeOrderObj.type === 'Takeaway' ? 'Takeaway' : 'Dine In'
      });

      // 2. Generate Branded PDF Invoice Data URI using jsPDF
      let generatedPdfDataUri = '';
      try {
        const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(settings?.restaurantInfo?.name || 'The Royal Feast', 40, 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(settings?.restaurantInfo?.address || '123 Royal Palace Avenue, India', 40, 15, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.text(`INVOICE: ${assignedInvoiceNo}`, 40, 22, { align: 'center' });
        doc.line(5, 25, 75, 25);

        let y = 30;
        doc.setFontSize(8);
        calculatedItems.forEach(it => {
          doc.text(`${it.name} x${it.quantity}`, 5, y);
          doc.text(`Rs. ${it.amount.toFixed(2)}`, 75, y, { align: 'right' });
          y += 5;
        });

        doc.line(5, y, 75, y);
        y += 5;
        doc.text(`Subtotal:`, 5, y);
        doc.text(`Rs. ${subtotal.toFixed(2)}`, 75, y, { align: 'right' });
        y += 4;
        doc.text(`GST (${gstPercentage}%):`, 5, y);
        doc.text(`Rs. ${taxAmount.toFixed(2)}`, 75, y, { align: 'right' });
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`TOTAL:`, 5, y);
        doc.text(`Rs. ${totalAmountVal.toFixed(2)}`, 75, y, { align: 'right' });

        generatedPdfDataUri = doc.output('datauristring');
      } catch (pdfGenErr) {
        console.warn('PDF generation error in confirm payment:', pdfGenErr);
      }

      // 3. Persist Dedicated Sequential Invoice Record in Firestore
      try {
        const invoicePayload = {
          invoiceNumber: assignedInvoiceNo,
          invoiceNo: assignedInvoiceNo,
          orderNumber: formatOrderNumberDisplay(activeOrderObj.orderNumber),
          orderId: activeOrderObj.id,
          tableNo: activeOrderObj.tableNo || '',
          reservationType: activeOrderObj.type === 'Takeaway' ? 'Takeaway' : 'Dine In',
          type: activeOrderObj.type,
          customerPhone: cleanPhone,
          customerName: activeOrderObj.type === 'Takeaway' ? 'Takeaway' : 'Dine In',
          items: calculatedItems,
          subtotal,
          taxes: taxAmount,
          taxAmount,
          total: totalAmountVal,
          totalAmount: totalAmountVal,
          paymentMethod: selectedMethod.toUpperCase(),
          paymentStatus: 'Paid',
          isPaid: true,
          pdfDataUri: generatedPdfDataUri || null,
          timestamp: activeOrderObj.timestamp || Date.now(),
          paymentAt: Date.now()
        };

        const invoiceDocRef = doc(db, `restaurants/${restId}/invoices/${assignedInvoiceNo}`);
        await setDoc(invoiceDocRef, invoicePayload, { merge: true });

        const invoiceRecordRef = doc(db, `restaurants/${restId}/invoiceRecords/${assignedInvoiceNo}`);
        await setDoc(invoiceRecordRef, invoicePayload, { merge: true });
      } catch (invSaveErr) {
        console.warn('Could not write invoice subcollections:', invSaveErr);
      }

      // 4. Automatically Open WhatsApp with Customer's Mobile Number and PDF link
      const publicInvoiceLink = `${window.location.origin}/?invoice=${assignedInvoiceNo}&store=${restId}`;
      const whatsappMessage = `Hi! Thank you for dining with us. 😊\n\nYour invoice is ready. View or download your bill here:\n\n📄 "View Invoice PDF" (${publicInvoiceLink})\n\nThank you for choosing us! ❤️`;

      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(waUrl, '_blank');
      }

      onShowToast(`Payment confirmed • ${assignedInvoiceNo}`);

      // 5. Open Invoice Modal / View for instant Cashier confirmation
      setViewInvoiceModal(true);
    } catch (err: any) {
      console.error('Confirm payment error:', err);
      onShowToast('Error confirming payment. Please retry.');
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
      <div className="w-full font-sans select-none pt-0 pb-8">

        {/* ============================================================== */}
        {/* VIEW 1: ELIGIBLE BILLS LIST (When no order is selected) */}
        {/* ============================================================== */}
        {!activeOrderObj ? (
          <div className="max-w-2xl mx-auto space-y-3 animate-fade-in pt-1">
            
            {readyOrders.length === 0 ? (
              <div className="py-16 text-center bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 space-y-3 shadow-2xs">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle size={32} className="stroke-[2]" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-gray-950">
                  No pending bills. All caught up!
                </h3>
              </div>
            ) : (
              <div className="space-y-2.5 max-w-xl mx-auto">
                {readyOrders.map((ord) => {
                  const isTakeaway = ord.type === 'Takeaway' || !ord.tableNo;
                  let formattedTableName = 'Takeaway';
                  if (!isTakeaway) {
                    const match = ord.tableNo.match(/\d+/);
                    if (match) {
                      const num = parseInt(match[0], 10);
                      formattedTableName = `Table ${num < 10 ? '0' + num : num}`;
                    } else {
                      formattedTableName = ord.tableNo;
                    }
                  }

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
                        setViewInvoiceModal(false);
                      }}
                      className="w-full bg-white border border-gray-200 hover:border-[#046c38] rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all select-none cursor-pointer"
                    >
                      <span className="font-black text-sm text-gray-900 tracking-tight">
                        {formattedTableName}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(ord.id);
                          setViewInvoiceModal(false);
                        }}
                        className="h-8 px-4 bg-[#046c38] hover:bg-[#03542b] active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer border-none"
                      >
                        <span>BILL NOW</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        ) : viewInvoiceModal || activeOrderObj.isPaid ? (
          
          /* VIEW FINAL INVOICE (With Print & Download actions) */
          <div className="max-w-md mx-auto space-y-3 animate-fade-in pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-gray-150 print:hidden">
              <button
                type="button"
                onClick={() => { setSelectedOrderId(''); setViewInvoiceModal(false); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
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
          /* VIEW 2: CASHIER BILLING RECEIPT (PUSHED UPWARD, NO PILLS/TABS) */
          /* ============================================================== */
          <div className="w-full max-w-xl mx-auto animate-fade-in pt-0">
            
            {/* MAIN WHITE RECEIPT CONTAINER */}
            <div className="bg-white border border-gray-200 rounded-3xl p-3.5 sm:p-5 shadow-xs space-y-3.5 font-sans relative overflow-hidden">
              
              {/* 1. RESTAURANT HEADER CARD WITH SUBTLE BACK ARROW */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
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

                {/* Sleek back navigation icon */}
                <button
                  type="button"
                  onClick={() => { setSelectedOrderId(''); setViewInvoiceModal(false); }}
                  title="Back to pending bills"
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer border-none shrink-0"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>

              {/* 2. TWO-COLUMN METADATA GRID */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50/70 border border-gray-150 rounded-2xl text-xs">
                <div>
                  <span className="text-[10.5px] font-medium text-gray-400 block">Customer</span>
                  <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">
                    {activeOrderObj.type === 'Takeaway' ? 'Takeaway' : 'Dine In'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] font-medium text-gray-400 block">Order Date &amp; Time</span>
                  <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate">
                    {formatISTDateTime(activeOrderObj.timestamp)}
                  </span>
                </div>
              </div>

              {/* 3. ORDERED ITEMS SECTION */}
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

              {/* 4. BILL SUMMARY SECTION */}
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

                  {/* TOTAL GREEN BANNER */}
                  <div className="bg-[#eaf7ee] border border-[#cbebd3] rounded-xl p-3 flex justify-between items-center mt-2">
                    <span className="text-base sm:text-lg font-black text-gray-950 tracking-tight">TOTAL</span>
                    <span className="text-xl sm:text-2xl font-black text-[#046c38] font-mono tracking-tight">
                      {currencySymbol}{totalAmountVal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. PAYMENT METHOD: Cash, Card, and UPI */}
              <div className="space-y-1.5 select-none pt-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* UPI */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('upi')}
                    className={`h-11 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'upi'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <UPIShapeIcon />
                    <span>UPI</span>
                    {selectedMethod === 'upi' && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  {/* Cash */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('cash')}
                    className={`h-11 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'cash'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Banknote size={16} className="text-gray-700" />
                    <span>Cash</span>
                    {selectedMethod === 'cash' && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('card')}
                    className={`h-11 rounded-xl border-2 flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'card'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={16} className="text-gray-700" />
                    <span>Card</span>
                    {selectedMethod === 'card' && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={8} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* 6. WHATSAPP MOBILE NUMBER (NO "Optional") */}
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
                  Upon confirmation, OrderPoint Pro automatically opens WhatsApp with the customer's PDF bill link.
                </p>
              </div>

              {/* 7. CONFIRM PAYMENT BUTTON */}
              <div className="pt-1">
                <button
                  type="button"
                  id="btn_confirm_billing"
                  disabled={isProcessing}
                  onClick={handleConfirmBilling}
                  className="w-full h-12 sm:h-13 bg-[#046c38] hover:bg-[#03542b] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-sm sm:text-base font-black tracking-wider uppercase shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer border-none flex items-center justify-center gap-2"
                >
                  <span>{isProcessing ? 'Confirming...' : 'Confirm Payment'}</span>
                </button>
              </div>

            </div>

          </div>

        )}

      </div>
    </PageLayout>
  );
}
