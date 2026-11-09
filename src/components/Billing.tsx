/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import PageLayout from './PageLayout';
import { 
  Receipt, 
  Search, 
  CheckCircle, 
  Printer, 
  CreditCard, 
  Download, 
  ArrowLeft, 
  User, 
  Calendar,
  Trash2,
  Check,
  Banknote,
  Send,
  Armchair
} from 'lucide-react';
import { Order, MenuItem } from '../types';
import { jsPDF } from 'jspdf';
import { db, auth } from '../firebase';
import { updateDoc, doc, setDoc } from 'firebase/firestore';
import { formatISTDateTime } from '../lib/dateUtils';
import { 
  getNextInvoiceNumber, 
  formatInvoiceNumberDisplay, 
  formatTokenDisplay, 
  formatOrderNumberDisplay 
} from '../lib/orderSeriesUtils';
import BrandedInvoiceCard, { BrandedInvoiceData, OrderPointCubeLogo } from './BrandedInvoiceCard';

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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  
  // Navigation & Selection state
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [billingTab, setBillingTab] = useState<'pending' | 'history'>('pending');
  
  // Payment settlement state
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'cash' | 'card'>('upi');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<boolean>(false);

  // Filtered lists
  const unpaidOrders = useMemo(() => {
    let result = orders.filter(o => !o.isPaid && o.status !== 'Cancelled');
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        (o.customerPhone && o.customerPhone.includes(q)) ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.tableNo && o.tableNo.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
  }, [orders, searchQuery]);

  const paidOrders = useMemo(() => {
    let result = orders.filter(o => o.isPaid);
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        (o.customerPhone && o.customerPhone.includes(q)) ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.tableNo && o.tableNo.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        ((o as any).invoiceNumber && (o as any).invoiceNumber.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
  }, [orders, searchQuery]);

  // Active Order Object
  const activeOrderObj = useMemo(() => {
    if (billingTab === 'history') {
      if (paidOrders.length === 0) return null;
      if (!selectedOrderId) return paidOrders[0];
      return paidOrders.find(o => o.id === selectedOrderId) || paidOrders[0];
    } else {
      if (unpaidOrders.length === 0) return null;
      if (!selectedOrderId) return unpaidOrders[0];
      return unpaidOrders.find(o => o.id === selectedOrderId) || unpaidOrders[0];
    }
  }, [billingTab, paidOrders, unpaidOrders, selectedOrderId]);

  // Keep phone number synchronized with active order
  useEffect(() => {
    if (activeOrderObj) {
      setCustomerPhone(activeOrderObj.customerPhone || '');
      setDiscountAmount((activeOrderObj as any).discount || 0);
      if (activeOrderObj.isPaid) {
        const method = (activeOrderObj.paymentMethod || 'upi').toLowerCase();
        if (method === 'cash') setSelectedMethod('cash');
        else if (method === 'card') setSelectedMethod('card');
        else setSelectedMethod('upi');
      }
    }
  }, [activeOrderObj]);

  // Derived Sequential Series Numbers
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

  // Itemized Calculations
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
  const totalPayable = Math.max(0, subtotal + taxAmount - discountAmount);

  // Formatted Reservation & Table Labels (Matching Image 3 & Image 4)
  const formattedTable = useMemo(() => {
    if (!activeOrderObj?.tableNo) return 'T-01';
    const clean = activeOrderObj.tableNo.trim();
    if (/^table\s*\d+/i.test(clean)) {
      return clean.replace(/^table\s*/i, 'T-');
    }
    if (/^\d+$/.test(clean)) {
      return `T-${clean.padStart(2, '0')}`;
    }
    return clean;
  }, [activeOrderObj]);

  const formattedReservation = useMemo(() => {
    if (!activeOrderObj) return 'Dine In';
    return activeOrderObj.type === 'Takeaway' ? 'Takeaway' : 'Dine In';
  }, [activeOrderObj]);

  // Construct Branded Invoice Data
  const brandedInvoiceData: BrandedInvoiceData | null = useMemo(() => {
    if (!activeOrderObj) return null;
    return {
      invoiceNumber: activeInvoiceNo,
      tokenNumber: activeTokenNo,
      orderNumber: formatOrderNumberDisplay(activeOrderObj.orderNumber),
      restaurantName: settings?.restaurantInfo?.name || 'The Royal Feast',
      restaurantAddress: settings?.restaurantInfo?.address || '123 Royal Palace Avenue, India',
      reservationType: formattedReservation,
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
      totalPaid: totalPayable,
      paymentStatus: activeOrderObj.isPaid ? 'Payment Successful' : 'Payment Successful',
      paidAt: (activeOrderObj as any).paymentAt || Date.now()
    };
  }, [activeOrderObj, activeInvoiceNo, activeTokenNo, settings, formattedReservation, selectedMethod, calculatedItems, subtotal, taxAmount, gstPercentage, totalPayable]);

  // Generate PDF Helper
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
      doc.text(`TOTAL PAID:`, 5, y);
      doc.text(`Rs. ${brandedInvoiceData.totalPaid.toFixed(2)}`, 75, y, { align: 'right' });

      doc.save(`Invoice_${brandedInvoiceData.invoiceNumber}.pdf`);
      onShowToast('Invoice PDF downloaded!');
    } catch (e) {
      console.error(e);
      onShowToast('Could not compile PDF.');
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  // CONFIRM BILLING ACTION (Exact flow requested by user)
  const handleConfirmBilling = async () => {
    if (!activeOrderObj) return;
    setIsProcessing(true);

    try {
      const restId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const cleanPhone = customerPhone.replace(/\D/g, '');
      const assignedInvoiceNo = activeInvoiceNo;
      const assignedTokenNo = activeTokenNo;

      // 1. Mark Order as Paid in Firestore
      await onMarkOrderPaid(activeOrderObj.id, selectedMethod, {
        discount: discountAmount,
        invoiceNo: assignedInvoiceNo,
        customerPhone: cleanPhone || activeOrderObj.customerPhone || '',
        customerName: activeOrderObj.customerName || (activeOrderObj.tableNo ? `Dine-In (${activeOrderObj.tableNo})` : 'Guest')
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
          reservationType: formattedReservation,
          type: activeOrderObj.type,
          customerPhone: cleanPhone,
          customerName: activeOrderObj.customerName || 'Guest',
          items: calculatedItems,
          subtotal,
          taxes: taxAmount,
          taxAmount,
          total: totalPayable,
          totalAmount: totalPayable,
          paymentMethod: selectedMethod.toUpperCase(),
          paymentStatus: 'Paid',
          isPaid: true,
          timestamp: activeOrderObj.timestamp || Date.now(),
          paymentAt: Date.now()
        }, { merge: true });
      } catch (invSaveErr) {
        console.warn('Could not write invoice subcollection:', invSaveErr);
      }

      // 3. Automatically Open WhatsApp with Registered Phone Number
      const publicInvoiceLink = `${window.location.origin}/?invoice=${assignedInvoiceNo}&store=${restId}`;
      
      const whatsappMessage = `Hi! Thank you for dining with us. 😊\n\nYour invoice is ready. View or download your bill here:\n\n📄 "View Invoice PDF" (${publicInvoiceLink})\n\nThank you for choosing us! ❤️`;

      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(waUrl, '_blank');
        onShowToast(`Billing Confirmed! WhatsApp bill sent to ${cleanPhone}.`);
      } else {
        onShowToast('Billing Confirmed successfully!');
      }

      // 4. Open Invoice Modal / View for instant Cashier confirmation
      setViewInvoiceModal(true);
    } catch (err: any) {
      console.error('Confirm billing error:', err);
      onShowToast('Error processing billing. Please try again.');
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
    >
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full min-h-[calc(100vh-140px)]">
        
        {/* LEFT COLUMN: Queue of Orders (Pending / Paid History) */}
        <div className={`w-full lg:w-[320px] xl:w-[350px] bg-white border border-gray-150 rounded-2xl p-3.5 shadow-2xs space-y-3 shrink-0 ${selectedOrderId && !viewInvoiceModal ? 'hidden lg:block' : 'block'}`}>
          
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Table, Token, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-600 placeholder:text-gray-400"
            />
          </div>

          {/* Sub-Tabs: Pending vs Paid History */}
          <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 text-center text-xs font-bold select-none">
            <button
              type="button"
              onClick={() => { setBillingTab('pending'); setSelectedOrderId(''); }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                billingTab === 'pending'
                  ? 'bg-white text-gray-950 shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              Pending ({unpaidOrders.length})
            </button>
            <button
              type="button"
              onClick={() => { setBillingTab('history'); setSelectedOrderId(''); }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                billingTab === 'history'
                  ? 'bg-white text-gray-950 shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              Paid ({paidOrders.length})
            </button>
          </div>

          {/* Orders Queue Cards */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5 font-sans">
            {billingTab === 'pending' ? (
              unpaidOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <CheckCircle size={32} className="mx-auto text-emerald-500 stroke-[1.5]" />
                  <p className="text-xs font-bold text-gray-700">All Bills Settled!</p>
                  <p className="text-[11px] text-gray-400">New orders from POS/waiters appear here instantly.</p>
                </div>
              ) : (
                unpaidOrders.map((ord, idx) => {
                  const isSelected = activeOrderObj?.id === ord.id;
                  const tkDisp = formatTokenDisplay((ord as any).orderToken || ord.orderNumber, idx + 1);
                  const invDisp = formatInvoiceNumberDisplay((ord as any).invoiceNumber, ord.orderNumber, idx + 1);
                  const tblText = ord.tableNo ? (ord.tableNo.toLowerCase().startsWith('table') ? ord.tableNo : `Table ${ord.tableNo}`) : ord.type;

                  return (
                    <div
                      key={ord.id}
                      onClick={() => { setSelectedOrderId(ord.id); setViewInvoiceModal(false); }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none space-y-1.5 ${
                        isSelected
                          ? 'border-[#046c38] bg-emerald-50/40 ring-1 ring-[#046c38]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-gray-950">{tblText}</span>
                        <span className="text-xs font-black text-emerald-700 font-mono">
                          {currencySymbol}{ord.totalAmount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md font-bold">{invDisp}</span>
                        <span className="bg-black text-white px-2 py-0.5 rounded-md font-bold">{tkDisp}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {ord.items.map(i => `${i.quantity}× ${i.productName || i.menuItem?.name}`).join(', ')}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              paidOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <Receipt size={32} className="mx-auto text-gray-300 stroke-[1.5]" />
                  <p className="text-xs font-bold text-gray-700">No Paid Invoices Yet</p>
                </div>
              ) : (
                paidOrders.map((ord, idx) => {
                  const isSelected = activeOrderObj?.id === ord.id;
                  const tkDisp = formatTokenDisplay((ord as any).orderToken || ord.orderNumber, idx + 1);
                  const invDisp = formatInvoiceNumberDisplay((ord as any).invoiceNumber, ord.orderNumber, idx + 1);
                  const tblText = ord.tableNo ? (ord.tableNo.toLowerCase().startsWith('table') ? ord.tableNo : `Table ${ord.tableNo}`) : ord.type;

                  return (
                    <div
                      key={ord.id}
                      onClick={() => { setSelectedOrderId(ord.id); setViewInvoiceModal(true); }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none space-y-1.5 ${
                        isSelected
                          ? 'border-[#046c38] bg-emerald-50/40 ring-1 ring-[#046c38]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-gray-950">{tblText}</span>
                        <span className="text-xs font-black text-emerald-700 font-mono">
                          {currencySymbol}{ord.totalAmount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">{invDisp}</span>
                        <span className="bg-black text-white px-2 py-0.5 rounded-md font-bold">{tkDisp}</span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MAIN WORKSTATION */}
        <div className={`flex-1 w-full bg-white border border-gray-150 rounded-2xl p-4 sm:p-6 shadow-2xs font-sans ${!selectedOrderId && !activeOrderObj ? 'hidden lg:flex flex-col items-center justify-center py-20 text-center text-gray-400' : 'block'}`}>
          
          {!activeOrderObj ? (
            <div className="py-20 text-center space-y-3">
              <Receipt size={40} className="mx-auto text-gray-300 stroke-[1.5]" />
              <h3 className="text-base font-black text-gray-900">Select an Order to Bill</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Click on any active table or takeaway ticket from the queue on the left to review items and settle.
              </p>
            </div>
          ) : viewInvoiceModal || (activeOrderObj.isPaid && billingTab === 'history') ? (
            
            /* VIEW INVOICE (IMAGE 4 DESIGN) */
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-gray-150 print:hidden">
                <button
                  type="button"
                  onClick={() => setViewInvoiceModal(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Billing</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintInvoice}
                    className="h-8 px-3 rounded-lg bg-white border border-gray-300 text-gray-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="h-8 px-3 rounded-lg bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-neutral-800 cursor-pointer border-none"
                  >
                    <Download size={13} />
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

            /* NEW BILL WORKSTATION (IMAGE 3 DESIGN - EXACT MATCH) */
            <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
              
              {/* Header Title with Mobile Back Button */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId('')}
                    className="lg:hidden p-1.5 rounded-lg bg-gray-100 text-gray-700 border-none cursor-pointer"
                    title="Back to queue"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-gray-950 tracking-tight leading-none">New Bill</h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                    {activeInvoiceNo}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-white bg-black px-2.5 py-1 rounded-lg">
                    {activeTokenNo}
                  </span>
                </div>
              </div>

              {/* 3 Top Summary Info Cards (Table No, Reservation, Date & Time) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Table No. */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">Table No.</label>
                  <div className="h-11 px-3.5 bg-white border border-gray-250 rounded-xl flex items-center gap-2 text-xs font-bold text-gray-900 shadow-2xs">
                    <Armchair size={15} className="text-gray-500" />
                    <span>{formattedTable}</span>
                  </div>
                </div>

                {/* Reservation (Dine In or Takeaway) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">Reservation</label>
                  <div className="h-11 px-3.5 bg-white border border-gray-250 rounded-xl flex items-center gap-2 text-xs font-bold text-gray-900 shadow-2xs">
                    <User size={15} className="text-gray-500" />
                    <span>{formattedReservation}</span>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">Date &amp; Time</label>
                  <div className="h-11 px-3.5 bg-white border border-gray-250 rounded-xl flex items-center gap-2 text-[11px] font-bold text-gray-900 shadow-2xs">
                    <Calendar size={15} className="text-gray-500 shrink-0" />
                    <span className="truncate">{formatISTDateTime(activeOrderObj.timestamp)}</span>
                  </div>
                </div>

              </div>

              {/* Ordered Items Section */}
              <div className="space-y-0 overflow-hidden rounded-xl border border-[#d1ebd7]">
                <div className="bg-[#eaf7ee] text-xs font-black text-gray-900 px-4 py-2.5">
                  Ordered Items
                </div>
                <div className="bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/40">
                        <th className="py-2.5 px-4 text-left">Item</th>
                        <th className="py-2.5 px-4 text-center w-16">Qty</th>
                        <th className="py-2.5 px-4 text-right w-24">Price</th>
                        <th className="py-2.5 px-4 text-right w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {calculatedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-11 h-11 rounded-lg object-cover border border-gray-100 shrink-0"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 font-black text-xs">
                                  {item.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-bold text-sm text-gray-950">{item.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {/* In Qty just keep the clean number 2; removed - and + symbols as requested */}
                            <span className="inline-block px-3 py-1 rounded-lg bg-gray-50 border border-gray-200 font-bold text-xs text-gray-900 font-mono">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700 font-mono font-medium">
                            {currencySymbol}{item.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-gray-950 font-mono text-sm">
                            {currencySymbol}{item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill Summary Section */}
              <div className="space-y-0 overflow-hidden rounded-xl border border-[#d1ebd7]">
                <div className="bg-[#eaf7ee] text-xs font-black text-gray-900 px-4 py-2.5">
                  Bill Summary
                </div>
                <div className="p-4 bg-white space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-700 font-medium">
                    <span>Subtotal</span>
                    <span className="font-bold text-gray-950 font-mono">{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700 font-medium">
                    <span>Tax (GST {gstPercentage}%)</span>
                    <span className="font-bold text-gray-950 font-mono">{currencySymbol}{taxAmount.toFixed(2)}</span>
                  </div>

                  {/* Total Payable Green Banner */}
                  <div className="bg-[#eaf7ee] border border-[#cbebd3] rounded-xl p-3.5 flex justify-between items-center mt-3">
                    <span className="text-base font-black text-gray-950 tracking-tight">Total Payable</span>
                    <span className="text-2xl font-black text-[#046c38] font-mono tracking-tight">
                      {currencySymbol}{totalPayable.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 select-none">
                <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  
                  {/* UPI */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('upi')}
                    className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'upi'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <UPIShapeIcon />
                    <span>UPI</span>
                    {selectedMethod === 'upi' && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  {/* Cash */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('cash')}
                    className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'cash'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Banknote size={18} className="text-gray-700" />
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
                    className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer relative ${
                      selectedMethod === 'card'
                        ? 'border-[#046c38] bg-white text-gray-950 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={18} className="text-gray-700" />
                    <span>Card</span>
                    {selectedMethod === 'card' && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#046c38] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                </div>
              </div>

              {/* Customer Mobile for WhatsApp Invoice Redirect */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Send size={12} className="text-emerald-600" />
                  <span>Customer WhatsApp Number (Optional)</span>
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
                  Upon confirming payment, OrderPoint Pro automatically launches WhatsApp with the customer's PDF bill link.
                </p>
              </div>

              {/* Large Green Confirm Billing Button */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn_confirm_billing"
                  disabled={isProcessing}
                  onClick={handleConfirmBilling}
                  className="w-full h-13 bg-[#046c38] hover:bg-[#03542b] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-base font-black tracking-wider uppercase shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer border-none flex items-center justify-center gap-2"
                >
                  <span>{isProcessing ? 'Processing Bill...' : 'Confirm Billing'}</span>
                </button>
              </div>

            </div>

          )}

        </div>

      </div>
    </PageLayout>
  );
}
