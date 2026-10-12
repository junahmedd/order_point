import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  FileText, 
  Download, 
  CheckCircle, 
  Calendar, 
  Smartphone, 
  MapPin, 
  ArrowLeft, 
  User, 
  CreditCard, 
  Loader2,
  UtensilsCrossed,
  Printer,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LiveInvoiceViewerProps {
  invoiceId: string;
  restaurantId: string;
  onClose?: () => void;
}

export default function LiveInvoiceViewer({ invoiceId, restaurantId, onClose }: LiveInvoiceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [restaurantName, setRestaurantName] = useState('The Royal Feast');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true);
        setError(null);

        // Fetch Restaurant Info
        try {
          const settingsRef = doc(db, `settings/${restaurantId}`);
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists()) {
            const sData = settingsSnap.data();
            if (sData?.restaurantInfo) {
              setRestaurantName(sData.restaurantInfo.name || 'The Royal Feast');
              setRestaurantPhone(sData.restaurantInfo.phone || '');
              setRestaurantAddress(sData.restaurantInfo.address || '');
            }
          }
        } catch (err) {
          console.error("Error loading restaurant info via Firestore:", err);
        }

        // Fetch Invoice Document
        try {
          const invoiceRef = doc(db, `restaurants/${restaurantId}/invoices/${invoiceId}`);
          const invoiceSnap = await getDoc(invoiceRef);

          if (invoiceSnap.exists()) {
            setInvoice(invoiceSnap.data());
          } else {
            setError("Invoice not found. Please verify the URL or contact the restaurant.");
          }
        } catch (fbErr: any) {
          console.warn("Client-side direct Firestore fetch failed:", fbErr);
          setError("Invoice could not be found or retrieved. Please verify the URL or contact the restaurant.");
        }
      } catch (err: any) {
        console.error("Error loading invoice:", err);
        setError("Unable to load invoice. Please check your internet connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [invoiceId, restaurantId]);

  const handleDownloadPDF = () => {
    if (!invoice?.pdfDataUri) {
      toast.error("Pre-rendered PDF not available for this invoice.");
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = invoice.pdfDataUri;
      link.download = `Invoice_${invoice.invoiceNo || invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF Invoice downloaded successfully!");
    } catch (err) {
      console.error("Error downloading PDF:", err);
      toast.error("Failed to trigger automatic download.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-100">Loading Your Invoice</h2>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">Retrieving secure record from cloud database...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500" />
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-6">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 mb-2">Invoice Error</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">{error || "Something went wrong."}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to App</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const formattedDate = invoice.timestamp 
    ? new Date(invoice.timestamp).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    : 'N/A';

  const formattedTime = invoice.timestamp
    ? new Date(invoice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8 flex items-center justify-center print:bg-white print:text-black">
      {/* Background gradients for aesthetic design */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none print:hidden" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none print:hidden" />

      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative print:bg-white print:border-none print:shadow-none print:rounded-none">
        
        {/* Banner header */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-emerald-600/10 via-teal-900/10 to-transparent border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6 print:from-transparent print:to-transparent print:border-b-2 print:border-black print:text-black print:p-0 print:pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black tracking-wider uppercase print:hidden">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Payment Successful</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-100 print:text-black">{restaurantName}</h1>
            {restaurantAddress && (
              <p className="text-slate-400 text-xs flex items-center gap-1.5 print:text-black">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                <span>{restaurantAddress}</span>
              </p>
            )}
            {restaurantPhone && (
              <p className="text-slate-400 text-xs flex items-center gap-1.5 print:text-black">
                <Smartphone className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                <span>Phone: {restaurantPhone}</span>
              </p>
            )}
          </div>

          <div className="text-left md:text-right space-y-1.5 md:self-end">
            <span className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-black block">Tax Invoice</span>
            <div className="text-xl font-mono font-black text-emerald-400 print:text-black">
              {invoice.invoiceNo || 'INV-TEMP'}
            </div>
            <div className="text-xs text-slate-400 flex items-center md:justify-end gap-1.5 print:text-black">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{formattedDate} at {formattedTime}</span>
            </div>
          </div>
        </div>

        {/* Customer & Session Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 md:p-8 bg-slate-900/50 border-b border-slate-800/80 print:bg-transparent print:border-b-2 print:border-black print:px-0">
          <div className="space-y-3">
            <h3 className="text-slate-500 font-mono text-[9px] uppercase tracking-widest font-black">Customer Details</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-slate-200 font-semibold print:text-black">
                <User className="w-4 h-4 text-slate-500" />
                <span>{invoice.customerName || 'Walk-In Customer'}</span>
              </div>
              {invoice.customerPhone && (
                <div className="text-xs text-slate-400 font-mono flex items-center gap-2 print:text-black">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span>+91 {invoice.customerPhone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 sm:border-l sm:border-slate-800/80 sm:pl-6 print:border-black print:pl-6">
            <h3 className="text-slate-500 font-mono text-[9px] uppercase tracking-widest font-black">Table / Order Info</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-slate-200 font-semibold print:text-black">
                <UtensilsCrossed className="w-4 h-4 text-slate-500" />
                <span>Table: {invoice.tableNo || 'Takeaway'}</span>
              </div>
              <div className="text-xs text-slate-400 font-mono flex items-center gap-2 print:text-black">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>Settled via {invoice.paymentMethod || 'UPI Digital'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Itemized list of orders */}
        <div className="p-6 md:p-8 space-y-4 print:px-0">
          <h3 className="text-slate-500 font-mono text-[9px] uppercase tracking-widest font-black mb-1">Itemized Summary</h3>
          <div className="border border-slate-800 rounded-2xl overflow-hidden print:border-black">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 text-xs font-bold font-mono print:bg-transparent print:border-b-2 print:border-black print:text-black">
                  <th className="py-3.5 px-4">Item Name</th>
                  <th className="py-3.5 px-4 text-center w-20">Qty</th>
                  <th className="py-3.5 px-4 text-right w-24">Price</th>
                  <th className="py-3.5 px-4 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 print:divide-black">
                {invoice.items?.map((item: any, idx: number) => {
                  const name = item.productName || item.menuItem?.name || 'Menu Item';
                  const quantity = item.quantity || 1;
                  const price = item.unitPrice !== undefined ? item.unitPrice : (item.menuItem?.price || 0);
                  const itemTotal = price * quantity;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/10 text-slate-200 text-sm print:text-black">
                      <td className="py-3.5 px-4 font-medium text-left">
                        <div>{name}</div>
                        {item.size && (
                          <span className="inline-block mt-0.5 text-[8.5px] font-black uppercase bg-indigo-500/10 border border-solid border-indigo-500/20 text-indigo-400 px-1.5 py-0.2 rounded print:text-black print:border-black">
                            {item.size}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 print:text-black">{quantity}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 print:text-black">₹{price.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-200 print:text-black">₹{itemTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial calculations summary block */}
        <div className="p-6 md:p-8 bg-slate-950/40 border-t border-slate-800/80 flex justify-end print:bg-transparent print:border-t-2 print:border-black print:px-0">
          <div className="w-full sm:w-80 space-y-3 text-sm">
            <div className="flex justify-between items-center text-slate-400 print:text-black">
              <span>Subtotal</span>
              <span className="font-mono">₹{invoice.subtotal?.toFixed(2) || '0.00'}</span>
            </div>

            {invoice.gst > 0 && (
              <div className="flex justify-between items-center text-slate-400 print:text-black">
                <span>Inclusive Tax</span>
                <span className="font-mono">₹{invoice.gst?.toFixed(2) || '0.00'}</span>
              </div>
            )}

            {invoice.discount > 0 && (
              <div className="flex justify-between items-center text-rose-400 font-semibold print:text-black">
                <span>Adjustment Discount</span>
                <span className="font-mono">-₹{invoice.discount?.toFixed(2) || '0.00'}</span>
              </div>
            )}

            <div className="border-t border-slate-800/80 my-1 pt-3 flex justify-between items-center text-slate-100 print:border-black print:text-black">
              <span className="font-bold text-base">Grand Total Paid</span>
              <span className="font-mono font-black text-xl text-emerald-400 print:text-black">
                ₹{invoice.total?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Download and Share CTA buttons */}
        <div className="p-6 bg-slate-950 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div className="text-slate-400 text-xs font-mono text-center sm:text-left">
            <span>Powered securely by </span>
            <span className="font-black text-emerald-400">OrderPoint Pro</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              type="button"
              className="flex-1 sm:flex-initial h-11 px-5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Print Receipt</span>
            </button>

            {invoice.pdfDataUri && (
              <button
                onClick={handleDownloadPDF}
                type="button"
                className="flex-1 sm:flex-initial h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Invoice</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer brand appreciation signature note */}
        <div className="p-6 bg-slate-900 border-t border-slate-850 text-center text-[11px] text-slate-500 leading-relaxed print:bg-white print:border-t-2 print:border-black print:text-black print:px-0">
          <p className="font-medium">Thank you for dining with *{restaurantName}* ❤️</p>
          <p className="mt-1">We appreciate your visit and look forward to welcoming you back soon!</p>
        </div>

      </div>
    </div>
  );
}
