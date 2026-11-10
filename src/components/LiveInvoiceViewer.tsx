/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, FileText, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import BrandedInvoiceCard, { BrandedInvoiceData } from './BrandedInvoiceCard';
import { jsPDF } from 'jspdf';

interface LiveInvoiceViewerProps {
  invoiceId: string;
  restaurantId: string;
  onClose?: () => void;
}

export default function LiveInvoiceViewer({ invoiceId, restaurantId, onClose }: LiveInvoiceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<BrandedInvoiceData | null>(null);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true);
        setError(null);

        // Ensure user is signed in (anonymously for customers accessing via public WhatsApp link)
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (authErr) {
            console.warn('Anonymous sign-in for invoice viewer:', authErr);
          }
        }

        let restName = 'The Royal Feast';
        let restAddr = '123 Royal Palace Avenue, India';

        // 1. Fetch Restaurant Settings
        try {
          const settingsRef = doc(db, `settings/${restaurantId}`);
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists()) {
            const sData = settingsSnap.data();
            if (sData?.restaurantInfo) {
              restName = sData.restaurantInfo.name || restName;
              restAddr = sData.restaurantInfo.address || restAddr;
            }
          }
        } catch (err) {
          console.warn('Settings load warning:', err);
        }

        // 2. Fetch Invoice Document directly from invoices or invoiceRecords subcollections
        let rawInvoice: any = null;
        try {
          const invoiceRef = doc(db, `restaurants/${restaurantId}/invoices/${invoiceId}`);
          const invoiceSnap = await getDoc(invoiceRef);
          if (invoiceSnap.exists()) {
            rawInvoice = invoiceSnap.data();
          }
        } catch (e) {
          console.warn('Direct invoice fetch warning:', e);
        }

        if (!rawInvoice) {
          try {
            const invoiceRecordRef = doc(db, `restaurants/${restaurantId}/invoiceRecords/${invoiceId}`);
            const invoiceRecordSnap = await getDoc(invoiceRecordRef);
            if (invoiceRecordSnap.exists()) {
              rawInvoice = invoiceRecordSnap.data();
            }
          } catch (e2) {
            console.warn('Direct invoiceRecords fetch warning:', e2);
          }
        }

        // 3. Fallback: Search in orders collection if not found in invoices
        if (!rawInvoice) {
          try {
            // Check direct order ID
            const orderRef = doc(db, `restaurants/${restaurantId}/orders/${invoiceId}`);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
              rawInvoice = orderSnap.data();
            } else {
              // Query by invoiceNumber or orderNumber
              const ordersRef = collection(db, `restaurants/${restaurantId}/orders`);
              const q = query(ordersRef, where('invoiceNumber', '==', invoiceId));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                rawInvoice = qSnap.docs[0].data();
              } else {
                const qOrderNum = query(ordersRef, where('orderNumber', '==', invoiceId));
                const qOrderSnap = await getDocs(qOrderNum);
                if (!qOrderSnap.empty) {
                  rawInvoice = qOrderSnap.docs[0].data();
                }
              }
            }
          } catch (orderErr) {
            console.warn('Orders fallback fetch warning:', orderErr);
          }
        }

        if (!rawInvoice) {
          setError('Invoice not found. Please verify the link or check with the restaurant counter.');
          return;
        }

        // Save PDF data URI if stored
        if (rawInvoice.pdfDataUri) {
          setPdfDataUri(rawInvoice.pdfDataUri);
        }

        // 4. Transform into BrandedInvoiceData
        const itemsList = Array.isArray(rawInvoice.items)
          ? rawInvoice.items.map((it: any) => {
              const qty = it.quantity || 1;
              const rate = it.unitPrice !== undefined ? it.unitPrice : (it.menuItem?.price || it.price || 0);
              return {
                name: it.productName || it.menuItem?.name || it.name || 'Order Item',
                quantity: qty,
                price: rate,
                amount: rate * qty
              };
            })
          : [];

        const subtotalVal = rawInvoice.subtotal !== undefined
          ? rawInvoice.subtotal
          : itemsList.reduce((sum: number, it: any) => sum + it.amount, 0);

        const taxVal = rawInvoice.taxes !== undefined ? rawInvoice.taxes : (rawInvoice.taxAmount || Math.round(subtotalVal * 0.05));
        const totalVal = rawInvoice.totalAmount !== undefined ? rawInvoice.totalAmount : (rawInvoice.total || (subtotalVal + taxVal));

        const structuredData: BrandedInvoiceData = {
          invoiceNumber: rawInvoice.invoiceNumber || rawInvoice.invoiceNo || invoiceId,
          tokenNumber: rawInvoice.orderToken || rawInvoice.tokenNumber || rawInvoice.token || rawInvoice.orderNumber,
          orderNumber: rawInvoice.orderNumber || 'OP-001',
          restaurantName: restName,
          restaurantAddress: restAddr,
          reservationType: rawInvoice.tableNo ? `Dine-In (${rawInvoice.tableNo.replace(/^Table\s*/i, 'T-')})` : (rawInvoice.type || 'Dine-In'),
          timestamp: rawInvoice.timestamp || Date.now(),
          paymentMethod: rawInvoice.paymentMethod || 'UPI',
          items: itemsList,
          subtotal: subtotalVal,
          taxAmount: taxVal,
          taxLabel: 'GST (5%)',
          totalPaid: totalVal,
          paymentStatus: rawInvoice.isPaid || rawInvoice.paymentStatus === 'Paid' ? 'Payment Successful' : 'Payment Pending',
          paidAt: rawInvoice.paymentAt || rawInvoice.timestamp || Date.now()
        };

        setInvoiceData(structuredData);
      } catch (err: any) {
        console.error('Invoice retrieval error:', err);
        setError('Unable to load invoice details. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [invoiceId, restaurantId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (pdfDataUri) {
      try {
        const link = document.createElement('a');
        link.href = pdfDataUri;
        link.download = `Invoice_${invoiceData?.invoiceNumber || invoiceId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Invoice PDF downloaded successfully!');
        return;
      } catch (e) {
        console.warn('Data URI download warning, falling back to client jsPDF:', e);
      }
    }

    // Client-side jsPDF fallback generator
    if (!invoiceData) return;
    try {
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(invoiceData.restaurantName || 'OrderPoint Pro', 40, 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceData.restaurantAddress || '', 40, 15, { align: 'center' });
      
      doc.setFont('helvetica', 'bold');
      doc.text(`INVOICE: ${invoiceData.invoiceNumber}  |  TOKEN: ${invoiceData.tokenNumber}`, 40, 22, { align: 'center' });
      doc.line(5, 25, 75, 25);

      let y = 30;
      doc.setFontSize(8);
      invoiceData.items.forEach(it => {
        doc.text(`${it.name} x${it.quantity}`, 5, y);
        doc.text(`Rs. ${it.amount.toFixed(2)}`, 75, y, { align: 'right' });
        y += 5;
      });

      doc.line(5, y, 75, y);
      y += 5;
      doc.text(`Subtotal:`, 5, y);
      doc.text(`Rs. ${invoiceData.subtotal.toFixed(2)}`, 75, y, { align: 'right' });
      y += 4;
      doc.text(`GST (5%):`, 5, y);
      doc.text(`Rs. ${invoiceData.taxAmount.toFixed(2)}`, 75, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`TOTAL PAID:`, 5, y);
      doc.text(`Rs. ${invoiceData.totalPaid.toFixed(2)}`, 75, y, { align: 'right' });

      doc.save(`Invoice_${invoiceData.invoiceNumber}.pdf`);
      toast.success('Invoice PDF downloaded!');
    } catch (e) {
      console.error(e);
      toast.error('Could not generate PDF.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center gap-3 text-center max-w-xs border border-gray-150">
          <Loader2 className="w-8 h-8 text-[#046c38] animate-spin" />
          <h2 className="text-base font-black text-gray-950">Loading Invoice</h2>
          <p className="text-xs text-gray-400">Retrieving official digital invoice from database...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl p-6 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-gray-950">Invoice Not Available</h2>
          <p className="text-xs text-gray-500">{error || 'Could not find this invoice record.'}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 h-10 rounded-xl bg-black text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer border-none"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] py-4 sm:py-8 px-3 flex flex-col items-center justify-center font-sans print:bg-white print:p-0">
      <BrandedInvoiceCard
        data={invoiceData}
        onPrint={handlePrint}
        onDownloadPDF={handleDownloadPDF}
        showActions={true}
      />
    </div>
  );
}
