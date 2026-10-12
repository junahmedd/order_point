import { jsPDF } from 'jspdf';
import { PaymentHistoryRecord, RestaurantInfo } from '../types';

export function generateInvoicePDF(record: PaymentHistoryRecord, restaurantInfo?: RestaurantInfo): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // emerald-500
  const darkColor = [15, 23, 42];      // slate-900
  const grayColor = [100, 116, 139];   // slate-500

  // Top Accent Header Bar
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 32, 210, 2, 'F');

  // OrderPoint Pro Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ORDERPOINT PRO', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 213, 219);
  doc.text('Enterprise POS & SaaS Restaurant Platform', 14, 25);

  // INVOICE Header Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', 196, 18, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('ORIGINAL FOR RECIPIENT', 196, 25, { align: 'right' });

  // Invoice Details Metadata Box (Right Side)
  let y = 42;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(120, y, 76, 38, 3, 3, 'FD');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NO:', 125, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(record.invoiceNumber || 'OPP-INV-2026-0001', 191, y + 8, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DATE:', 125, y + 15);
  doc.setFont('helvetica', 'normal');
  const invDate = new Date(record.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  doc.text(invDate, 191, y + 15, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT ID:', 125, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(record.razorpayPaymentId || record.transactionId || 'pay_rzp_live', 191, y + 22, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('STATUS:', 125, y + 29);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('PAID (RAZORPAY)', 191, y + 29, { align: 'right' });

  // Customer / Billed To Info (Left Side)
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILLED TO:', 14, y + 6);

  doc.setFontSize(11);
  doc.text(restaurantInfo?.name || 'OrderPoint Partner Restaurant', 14, y + 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Owner: ${restaurantInfo?.ownerName || 'Restaurant Manager'}`, 14, y + 19);
  doc.text(`Email: ${restaurantInfo?.email || 'owner@orderpointpro.in'}`, 14, y + 24);
  doc.text(`Phone: ${restaurantInfo?.phone || '+91 9876543210'}`, 14, y + 29);
  if (restaurantInfo?.regNumber) {
    doc.text(`REG NO: ${restaurantInfo.regNumber}`, 14, y + 34);
  }

  // Items Table Header
  y += 48;
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(14, y, 182, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('SR', 18, y + 5.5);
  doc.text('SUBSCRIPTION DESCRIPTION', 32, y + 5.5);
  doc.text('BILLING CYCLE', 105, y + 5.5);
  doc.text('SUBTOTAL (₹)', 145, y + 5.5, { align: 'right' });
  doc.text('TOTAL (₹)', 191, y + 5.5, { align: 'right' });

  // Item Row
  y += 8;
  doc.setFillColor(255, 255, 255);
  doc.rect(14, y, 182, 16, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y + 16, 196, y + 16);

  const subtotal = record.price || record.totalAmount;
  const totalVal = record.price || record.totalAmount;

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('1', 18, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text(`OrderPoint Pro ${record.planName || 'Professional'} Subscription`, 32, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  const startStr = new Date(record.subscriptionStart).toLocaleDateString('en-IN');
  const endStr = new Date(record.subscriptionEnd).toLocaleDateString('en-IN');
  doc.text(`Valid: ${startStr} to ${endStr}`, 32, y + 11);

  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text((record.billingCycle || 'monthly').toUpperCase(), 105, y + 7);
  doc.text(`₹${subtotal.toLocaleString('en-IN')}`, 145, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`₹${totalVal.toLocaleString('en-IN')}`, 191, y + 7, { align: 'right' });

  // Calculation Breakdown Box
  y += 24;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(120, y, 76, 20, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  doc.text('Subtotal:', 125, y + 7);
  doc.text(`₹${subtotal.toLocaleString('en-IN')}`, 191, y + 7, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(125, y + 10, 191, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(16, 185, 129);
  doc.text('TOTAL PAID:', 125, y + 15);
  doc.text(`₹${totalVal.toLocaleString('en-IN')}`, 191, y + 15, { align: 'right' });

  // Terms & Authorized Signatory Footer
  y += 32;

  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMS & CONDITIONS:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text('• Computer generated Invoice. No physical signature required.', 14, y + 5);
  doc.text('• Subscriptions are non-transferable and auto-activate upon payment confirmation.', 14, y + 9);

  // Digital Seal Stamp
  doc.setDrawColor(16, 185, 129);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(140, y - 4, 56, 22, 3, 3, 'FD');

  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('VERIFIED & SEALED', 168, y + 2, { align: 'center' });
  doc.setFontSize(7);
  doc.text('ORDERPOINT PRO SAAS', 168, y + 7, { align: 'center' });
  doc.text(`Txn: ${record.transactionId || 'Razorpay Verified'}`, 168, y + 12, { align: 'center' });

  // Save the generated PDF
  doc.save(`${record.invoiceNumber || 'OrderPoint_Invoice'}.pdf`);
}
