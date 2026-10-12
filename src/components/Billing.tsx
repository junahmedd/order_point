/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import PageLayout from './PageLayout';
import { 
  Receipt, 
  Search, 
  Phone, 
  Send, 
  Coins, 
  Smartphone, 
  CheckCircle, 
  Ticket, 
  Scale, 
  MessageSquare, 
  AlertCircle, 
  Printer, 
  CreditCard, 
  Download, 
  Building2, 
  FileSpreadsheet, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  User,
  Coffee,
  X,
  BadgeAlert,
  Utensils,
  Star
} from 'lucide-react';
import { Order, MenuItem } from '../types';
import CustomerFeedbackPage from './CustomerFeedbackPage';
import { jsPDF } from 'jspdf';
import { db, auth } from '../firebase';
import { getGmailAccessToken, authorizeGmailService, sendEmailViaGmail } from '../lib/gmailService';
import { updateDoc, doc } from 'firebase/firestore';

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

export default function Billing({ orders, menuItems, onMarkOrderPaid, onSendWhatsAppBill, onShowToast, settings, onNavigateToTab }: BillingProps) {
  const currencySymbol = settings?.prefCurrency || '₹';
  const gstPercentage = settings?.gstPercentage !== undefined ? settings.gstPercentage : 5;
  const taxEnabled = settings?.taxEnabled !== undefined ? settings.taxEnabled : true;
  const gstRate = taxEnabled ? (gstPercentage / 100) : 0;
  
  // Master state management
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'oldest' | 'highest'>('oldest');
  
  // Settle inputs
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [billingTab, setBillingTab] = useState<'pending' | 'history'>('pending');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0); // flat adjustment discount
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  // Simulation indicators
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [isBillPrinted, setIsBillPrinted] = useState(false);
  const [customBypassCompliance, setCustomBypassCompliance] = useState(true);
  const [lastPaidOrderObj, setLastPaidOrderObj] = useState<any | null>(null);
  const [successWhatsAppPhone, setSuccessWhatsAppPhone] = useState('');
  const [showFeedbackPreview, setShowFeedbackPreview] = useState<{ invoiceNo: string, restaurantId: string } | null>(null);

  // Success Checkout Screen state (holding the information of the last paid receipt for our receipt popup)
  const [paymentSuccessOrder, setPaymentSuccessOrder] = useState<{
    orderNumber: string;
    invoiceNumber: string;
    tableNo?: string;
    type: string;
    totalAmount: number;
    discountAmount: number;
    finalPaid: number;
    paymentMethod: string;
    itemsCount: number;
    receivedAmount?: string;
    changeToReturn?: number;
    customerPhone?: string;
    customerName?: string;
  } | null>(null);

  // Derived KPIs for header right section
  const paidOrdersAll = useMemo(() => orders.filter(o => o.isPaid), [orders]);
  const completedPaymentsCount = paidOrdersAll.length;
  const todaysRevenue = useMemo(() => paidOrdersAll.reduce((sum, o) => sum + o.totalAmount, 0), [paidOrdersAll]);

  // Process paid orders with search query and sorting
  const paidOrders = useMemo(() => {
    let result = orders.filter(o => o.isPaid);

    // Filter by table or order search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(query) ||
        (o.tableNo && o.tableNo.toLowerCase().includes(query)) ||
        o.type.toLowerCase().includes(query) ||
        ((o as any).invoiceNumber && (o as any).invoiceNumber.toLowerCase().includes(query))
      );
    }

    // Apply sorting rules: oldest first or highest first
    if (sortBy === 'oldest') {
      result.sort((a, b) => b.timestamp - a.timestamp); // For history tab, newest on top is best
    } else {
      result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    return result;
  }, [orders, searchQuery, sortBy]);

  // Extract all currently unpaid orders (pending settlements in the queue)
  const unpaidOrders = useMemo(() => {
    let result = orders.filter(o => !o.isPaid && o.status !== 'Cancelled');

    // Filter by table or order search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(query) ||
        (o.tableNo && o.tableNo.toLowerCase().includes(query)) ||
        o.type.toLowerCase().includes(query)
      );
    }

    // Apply strict requested sorting rules: "Oldest First" vs "Highest Amount First"
    if (sortBy === 'oldest') {
      result.sort((a, b) => a.timestamp - b.timestamp); // Ascending order times
    } else {
      result.sort((a, b) => b.totalAmount - a.totalAmount); // Descending total sum
    }

    return result;
  }, [orders, searchQuery, sortBy]);

  // Read active order record from either pending or completed invoices
  const activeOrderObj = useMemo(() => {
    if (billingTab === 'history') {
      if (paidOrders.length === 0) return null;
      if (!selectedOrderId) return paidOrders[0];
      const found = paidOrders.find(o => o.id === selectedOrderId);
      return found || paidOrders[0];
    } else {
      if (unpaidOrders.length === 0) return null;
      if (!selectedOrderId) return unpaidOrders[0];
      const found = unpaidOrders.find(o => o.id === selectedOrderId);
      return found || unpaidOrders[0];
    }
  }, [unpaidOrders, paidOrders, selectedOrderId, billingTab]);

  // Generate a unique invoice number for the selected active order dynamically
  const activeInvoiceNo = useMemo(() => {
    if (!activeOrderObj) return '';
    if ((activeOrderObj as any).invoiceNumber) return (activeOrderObj as any).invoiceNumber;
    // Deterministic short hash to guarantee 100% uniqueness per order
    let hash = 0;
    for (let i = 0; i < activeOrderObj.id.length; i++) {
      hash = (hash * 31 + activeOrderObj.id.charCodeAt(i)) & 0xffff;
    }
    const suffix = (hash % 1000).toString().padStart(3, '0');
    return `INV-${activeOrderObj.orderNumber}-${suffix}`;
  }, [activeOrderObj]);

  const currentTotal = activeOrderObj ? activeOrderObj.totalAmount : 0;
  const currentSubtotal = activeOrderObj ? Math.round(currentTotal / (1 + gstRate)) : 0;
  const currentGst = currentTotal - currentSubtotal;
  const grandSettleTotal = Math.max(0, currentTotal - discountAmount);

  // Unified Print Details supporting active or last paid tickets
  const printDetails = useMemo(() => {
    const o = activeOrderObj || lastPaidOrderObj;
    if (!o) return null;
    
    const invoiceNo = (o as any).invoiceNumber || (() => {
      let hash = 0;
      for (let i = 0; i < o.id.length; i++) {
        hash = (hash * 31 + o.id.charCodeAt(i)) & 0xffff;
      }
      const suffix = (hash % 1000).toString().padStart(3, '0');
      return `INV-${o.orderNumber}-${suffix}`;
    })();

    const total = o.totalAmount;
    const subtotal = Math.round(total / (1 + gstRate));
    const gst = total - subtotal;
    const finalTotal = Math.max(0, total - discountAmount);

    return {
      order: o,
      invoiceNo,
      subtotal,
      gst,
      finalTotal
    };
  }, [activeOrderObj, lastPaidOrderObj, gstRate, discountAmount]);

  // Sync phone, name, email fields when selected order shifts
  useEffect(() => {
    if (activeOrderObj) {
      setCustomerPhone(activeOrderObj.customerPhone || '');
      setCustomerName((activeOrderObj as any).customerName || '');
      setCustomerEmail((activeOrderObj as any).customerEmail || '');
      setReceivedAmount('');
      setDiscountAmount((activeOrderObj as any).discount || 0);
      setIsBillPrinted(false);
      setCustomBypassCompliance(false);
      
      const method = activeOrderObj.paymentMethod?.toLowerCase();
      if (method === 'cash' || method === 'upi' || method === 'card') {
        setSelectedMethod(method as 'cash' | 'upi' | 'card');
      } else {
        setSelectedMethod('cash');
      }
    } else {
      setCustomerPhone('');
      setCustomerName('');
      setCustomerEmail('');
      setReceivedAmount('');
      setDiscountAmount(0);
      setIsBillPrinted(false);
      setCustomBypassCompliance(false);
      setSelectedMethod('cash');
    }
  }, [activeOrderObj?.id, activeOrderObj?.isPaid]);

  // Helper: Format raw timestamp into AM/PM string, e.g. "8:42 PM"
  const getFormattedTime = (timestamp: number) => {
    const d = new Date(timestamp);
    let hrs = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, '0');
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12; 
    return `${hrs}:${mins} ${ampm}`;
  };

  // WhatsApp workflow trigger
  const handleSendWhatsAppBillLocal = async () => {
    if (!activeOrderObj) return;
    
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      onShowToast('Please type a valid 10-digit WhatsApp mobile number!');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const isPaid = activeOrderObj.isPaid || false;
      const message = getWhatsAppMessageText(activeOrderObj, activeInvoiceNo, isPaid);
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      
      // Update order status in live database
      const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      await updateDoc(doc(db, `restaurants/${userId}/orders`, activeOrderObj.id), { billSentToWhatsApp: true });

      // Open in a new window/tab
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      setSendingWhatsApp(false);
      onShowToast(`Invoice shared via WhatsApp to +${formattedPhone} successfully!`);
    } catch (e) {
      console.error(e);
      setSendingWhatsApp(false);
      onShowToast('Error sending invoice on WhatsApp.');
    }
  };

  const handleShareWhatsAppFromSuccess = async () => {
    if (!paymentSuccessOrder || !lastPaidOrderObj) return;

    const cleanPhone = successWhatsAppPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      onShowToast('Please enter a valid 10-digit WhatsApp mobile number!');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const message = getWhatsAppMessageText(lastPaidOrderObj, paymentSuccessOrder.invoiceNumber, true);
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      
      // Update order status in live database
      const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      await updateDoc(doc(db, `restaurants/${userId}/orders`, lastPaidOrderObj.id), { billSentToWhatsApp: true });

      // Open in a new window/tab
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');

      // Update success overlay state phone
      setPaymentSuccessOrder(prev => prev ? { ...prev, customerPhone: cleanPhone } : null);

      setSendingWhatsApp(false);
      onShowToast(`Invoice shared via WhatsApp to +${formattedPhone} successfully!`);
    } catch (e) {
      console.error(e);
      setSendingWhatsApp(false);
      onShowToast('Error sending invoice on WhatsApp.');
    }
  };

  const getPublicFeedbackLink = (invoiceNo: string, restaurantId: string) => {
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return `${origin}/?feedback=${invoiceNo}&store=${restaurantId}`;
  };

  const getWhatsAppMessageText = (o: Order, invoiceNo: string, isPaid: boolean) => {
    const restName = settings?.restaurantInfo?.name || 'OrderPoint Bistro';
    const token = o.orderNumber.replace(/\D/g, '') || o.orderNumber;
    const finalTotal = Math.max(0, o.totalAmount - discountAmount);
    const method = (o.paymentMethod || selectedMethod || 'CASH').toUpperCase();
    const status = isPaid ? 'PAID' : 'PENDING';

    const restaurantId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    const feedbackLink = getPublicFeedbackLink(invoiceNo, restaurantId);
    const invoiceLink = `${window.location.origin}/?invoice=inv_${o.id}&store=${restaurantId}`;

    let statusLine = '';
    if (method === 'UPI') {
      statusLine = 'Your order has been sent to the kitchen.';
    } else {
      statusLine = isPaid ? 'Your payment has been received successfully.' : 'Your order is confirmed, payment is pending at the counter.';
    }

    return `Thank you for ordering from
*${restName}*

Order: #${o.orderNumber}
Token: ${token}

Amount Paid: ₹${finalTotal.toFixed(2)}
Payment Method: ${method}
Payment Status: ${status}

${statusLine}

⭐ Rate your experience:
${feedbackLink}

📄 Digital Invoice:
${invoiceLink}

Thank you!`;
  };

  const getWhatsAppFeedbackText = (o: Order, invoiceNo: string) => {
    const custName = customerName || (o as any).customerName || 'Customer';
    const restName = settings?.restaurantInfo?.name || 'The Royal Feast';
    const restaurantId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    const link = getPublicFeedbackLink(invoiceNo, restaurantId);
    
    return `🍽️ *Thank You for Dining with ${restName}!*

Hi ${custName}, thank you for visiting us today.

We hope you enjoyed your meal! Your opinion means a lot to us and helps us improve our food and service.

⭐ *Please take a few seconds to rate your experience:*

👉 ${link}

Thank you for choosing ${restName}. We look forward to serving you again!`;
  };

  const generatePDFForOrder = (
    order: Order, 
    invoiceNo: string, 
    shouldDownload = true,
    customNameVal?: string,
    customPhoneVal?: string,
    customEmailVal?: string
  ): string => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const startX = 20;
    let currentY = 20;

    // Retrieve restaurant profile details from settings
    const restName = settings?.restaurantInfo?.name || 'THE ROYAL FEAST';
    const restAddress = settings?.restaurantInfo?.address || '123 Gourmet Boulevard, Foodie Haven';
    const restPhone = settings?.restaurantInfo?.phone || '+91 98765 43210';
    const restEmail = settings?.restaurantInfo?.email || 'contact@royalfeast.com';
    const restWebsite = settings?.restaurantInfo?.website || 'www.royalfeast.com';
    const gstNumberVal = settings?.gstTax?.taxEnabled && settings?.gstTax?.gstNumber ? settings.gstTax.gstNumber : '';

    // 1. Brand Header with elegant Vector Logo Badge
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.roundedRect(startX, currentY, 14, 14, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    // Render short initial badge letters
    const badgeLetters = restName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || 'RF';
    doc.text(badgeLetters, startX + 7, currentY + 9, { align: 'center' });
    
    // Restaurant brand name & tagline
    doc.setTextColor(17, 24, 39); // Deep Slate Gray/Black
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(restName.toUpperCase(), startX + 18, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128); // Muted gray
    doc.text(restAddress, startX + 18, currentY + 9.5);
    doc.text(`Phone: ${restPhone}  |  Email: ${restEmail}`, startX + 18, currentY + 13);
    
    if (gstNumberVal) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(52, 211, 153); // Emerald accent
      doc.text(`GSTIN: ${gstNumberVal}`, 190, currentY + 5, { align: 'right' });
    }
    
    currentY += 22;

    // 2. Main Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text('TAX INVOICE', startX, currentY);
    currentY += 5;

    // Subtle divider
    doc.setDrawColor(243, 244, 246);
    doc.setLineWidth(0.4);
    doc.line(startX, currentY, 190, currentY);
    currentY += 6;

    // Metadata columns in strict tabular spacing
    const dateStr = new Date(order.timestamp).toLocaleString();
    const tableStr = order.tableNo 
      ? (order.tableNo.trim().toLowerCase().startsWith('table') ? order.tableNo.trim() : `Table ${order.tableNo.trim()}`) 
      : order.type;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);

    const paymentMethodLabel = order.paymentMethod || selectedMethod || 'Cash';

    doc.text(`Invoice No: ${invoiceNo}`, startX, currentY);
    doc.text(`Date & Time: ${dateStr}`, startX, currentY + 5.5);
    doc.text(`Payment Status: SUCCESSFUL`, startX, currentY + 11);

    doc.text(`Order Ref: OP-${order.orderNumber}`, startX + 90, currentY);
    doc.text(`Table/Type: ${tableStr}`, startX + 90, currentY + 5.5);
    doc.text(`Payment Method: ${paymentMethodLabel}`, startX + 90, currentY + 11);
    currentY += 18;

    // 3. Customer Information Section Card
    const finalCustName = (customNameVal !== undefined ? customNameVal : customerName).trim() || order.customerName || '';
    const finalCustPhone = (customPhoneVal !== undefined ? customPhoneVal : customerPhone).trim() || order.customerPhone || '';
    const finalCustEmail = (customEmailVal !== undefined ? customEmailVal : customerEmail).trim() || (order as any).customerEmail || '';

    const hasCustomerDetails = finalCustName || finalCustPhone;

    doc.setFillColor(249, 250, 251); // Gray 50
    doc.setDrawColor(229, 231, 235); // Gray 200
    doc.roundedRect(startX, currentY, 170, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text('CUSTOMER INFORMATION', startX + 5, currentY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);

    if (hasCustomerDetails) {
      doc.text(`Name: ${finalCustName || 'Guest Customer'}`, startX + 5, currentY + 13);
      doc.text(`Mobile: ${finalCustPhone ? `+91 ${finalCustPhone}` : 'N/A'}`, startX + 65, currentY + 13);
      doc.text(`Email: ${finalCustEmail || 'N/A'}`, startX + 115, currentY + 13);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Walk-in Customer', startX + 5, currentY + 13);
    }
    currentY += 27;

    // 4. Line Items Grid Table Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);

    doc.text('Item Description', startX, currentY);
    doc.text('Qty', 110, currentY, { align: 'center' });
    doc.text('Unit Price', 145, currentY, { align: 'right' });
    doc.text('Total Amount', 180, currentY, { align: 'right' });
    currentY += 3;

    doc.setDrawColor(209, 213, 219); // Gray 300
    doc.setLineWidth(0.4);
    doc.line(startX, currentY, 190, currentY);
    currentY += 6;

    // 5. Line Items rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);

    order.items.forEach((item) => {
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : item.menuItem.price;
      const itemTotal = unitPrice * item.quantity;
      const displayName = item.size 
        ? `${item.productName || item.menuItem.name} - ${item.size}` 
        : item.menuItem.name;
      doc.text(displayName, startX, currentY);
      doc.text(String(item.quantity), 110, currentY, { align: 'center' });
      doc.text(`${currencySymbol}${unitPrice.toFixed(2)}`, 145, currentY, { align: 'right' });
      doc.text(`${currencySymbol}${itemTotal.toFixed(2)}`, 180, currentY, { align: 'right' });
      currentY += 6.5;
    });

    currentY += 2;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(startX, currentY, 190, currentY);
    currentY += 6;

    // 6. Calculations summary blocks
    const totalAmount = order.totalAmount;
    const subtotal = gstRate > 0 ? Math.round(totalAmount / (1 + gstRate)) : totalAmount;
    const gst = totalAmount - subtotal;
    const currentDiscount = (order as any).discount !== undefined ? (order as any).discount : discountAmount;
    const finalPaid = Math.max(0, totalAmount - currentDiscount);

    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);

    doc.text('Subtotal:', 140, currentY, { align: 'right' });
    doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, 180, currentY, { align: 'right' });
    currentY += 5.5;

    if (gstRate > 0) {
      doc.text(`Tax Inclusive (${gstPercentage}%):`, 140, currentY, { align: 'right' });
      doc.text(`${currencySymbol}${gst.toFixed(2)}`, 180, currentY, { align: 'right' });
      currentY += 5.5;
    }

    // Service charge (if applicable) -> Display as 0.00 (Waived)
    doc.text('Service Charge (0%):', 140, currentY, { align: 'right' });
    doc.text(`${currencySymbol}0.00`, 180, currentY, { align: 'right' });
    currentY += 5.5;

    if (currentDiscount > 0) {
      doc.setTextColor(220, 38, 38); // Crimson red
      doc.text('Discount Applied:', 140, currentY, { align: 'right' });
      doc.text(`-${currencySymbol}${currentDiscount.toFixed(2)}`, 180, currentY, { align: 'right' });
      currentY += 5.5;
    }

    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.4);
    doc.line(130, currentY, 190, currentY);
    currentY += 6;

    // High contrast total block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text('TOTAL AMOUNT:', 140, currentY, { align: 'right' });
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.text(`${currencySymbol}${finalPaid.toFixed(2)}`, 180, currentY, { align: 'right' });
    currentY += 7;

    // Cash Change calculations if Payment Method is Cash
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    
    const parsedReceived = parseFloat(receivedAmount || '0');
    if (paymentMethodLabel === 'Cash' && parsedReceived > 0) {
      const balanceReturned = parsedReceived > finalPaid ? (parsedReceived - finalPaid) : 0;
      doc.text('Cash Received:', 140, currentY, { align: 'right' });
      doc.text(`${currencySymbol}${parsedReceived.toFixed(2)}`, 180, currentY, { align: 'right' });
      currentY += 5;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Balance Returned:', 140, currentY, { align: 'right' });
      doc.text(`${currencySymbol}${balanceReturned.toFixed(2)}`, 180, currentY, { align: 'right' });
      currentY += 7;
    } else {
      doc.text('Amount Paid:', 140, currentY, { align: 'right' });
      doc.text(`${currencySymbol}${finalPaid.toFixed(2)}`, 180, currentY, { align: 'right' });
      currentY += 7;
    }

    currentY += 8;

    // 7. Invoice message, disclaimer & brand elements
    doc.setDrawColor(243, 244, 246);
    doc.setLineWidth(0.4);
    doc.line(startX, currentY, 190, currentY);
    currentY += 6;

    // Center Thank You note
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text('Thank You For Dining With Us!', 105, currentY, { align: 'center' });
    currentY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text('We appreciate your visit and look forward to serving you again.', 105, currentY, { align: 'center' });
    currentY += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129); // Emerald accent
    doc.text(`Website: ${restWebsite}  |  WhatsApp: ${restPhone}`, 105, currentY, { align: 'center' });
    currentY += 4.5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text('Invoice Generated by OrderPoint Pro POS', 105, currentY, { align: 'center' });

    if (shouldDownload) {
      doc.save(`Invoice-${invoiceNo}.pdf`);
    }

    return doc.output('datauristring');
  };

  const handleCompileAndSavePDF = (
    order: Order, 
    invoiceNo: string, 
    autoDownload = true,
    custName?: string,
    custPhone?: string,
    custEmail?: string
  ): string => {
    try {
      const dataUri = generatePDFForOrder(
        order, 
        invoiceNo, 
        autoDownload, 
        custName || customerName, 
        custPhone || customerPhone, 
        custEmail || customerEmail
      );
      return dataUri;
    } catch (e) {
      console.error('Error generating PDF:', e);
      return '';
    }
  };

  // Quick Action triggers
  const handlePrintAction = () => {
    if (!activeOrderObj) return;
    setPrintingBill(true);
    setTimeout(() => {
      setPrintingBill(false);
      setIsBillPrinted(true);
      window.print();
      onShowToast('Invoice printed or sent to printer successfully!');
    }, 200);
  };

  const handleDownloadPDFLocal = () => {
    if (!activeOrderObj) return;
    setDownloadingPDF(true);
    try {
      generatePDFForOrder(activeOrderObj, activeInvoiceNo);
      setDownloadingPDF(false);
      onShowToast(`Invoice_#${activeInvoiceNo}.pdf compiled & saved!`);
    } catch (e) {
      console.error(e);
      setDownloadingPDF(false);
      onShowToast('Error building PDF document.');
    }
  };

  const [updatingMetadata, setUpdatingMetadata] = useState(false);
  const [emailProgress, setEmailProgress] = useState<string>('');

  const handleUpdateCustomerMetadata = async () => {
    if (!activeOrderObj) return;
    setUpdatingMetadata(true);
    try {
      const orderRef = doc(db, `restaurants/${localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant'}/orders`, activeOrderObj.id);
      await updateDoc(orderRef, {
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        customerEmail: customerEmail || ''
      });
      onShowToast('Customer billing profile updated in database!');
    } catch (e) {
      console.error('Error updating customer profile metadata:', e);
      onShowToast('Error saving customer profile details.');
    } finally {
      setUpdatingMetadata(false);
    }
  };

  const handleSendEmailWithPDF = async () => {
    if (!activeOrderObj) return;
    if (!customerEmail || !customerEmail.includes('@')) {
      onShowToast('Please provide a valid customer email address!');
      return;
    }
    setSendingEmail(true);
    setEmailProgress('Compiling premium vector PDF layout...');

    try {
      // 1. Generate real PDF Data URI
      const pdfDataUri = handleCompileAndSavePDF(activeOrderObj, activeInvoiceNo, false);

      // 2. Check if we have active Gmail OAuth token
      let token = getGmailAccessToken();
      if (!token) {
        setEmailProgress('Connecting to Gmail Service... Please authorize in the popup.');
        try {
          token = await authorizeGmailService();
        } catch (authError: any) {
          console.error('Gmail Authorization cancelled or failed:', authError);
          onShowToast('Gmail connection required to send invoices directly.');
          setSendingEmail(false);
          setEmailProgress('');
          return;
        }
      }

      setEmailProgress('Dispatching secure MIME package via Gmail API...');
      
      const restName = settings?.restaurantInfo?.name || 'Our Bistro';
      const restPhone = settings?.restaurantInfo?.phone || '';
      
      const emailBody = `
        <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">OrderPoint <span style="color: #10b981;">Pro</span></h1>
            <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Official Digital Invoice</p>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Hi ${customerName || 'Valued Guest'},</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Thank you for dining with us at <strong>${restName}</strong>! We hope you enjoyed your meal. Your billing details and payment have been settled successfully.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              We have attached your official digital receipt <strong>Invoice #${activeInvoiceNo}</strong> as a high-resolution PDF attachment to this email.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px dashed #cbd5e1; text-align: center;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; display: block; margin-bottom: 6px; text-transform: uppercase;">Invoice Number</span>
              <span style="font-family: monospace; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">#${activeInvoiceNo}</span>
              <span style="font-size: 13px; color: #10b981; font-weight: 600; display: block; margin-top: 6px;">Paid Total: ₹${activeOrderObj.totalAmount?.toFixed(2)}</span>
            </div>
            
            <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 0;">
              If you have any feedback or queries about this invoice, feel free to contact us at ${restPhone ? `<strong>${restPhone}</strong>` : 'our billing counter'}.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
            This secure receipt was delivered automatically via Google Gmail API.<br/>
            <strong>OrderPoint Pro Enterprise</strong> • The Ultimate Restaurant OS
          </div>
        </div>
      `;

      await sendEmailViaGmail({
        to: customerEmail,
        subject: `🧾 Digital Tax Invoice #${activeInvoiceNo} - ${restName}`,
        bodyHtml: emailBody,
        pdfBase64: pdfDataUri,
        pdfFileName: `Invoice_${activeInvoiceNo}.pdf`
      });

      // Update Firestore order
      const orderRef = doc(db, `restaurants/${localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant'}/orders`, activeOrderObj.id);
      await updateDoc(orderRef, {
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        customerName: customerName,
        pdfDataUri: pdfDataUri
      });

      onShowToast(`Invoice PDF sent to ${customerEmail} via Gmail successfully!`);
    } catch (error: any) {
      console.error('[Billing] Error sending email via Gmail:', error);
      onShowToast(`Failed to send email: ${error.message || error}`);
    } finally {
      setSendingEmail(false);
      setEmailProgress('');
    }
  };

  // Launch browser's native print window of the invoice card
  const handlePrintInvoiceReal = () => {
    if (!activeOrderObj) return;
    setIsBillPrinted(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Processing payments & mapping to parents functions
  const handleSettleSubmit = async () => {
    if (!activeOrderObj) return;

    // Grand calculations for confirmation overlay
    const orderTotal = activeOrderObj.totalAmount;
    const finalPaid = Math.max(0, orderTotal - discountAmount);

    const normMethod = selectedMethod.toLowerCase(); // 'cash' | 'upi' | 'card'

    // Save state for print receipts and WhatsApp resending
    setLastPaidOrderObj(activeOrderObj);

    // Compile beautiful PDF and get base64 Data URI
    const pdfDataUri = handleCompileAndSavePDF(activeOrderObj, activeInvoiceNo, true);

    const cleanPhone = customerPhone.replace(/\D/g, '');
    let hasSentWhatsApp = false;

    // Automatically send the PDF invoice to the customer's WhatsApp number (if provided)
    if (cleanPhone.length >= 10) {
      try {
        const message = getWhatsAppMessageText(activeOrderObj, activeInvoiceNo, true);
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        
        // Open in a new window/tab
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
        hasSentWhatsApp = true;
      } catch (e) {
        console.error('Error auto-sending WhatsApp:', e);
      }
    }

    // Trigger parent persistent storage changes
    await onMarkOrderPaid(activeOrderObj.id, normMethod, {
      discount: discountAmount,
      invoiceNo: activeInvoiceNo,
      customerPhone: customerPhone || activeOrderObj.customerPhone || '',
      customerName: customerName || (activeOrderObj as any).customerName || 'Walk-in Customer',
      customerEmail: customerEmail || (activeOrderObj as any).customerEmail || '',
      pdfDataUri: pdfDataUri
    });

    if (hasSentWhatsApp) {
      try {
        const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
        await updateDoc(doc(db, `restaurants/${userId}/orders`, activeOrderObj.id), { billSentToWhatsApp: true });
      } catch (e) {
        console.error(e);
      }
      onShowToast('Payment completed successfully. PDF invoice sent to WhatsApp.');
    } else {
      onShowToast('Payment completed successfully.');
    }

    const parsedReceived = parseFloat(receivedAmount || '0');
    const changeToReturnVal = normMethod === 'cash' && parsedReceived > finalPaid ? (parsedReceived - finalPaid) : 0;

    setSuccessWhatsAppPhone(cleanPhone || activeOrderObj.customerPhone || '');

    // Capture success information to display the high-fidelity confirmation panel
    setPaymentSuccessOrder({
      orderNumber: activeOrderObj.orderNumber,
      invoiceNumber: activeInvoiceNo,
      tableNo: activeOrderObj.tableNo,
      type: activeOrderObj.type,
      totalAmount: orderTotal,
      discountAmount: discountAmount,
      finalPaid: finalPaid,
      paymentMethod: normMethod === 'cash' ? 'Cash' : normMethod === 'upi' ? 'UPI' : 'Card',
      itemsCount: activeOrderObj.items.reduce((sum, item) => sum + item.quantity, 0),
      receivedAmount: normMethod === 'cash' ? receivedAmount : undefined,
      changeToReturn: changeToReturnVal,
      customerPhone: cleanPhone || undefined,
      customerName: customerName || (activeOrderObj as any).customerName || 'Walk-in Customer'
    });

    // Reset local view selectors
    setSelectedOrderId('');
  };

  return (
    <PageLayout
      title="Billing"
      subtitle="Generate invoices and manage customer payments."
      id="billing_settlement_counter"
      customPadding="p-3 sm:p-6 flex-1 flex flex-col min-h-0 overflow-hidden"
      activeTab="Billing"
      onTabChange={onNavigateToTab}
    >
      
      {/* KEYFRAMES FOR ANIMATIONS */}
      <style>{`
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .pulse-active {
          animation: subtlePulse 2.5s infinite ease-in-out;
        }

        @media print {
          body, html, #root, #billing_settlement_counter, header, nav, footer, sidebar, button {
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 10px !important;
            font-family: monospace !important;
            font-size: 11px !important;
            color: #000000 !important;
            border: none !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* RENDER DYNAMIC TWO-PANEL INTERFACE (35% Left Queue, 65% Right Viewer) */}
      <div className="grid grid-cols-1 lg:grid-cols-[35fr_65fr] gap-6 items-start flex-1 min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: PENDING SETTLEMENTS QUEUE / PAID HISTORY */}
        <div className={`flex flex-col gap-3 h-full overflow-hidden ${selectedOrderId ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Tab Selection Row */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 rounded-xl gap-1 shrink-0">
            <button
              onClick={() => {
                setBillingTab('pending');
                setSelectedOrderId('');
              }}
              className={`flex-1 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-center rounded-lg transition-all cursor-pointer ${
                billingTab === 'pending'
                  ? 'bg-white text-gray-950 shadow-xs border border-gray-200'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Pending ({unpaidOrders.length})
            </button>
            <button
              onClick={() => {
                setBillingTab('history');
                setSelectedOrderId('');
              }}
              className={`flex-1 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-center rounded-lg transition-all cursor-pointer ${
                billingTab === 'history'
                  ? 'bg-white text-gray-950 shadow-xs border border-gray-200'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Paid History ({paidOrders.length})
            </button>
          </div>

          <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-[10px] border border-gray-100 shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                {billingTab === 'pending' ? 'Settlement Queue' : 'Completed Invoices'}
              </span>
              <span className="text-[13px] font-black text-gray-800">
                {billingTab === 'pending' ? `${unpaidOrders.length} Pending Tickets` : `${paidOrders.length} Settled Logs`}
              </span>
            </div>

            {/* Oldest First / Amount sorting dropdown/chips */}
            <div className="flex bg-white p-0.5 rounded-[6px] border border-gray-200">
              <button
                id="btn_sort_oldest"
                title="Settle oldest first"
                onClick={() => setSortBy('oldest')}
                className={`px-2 py-1 rounded-[4px] text-[9.5px] font-bold uppercase tracking-tight transition-all cursor-pointer ${
                  sortBy === 'oldest' ? 'bg-[#111111] text-white' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Oldest
              </button>
              <button
                id="btn_sort_highest"
                title="Prioritize largest invoices"
                onClick={() => setSortBy('highest')}
                className={`px-2 py-1 rounded-[4px] text-[9.5px] font-bold uppercase tracking-tight transition-all cursor-pointer ${
                  sortBy === 'highest' ? 'bg-[#111111] text-white' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Highest {currencySymbol}
              </button>
            </div>
          </div>

          {/* Quick Find Search box for rapid filtering on busy peak nights */}
          <div className="relative shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={13} className="stroke-[2.5]" />
            </span>
            <input
              id="settle_search_bar"
              type="text"
              placeholder="Search table or ticket #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[32px] pl-8 pr-7 bg-white border border-gray-200 rounded-[8px] text-[11px] font-semibold focus:outline-none focus:border-black transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 font-bold"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* PENDING TICKETS CARD ROLL / HISTORIC BILLS ROLL */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-2">
            {billingTab === 'history' ? (
              paidOrders.length === 0 ? (
                <div className="bg-white rounded-[16px] p-8 text-center text-xs text-gray-400 font-bold border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 shadow-xs animate-fade-in">
                  <Receipt size={32} className="text-gray-300 animate-pulse" />
                  <div className="space-y-1">
                    <span>No completed invoices yet.</span>
                    <p className="text-[10px] font-normal text-gray-400 max-w-[180px] mx-auto leading-tight">
                      Settle pending tickets above to populate this interactive history.
                    </p>
                  </div>
                </div>
              ) : (
                paidOrders.map(order => {
                  const isSelected = activeOrderObj?.id === order.id;
                  const invoiceNo = (order as any).invoiceNumber || `INV-${order.orderNumber}`;
                  
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`bg-white rounded-[8px] p-3 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer border flex justify-between items-center select-none animate-fade-in ${
                        isSelected 
                          ? 'border-[#000000] ring-1 ring-black bg-gray-50/50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <h4 className="text-[14px] font-[800] text-[#111111] leading-none mb-1">
                          {order.tableNo ? (order.tableNo.trim().toLowerCase().startsWith('table') ? order.tableNo.trim() : `Table ${order.tableNo.trim()}`) : order.type}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-mono">#{invoiceNo}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[16px] font-[800] text-emerald-600 leading-none block">
                          {currencySymbol}{order.totalAmount}
                        </span>
                        <span className="text-[8.5px] font-black uppercase text-emerald-500 mt-1 block tracking-wider">
                          PAID ({order.paymentMethod || 'UPI'})
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              unpaidOrders.length === 0 ? (
                <div className="bg-white rounded-[16px] p-8 text-center text-xs text-gray-400 font-bold border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 shadow-xs">
                  <CheckCircle size={32} className="text-[#22C55E]" />
                  <div className="space-y-1">
                    <span>No outstanding bills!</span>
                    <p className="text-[10px] font-normal text-gray-400 max-w-[180px] mx-auto leading-tight">
                      Active kitchen tickets automatically flow here in real time.
                    </p>
                  </div>
                </div>
              ) : (
                unpaidOrders.map(order => {
                  const isSelected = activeOrderObj?.id === order.id;
                  const elapsedMins = Math.floor((Date.now() - order.timestamp) / 60000);
                  const isVIP = order.tableNo && ['03', '3', '05', '5'].includes(order.tableNo);

                  return (
                    <div
                      id={`kds_settle_card_${order.id}`}
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`bg-white rounded-[8px] p-3 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer border flex justify-between items-center select-none ${
                        isSelected 
                          ? 'border-[#000000] ring-1 ring-black bg-gray-50/50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-[14px] font-[800] text-[#111111] leading-none">
                            {order.tableNo ? (order.tableNo.trim().toLowerCase().startsWith('table') ? order.tableNo.trim() : `Table ${order.tableNo.trim()}`) : order.type}
                          </h4>
                          {isVIP && (
                            <span className="bg-amber-50 text-amber-600 px-1 py-0.5 rounded text-[9px] font-bold border border-amber-100">
                              VIP
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] text-gray-500 font-medium">#{order.orderNumber} • {elapsedMins}m ago</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[16px] font-[800] text-[#111111] leading-none block">
                          {currencySymbol}{order.totalAmount}
                        </span>
                        <span className={`text-[9px] font-black uppercase mt-1 block tracking-wider ${
                          order.status === 'New' || order.status === 'Pending'
                            ? 'text-gray-400'
                            : order.status === 'Preparing'
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                        }`}>
                          {order.status || 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MAIN INVOICE DESK & DETAILED PANEL (65% width) */}
        <div className={`bg-white rounded-[12px] border border-gray-100 p-4 shadow-xs relative overflow-y-auto min-h-0 h-full flex flex-col ${!selectedOrderId ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* STATE A: PAYMENT CONFIRMED STATE OVERLAY */}
          {paymentSuccessOrder ? (
            <div className="animate-fade-in flex flex-col justify-center items-center py-8 px-4 text-center">
              
              {/* Success celebration graphic wrapper */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center text-emerald-500 mb-4 ready-pulse">
                <CheckCircle size={38} className="stroke-[2.5]" />
              </div>

              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full border border-emerald-200">
                Settled &amp; Locked
              </span>

              <h2 className="text-[32px] font-[900] tracking-tight text-gray-900 mt-3 font-display">
                {currencySymbol}{paymentSuccessOrder.finalPaid}.00 Paid!
              </h2>
              
              <p className="text-[13px] text-gray-500 max-w-sm mt-1.5">
                Invoice #{paymentSuccessOrder.invoiceNumber} for {paymentSuccessOrder.tableNo ? (paymentSuccessOrder.tableNo.trim().toLowerCase().startsWith('table') ? paymentSuccessOrder.tableNo.trim() : `Table ${paymentSuccessOrder.tableNo.trim()}`) : paymentSuccessOrder.type} has been successfully recorded in the ledger via <strong className="text-gray-900">{paymentSuccessOrder.paymentMethod.toUpperCase()}</strong>.
              </p>

              {/* Cash Return display widget if applicable */}
              {paymentSuccessOrder.paymentMethod === 'Cash' && paymentSuccessOrder.changeToReturn ? (
                <div className="mt-4 p-3 bg-amber-50 rounded-[12px] border border-amber-100 text-xs w-full max-w-xs space-y-1">
                  <span className="text-amber-700 font-bold block uppercase tracking-wider text-[10px]">Change To Return</span>
                  <span className="text-2xl font-black text-amber-900 block">
                    {currencySymbol}{paymentSuccessOrder.changeToReturn}.00
                  </span>
                  <span className="text-amber-500 font-semibold block text-[9.5px]">Cash drawer opened automatically</span>
                </div>
              ) : null}

              {/* Summary metadata */}
              <div className="my-6 p-4 bg-gray-50 rounded-[16px] border border-gray-100 text-xs text-left w-full max-w-md space-y-2.5">
                <div className="flex justify-between items-center text-gray-400">
                  <span>Invoice Number</span>
                  <span className="font-mono font-bold text-gray-850">#{paymentSuccessOrder.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center text-gray-400">
                  <span>Customer Profile</span>
                  <span className="font-bold text-gray-800">{paymentSuccessOrder.customerName}</span>
                </div>
                {paymentSuccessOrder.customerPhone && (
                  <div className="flex justify-between items-center text-gray-400">
                    <span>WhatsApp Mobile</span>
                    <span className="font-mono font-bold text-gray-800">+91 {paymentSuccessOrder.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-400 border-t border-gray-100 pt-2.5">
                  <span>Original Bill Total</span>
                  <span className="font-semibold text-gray-600">{currencySymbol}{paymentSuccessOrder.totalAmount}.00</span>
                </div>
                {paymentSuccessOrder.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-rose-500/80">
                    <span>Applied Coupon Discount</span>
                    <span className="font-bold">-{currencySymbol}{paymentSuccessOrder.discountAmount}.00</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-800 border-t border-gray-200 pt-2.5 font-bold">
                  <span>Final Amount Received</span>
                  <span className="text-sm font-black text-black">{currencySymbol}{paymentSuccessOrder.finalPaid}.00</span>
                </div>
              </div>

              {/* WhatsApp Receipt Widget */}
              <div className="w-full max-w-md p-4 bg-emerald-50/40 rounded-[16px] border border-emerald-100/70 text-xs text-left space-y-2 mb-6">
                <span className="text-emerald-800 font-bold block uppercase tracking-wider text-[9px] flex items-center gap-1 select-none">
                  <Send size={11} className="text-emerald-600" />
                  <span>WhatsApp Digital Receipt</span>
                </span>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px] select-none">+91</span>
                    <input
                      type="tel"
                      value={successWhatsAppPhone}
                      onChange={(e) => setSuccessWhatsAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit mobile"
                      className="w-full h-[38px] pl-10 pr-3 bg-white border border-gray-205 rounded-[10px] text-xs font-semibold focus:outline-none focus:border-emerald-500 text-gray-800"
                    />
                  </div>
                  <button
                    onClick={handleShareWhatsAppFromSuccess}
                    disabled={sendingWhatsApp}
                    className="px-4 h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-[10px] flex items-center gap-1.5 cursor-pointer transition-colors border-none disabled:opacity-50"
                  >
                    {sendingWhatsApp ? 'Sending...' : 'Send Bill'}
                  </button>
                </div>
              </div>

              {/* Success Screen Action Buttons */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                
                {/* Print thermal receipt */}
                <button
                  onClick={() => {
                    setIsBillPrinted(true);
                    setTimeout(() => {
                      window.print();
                      onShowToast('Reprinting final tax invoice receipt...');
                    }, 150);
                  }}
                  className="h-[42px] rounded-[10px] bg-white border border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Slip</span>
                </button>

                {/* Next ticket / Close Overlay */}
                <button
                  onClick={() => {
                    setPaymentSuccessOrder(null);
                    setSelectedOrderId('');
                  }}
                  className="h-[42px] rounded-[10px] bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-black/20"
                >
                  <span>Close Ticket</span>
                  <ArrowRight size={13} />
                </button>

              </div>

            </div>
          ) : !activeOrderObj ? (
            
            /* STATE B: NO OUTSTANDING TICKETS PRESENT AT THE POS COUNTER */
            <div className="flex flex-col justify-center items-center text-center py-24 px-6 space-y-4">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center border border-gray-150 text-gray-400">
                <Receipt size={26} className="stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider">
                  Settle Counter Empty
                </span>
                <h3 className="text-lg font-extrabold text-gray-800 tracking-tight">
                  Awaiting Outstanding Bills
                </h3>
                <p className="text-xs text-gray-400 max-w-xs mt-2 leading-relaxed">
                  Excellent work! There are no unpaid restaurant receipts left in the billing register. New diners placed to tables will sync here automatically.
                </p>
              </div>
            </div>
          ) : (
             /* STATE C: ACTIVE INVOICE WORK DESK & TRANSACTION MANAGER */
            <div className="flex-1 flex flex-col justify-between overflow-y-auto hover:scrollbar-thin text-xs gap-4 animate-fade-in pr-1">
              
              {/* UPPER QUICK ACTIONS HEADER ROW */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-150 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId('')}
                    className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors border-none bg-transparent cursor-pointer mr-1"
                  >
                    <ArrowLeft size={16} className="stroke-[2.5]" />
                  </button>
                  <div>
                    {activeOrderObj.isPaid ? (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        🟢 PAID ({activeOrderObj.paymentMethod})
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        🟠 PAYMENT PENDING ({activeOrderObj.paymentMethod})
                      </span>
                    )}
                    <h3 className="text-lg font-[950] text-[#111111] tracking-tight leading-none mt-1.5 font-sans">
                      #{activeInvoiceNo}
                    </h3>
                  </div>
                </div>

                {/* Quick actions (Print Invoice, PDF Download) */}
                <div className="flex items-center gap-2">
                  <button
                    id="btn_print_invoice_real"
                    onClick={handlePrintInvoiceReal}
                    title="Open standard browser print dialog"
                    className="h-9 px-4 rounded-xl bg-black hover:bg-gray-900 border border-black text-white text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-[1.01]"
                  >
                    <Printer size={14} />
                    <span>Print Invoice</span>
                  </button>

                  <button
                    onClick={handleDownloadPDFLocal}
                    disabled={downloadingPDF}
                    title="Download compliant tax PDF document"
                    className="h-9 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} className={downloadingPDF ? "animate-bounce" : ""} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* UNIFIED VERTICAL FLOW */}
              <div className="space-y-5 flex-1">
                       {/* 🧾 SECTION 1: INVOICE SHEET (Simulates a physical POS customer bill check) */}
                <div className="bg-amber-50/10 border border-amber-150 rounded-xl p-3 shadow-3xs space-y-2.5 font-sans relative overflow-hidden">
                  
                  {/* Subtle check style background accent */}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-100/10 rounded-full blur-xl pointer-events-none" />

                  {/* Header info */}
                  <div className="text-center space-y-0.5 pb-2.5 border-b border-dashed border-amber-200">
                    <span className="text-[9px] font-[800] text-gray-400 uppercase tracking-widest block">ORDERPOINT PRO</span>
                    <h4 className="text-sm font-black text-gray-950 uppercase leading-none mt-0.5">THE ROYAL FEAST</h4>
                    <span className="text-[9px] text-gray-550 block">123 Royal Palace Avenue, India</span>
                  </div>

                  {/* Invoice Details Block */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Invoice Details</span>
                    <div className="grid grid-cols-2 gap-y-1.5 text-[10px] font-medium text-gray-650 bg-white/70 rounded-lg p-2 border border-amber-100/60 leading-normal font-sans">
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Invoice Number</span>
                        <strong className="text-gray-900 text-[10.5px] font-mono leading-none">{activeInvoiceNo}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Order ID</span>
                        <strong className="text-gray-900 text-[10.5px] font-mono leading-none truncate block">{activeOrderObj.id}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Token Number</span>
                        <strong className="text-gray-900 text-[10.5px] font-mono leading-none">{activeOrderObj.orderNumber.replace(/\D/g, '') || activeOrderObj.orderNumber}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Customer Name</span>
                        <strong className="text-gray-900 block truncate">{customerName || activeOrderObj.customerName || 'Walk-in Guest'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Phone Number</span>
                        <span className="text-gray-850 leading-none font-semibold">{customerPhone || activeOrderObj.customerPhone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Table / Type</span>
                        <span className="text-gray-850 font-extrabold leading-none">{activeOrderObj.tableNo ? `Table ${activeOrderObj.tableNo}` : activeOrderObj.type}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Payment Method</span>
                        <span className="text-gray-850 font-extrabold leading-none">{activeOrderObj.paymentMethod || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Payment Status</span>
                        <span className={`leading-none font-black ${activeOrderObj.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {activeOrderObj.isPaid ? 'PAID' : 'PAYMENT PENDING'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Order Date & Time</span>
                        <span className="text-gray-850 leading-none">{new Date(activeOrderObj.timestamp).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[8px] uppercase tracking-wider font-bold">Payment Date & Time</span>
                        <span className="text-gray-850 leading-none">{activeOrderObj.paymentAt ? new Date(activeOrderObj.paymentAt).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Items Table */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Order Items</span>
                    <div className="bg-white rounded-lg border border-amber-100/80 overflow-hidden shadow-3xs">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-amber-50/40 border-b border-amber-100 text-[8px] font-black text-gray-450 uppercase tracking-widest">
                            <th className="py-1.5 px-2.5">Item Description</th>
                            <th className="py-1.5 px-1.5 text-center w-10">Qty</th>
                            <th className="py-1.5 px-1.5 text-right w-16">Price</th>
                            <th className="py-1.5 px-2.5 text-right w-24">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50 text-gray-705">
                          {activeOrderObj.items.map((item, idx) => {
                            const unitPrice = item.unitPrice !== undefined ? item.unitPrice : item.menuItem.price;
                            return (
                              <tr key={idx} className="hover:bg-amber-50/10">
                                <td className="py-1.5 px-2.5 text-left">
                                  <span className="font-bold text-gray-850 text-[10.5px] block">{item.productName || item.menuItem.name}</span>
                                  {item.size && (
                                    <span className="inline-block mt-0.5 text-[8px] font-black uppercase bg-indigo-50 border border-solid border-indigo-100 text-indigo-700 px-1 rounded">
                                      {item.size}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-1.5 text-center font-bold text-gray-900">
                                  {item.quantity}
                                </td>
                                <td className="py-1.5 px-1.5 text-right text-gray-455 text-gray-450 font-mono">
                                  {currencySymbol}{unitPrice}
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-black text-gray-850 font-mono">
                                  {currencySymbol}{unitPrice * item.quantity}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tax Breakdown Block */}
                  {currentGst > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Tax Breakdown</span>
                      <div className="bg-white/85 rounded-lg p-2 border border-amber-100/60 text-[9.5px] flex justify-between gap-4 font-mono text-gray-500">
                        <div>
                          <span className="block text-[7.5px] font-extrabold uppercase text-gray-450 tracking-wider">Tax Part A (50%)</span>
                          <strong className="text-gray-800">{currencySymbol}{(currentGst / 2).toFixed(2)}</strong>
                        </div>
                        <div className="text-right">
                          <span className="block text-[7.5px] font-extrabold uppercase text-gray-450 tracking-wider">Tax Part B (50%)</span>
                          <strong className="text-gray-800">{currencySymbol}{(currentGst / 2).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Invoice summary with Subtotal, Tax, Discount, Net Payable */}
                  <div className="space-y-1">
                    <div className="bg-white rounded-lg border border-amber-150 p-2.5 space-y-1.5 shadow-3xs">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500">
                        <span>Subtotal</span>
                        <span className="text-gray-800 font-bold font-mono">{currencySymbol}{currentSubtotal}.00</span>
                      </div>
                      
                      {currentGst > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500">
                          <span>Tax Inclusive ({gstPercentage}%)</span>
                          <span className="text-gray-800 font-bold font-mono">{currencySymbol}{currentGst}.00</span>
                        </div>
                      )}

                      {discountAmount > 0 && (
                        <div className="flex justify-between items-center text-[10px] text-rose-600 font-bold">
                          <span>Discount Applied</span>
                          <span className="font-mono">-{currencySymbol}{discountAmount}.00</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-dashed border-amber-200 flex justify-between items-center">
                        <div>
                          <span className="text-[9.5px] font-black text-gray-950 uppercase tracking-wider block leading-none">Net Amount</span>
                          <span className="text-[8px] font-bold text-gray-400 block mt-0.5">Inclusive of taxes</span>
                        </div>
                        <span className="text-lg font-[900] text-black tracking-tight leading-none font-mono">
                          {currencySymbol}{grandSettleTotal}.00
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 🧾 SECTION 2: READ ONLY SETTLED TRANSACTION SUMMARY */}
                {activeOrderObj.isPaid ? (
                  <div className="space-y-4 animate-fade-in font-sans">
                    {/* Read-Only Paid Invoice Summary */}
                    <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-emerald-600" />
                          <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                            Settled Transaction Record
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase border border-emerald-200">
                          PAID
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                          <span className="text-[10px] text-gray-400 font-sans block font-semibold">Customer</span>
                          <span className="font-bold text-gray-900 font-sans block truncate">{customerName || 'Walk-in Guest'}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                          <span className="text-[10px] text-gray-400 font-sans block font-semibold">Payment Method</span>
                          <span className="font-bold text-gray-900 block">{activeOrderObj.paymentMethod || 'UPI'}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                          <span className="text-[10px] text-gray-400 font-sans block font-semibold">Invoice Number</span>
                          <span className="font-bold text-gray-900 block">#{activeInvoiceNo}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                          <span className="text-[10px] text-gray-400 font-sans block font-semibold">Total Settled</span>
                          <span className="font-extrabold text-emerald-700 block">{currencySymbol}{grandSettleTotal}.00</span>
                        </div>
                      </div>

                      {/* Read Only Actions */}
                      <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-500 font-semibold font-sans">Official Tax Invoice</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadPDFLocal}
                            className="h-8 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Download size={12} className="text-blue-600" />
                            <span>Download PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={handlePrintInvoiceReal}
                            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-black text-white text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Printer size={12} />
                            <span>Thermal Print</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* WhatsApp Share Section for Paid Orders */}
                    <div className="bg-emerald-50/20 border border-emerald-150 rounded-2xl p-4 space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          <MessageSquare size={12} className="text-emerald-600" />
                          WhatsApp Receipt Confirmation
                        </label>
                        {activeOrderObj.billSentToWhatsApp && (
                          <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                            Sent
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px] select-none font-sans">+91</span>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="Enter 10-digit mobile"
                            className="w-full h-10 pl-10 pr-3 bg-white border border-gray-205 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 text-gray-800 font-mono"
                            maxLength={10}
                          />
                        </div>
                        
                        <button
                          type="button"
                          onClick={async () => {
                            const cleanPhone = customerPhone.replace(/\D/g, '');
                            if (cleanPhone.length < 10) {
                              onShowToast('Please enter a valid 10-digit WhatsApp mobile number!');
                              return;
                            }
                            const message = getWhatsAppMessageText(activeOrderObj, activeInvoiceNo, true);
                            const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                            
                            // Track in db
                            try {
                              const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
                              await updateDoc(doc(db, `restaurants/${userId}/orders`, activeOrderObj.id), { billSentToWhatsApp: true });
                            } catch (e) {
                              console.error(e);
                            }

                            const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                            window.open(waUrl, '_blank');
                            onShowToast('Invoice shared on WhatsApp!');
                          }}
                          className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors border-none font-sans"
                        >
                          <Send size={12} />
                          <span>Open WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 📱 SECTION 2: WHATSAPP INVOICE */}
                    <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare size={12} className="text-emerald-600" />
                          WhatsApp Invoice (Optional)
                        </label>
                        {activeOrderObj.billSentToWhatsApp && (
                          <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                            Shared to Client
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-[12px]">+91</span>
                        <input
                          type="text"
                          placeholder="Enter 10-Digit Mobile Number"
                          value={customerPhone}
                          onChange={(e) => {
                            const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                            setCustomerPhone(numericVal);
                          }}
                          className="w-full h-11 pl-[38px] pr-3 bg-white border border-gray-250 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all font-mono placeholder:text-gray-400"
                          maxLength={10}
                        />
                      </div>
                      {customerPhone.length > 0 && (
                        <p className={`text-[10px] font-medium mt-1 ${customerPhone.length === 10 && /^[6-9]/.test(customerPhone) ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {customerPhone.length < 10 
                            ? "Please enter a valid 10-digit mobile number." 
                            : (!/^[6-9]/.test(customerPhone) 
                              ? "Mobile number must start with 6, 7, 8, or 9." 
                              : "✓ Valid WhatsApp mobile number")}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 font-medium">
                        If provided, the system will automatically send the PDF invoice to WhatsApp upon processing the payment.
                      </p>
                    </div>

                    {/* 💳 SECTION 3: PAYMENT METHOD */}
                    <div className="bg-gray-50/50 border border-gray-200 rounded-2xl p-3.5 space-y-2.5 font-sans">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-[#111111] uppercase tracking-wider block">
                          Payment Method
                        </span>
                        <p className="text-[10px] text-gray-500">Select payment method to record settlement.</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'cash', label: '💵 Cash' },
                          { id: 'upi', label: '📱 UPI' },
                          { id: 'card', label: '💳 Card' },
                        ].map(method => {
                          const isSel = selectedMethod === method.id;
                          
                          return (
                            <button
                              id={`pay_method_${method.id}`}
                              key={method.id}
                              type="button"
                              onClick={() => {
                                setSelectedMethod(method.id as any);
                              }}
                              className={`relative h-11 rounded-xl px-2.5 flex items-center justify-center transition-all duration-200 cursor-pointer select-none border text-center ${
                                isSel
                                  ? 'border-blue-600 bg-blue-600 text-white shadow-xs font-black'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 font-bold'
                              }`}
                            >
                              <span className="text-xs tracking-wide">{method.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* PROCESS BUTTON */}
                      <div className="pt-2 border-t border-gray-150">
                        <button
                          id="btn_billing_settle_main"
                          type="button"
                          onClick={handleSettleSubmit}
                          disabled={customerPhone.length > 0 && (customerPhone.length !== 10 || !/^[6-9]/.test(customerPhone))}
                          className="w-full h-12 rounded-xl text-white font-black uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md select-none hover:scale-[1.01] active:scale-[0.99] bg-black hover:bg-gray-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          <CheckCircle size={15} className="stroke-[2.5]" />
                          <span>{selectedMethod === 'cash' ? 'Mark as Paid' : 'Complete Order'}</span>
                        </button>
                      </div>

                    </div>
                  </>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* Dynamic Print-Friendly Section (Hidden except when sending layout to printer spool) */}
      {printDetails && (
        <div id="printable-invoice" className="hidden font-mono text-black text-xs leading-relaxed max-w-sm mx-auto">
          <div className="text-center space-y-1 mb-4 border-b border-dashed border-gray-400 pb-3">
            <h2 className="text-base font-black tracking-tight uppercase">THE ROYAL FEAST</h2>
            <p className="text-[10px] text-gray-500">123 Royal Palace Avenue, India</p>
            <p className="text-[10px] text-gray-400">Reg No: OP-98214A</p>
            <p className="text-[11px] font-bold mt-2 uppercase tracking-wider">*** SALE RECEIPT ***</p>
          </div>

          <div className="space-y-1 text-[11px] mb-4 border-b border-dashed border-gray-400 pb-3 leading-relaxed">
            <div className="flex justify-between">
              <span>Invoice Ref:</span>
              <span className="font-bold">{printDetails.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Order ID:</span>
              <span>#OP-{printDetails.order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{new Date(printDetails.order.timestamp).toLocaleDateString()} at {getFormattedTime(printDetails.order.timestamp)}</span>
            </div>
            <div className="flex justify-between">
              <span>Desk:</span>
              <span className="font-bold">{printDetails.order.tableNo ? (printDetails.order.tableNo.trim().toLowerCase().startsWith('table') ? printDetails.order.tableNo.trim() : `Table ${printDetails.order.tableNo.trim()}`) : printDetails.order.type}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer Name:</span>
              <span>{(printDetails.order as any).customerName || 'Walk-In Guest'}</span>
            </div>
          </div>

          <div className="mb-4">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-dashed border-gray-400 font-bold">
                  <th className="pb-1">Item Description</th>
                  <th className="pb-1 text-center w-8">Qty</th>
                  <th className="pb-1 text-right w-16">Price</th>
                  <th className="pb-1 text-right w-16">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-gray-200">
                {printDetails.order.items.map((item: any, idx: number) => {
                  const unitPrice = item.unitPrice !== undefined ? item.unitPrice : item.menuItem.price;
                  const displayName = item.size 
                    ? `${item.productName || item.menuItem.name} - ${item.size}` 
                    : item.menuItem.name;
                  return (
                    <tr key={idx}>
                      <td className="py-1 font-sans font-medium text-gray-800 text-left">
                        {displayName}
                      </td>
                      <td className="py-1 text-center font-bold">
                        {item.quantity}
                      </td>
                      <td className="py-1 text-right">
                        {currencySymbol}{unitPrice}.00
                      </td>
                      <td className="py-1 text-right font-bold">
                        {currencySymbol}{unitPrice * item.quantity}.00
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 text-[11px] border-b border-dashed border-gray-400 pb-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{currencySymbol}{printDetails.subtotal}.00</span>
            </div>
            {printDetails.gst > 0 && (
              <div className="flex justify-between">
                <span>Tax Inclusive ({gstPercentage}%):</span>
                <span>{currencySymbol}{printDetails.gst}.00</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>Applied Discount:</span>
                <span>-{currencySymbol}{discountAmount}.00</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-black pt-1 border-t border-dotted border-gray-400">
              <span>NET PAYABLE AMOUNT:</span>
              <span>{currencySymbol}{printDetails.finalTotal}.00</span>
            </div>
          </div>

          <div className="text-center mt-6 space-y-1.5">
            <p className="font-bold text-[10px] tracking-widest uppercase">Thank You For Your Visit!</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase">Payment Mode: {selectedMethod}</p>
          </div>
        </div>
      )}

      {showFeedbackPreview && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex-1 overflow-y-auto hidden-scrollbar">
              <CustomerFeedbackPage
                invoiceNo={showFeedbackPreview.invoiceNo}
                restaurantId={showFeedbackPreview.restaurantId}
                onClose={() => setShowFeedbackPreview(null)}
              />
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
