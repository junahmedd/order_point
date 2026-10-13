/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import PageLayout from './PageLayout';
import QRCode from 'qrcode';
import { 
  Clock, Download, Copy, ExternalLink, Printer, 
  Volume2, ShieldCheck, CheckCircle2, XCircle, UtensilsCrossed, AlertCircle
} from 'lucide-react';
import { MenuItem, ActiveSelfOrder, Order, InventoryItem } from '../types';
import { soundAlert } from '../lib/soundAlert';

interface ScanGoProps {
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  activeSelfOrders: ActiveSelfOrder[];
  orders: Order[];
  onAddOrder: (order: Order) => Promise<void>;
  onPlaceSelfOrder: (customerName: string, phone: string, tableNo: string, items: { menuItem: MenuItem; quantity: number }[]) => void;
  onApproveSelfOrder: (id: string) => void;
  onDeclineSelfOrder: (id: string) => void;
  onShowToast: (msg: string) => void;
  restaurantId: string;
}

const DEFAULT_TABLES = [
  'Table 01', 'Table 02', 'Table 03', 'Table 04',
  'Table 05', 'Table 06', 'Table 07', 'Table 08'
];

export default function ScanGo({
  menuItems,
  inventoryItems,
  activeSelfOrders,
  orders,
  onAddOrder,
  onPlaceSelfOrder,
  onApproveSelfOrder,
  onDeclineSelfOrder,
  onShowToast,
  restaurantId,
}: ScanGoProps) {
  const [selectedTable, setSelectedTable] = useState<string>('Table 01');
  const [customTable, setCustomTable] = useState<string>('');
  const [tableQRDataUrl, setTableQRDataUrl] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Sound chime tracking for incoming orders
  const prevCountRef = useRef(activeSelfOrders.length);
  useEffect(() => {
    if (activeSelfOrders.length > prevCountRef.current) {
      soundAlert.playNewOrderBell();
      onShowToast('🔔 New Customer QR Order Received!');
    }
    prevCountRef.current = activeSelfOrders.length;
  }, [activeSelfOrders.length, onShowToast]);

  const activeTable = customTable.trim() || selectedTable;

  // Build the live QR code URL
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://orderpointpro.in';
  const tableOrderUrl = `${currentOrigin}/?scan=true&restaurantId=${encodeURIComponent(restaurantId || 'default')}&table=${encodeURIComponent(activeTable)}`;

  useEffect(() => {
    QRCode.toDataURL(tableOrderUrl, {
      margin: 1.5,
      width: 320,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    })
    .then(url => setTableQRDataUrl(url))
    .catch(err => console.error('Failed to generate table QR code', err));
  }, [tableOrderUrl]);

  // Actions
  const handleCopyLink = () => {
    navigator.clipboard.writeText(tableOrderUrl);
    onShowToast(`Copied QR ordering link for ${activeTable}!`);
  };

  const handleDownloadQr = () => {
    if (!tableQRDataUrl) return;
    const a = document.createElement('a');
    a.href = tableQRDataUrl;
    a.download = `OrderPoint_${activeTable.replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onShowToast(`Downloaded QR Code for ${activeTable}`);
  };

  const handleOpenLiveOrdering = () => {
    window.open(tableOrderUrl, '_blank');
    onShowToast(`Opened customer ordering tab for ${activeTable}`);
  };

  const handlePrintStandee = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <PageLayout
      title="Scan Now"
      subtitle="Self-ordering QR codes with instant Google Pay & Live Kitchen Dispatch."
      id="scango_master_view"
    >
      <div className="space-y-6 pt-2">
        {/* TOP BAR: TABLE SELECTOR & AUDIO CONTROLS */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Select Table:
            </span>
            {DEFAULT_TABLES.map(tab => (
              <button
                key={tab}
                onClick={() => { setSelectedTable(tab); setCustomTable(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 border ${
                  activeTable === tab
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <input
                type="text"
                placeholder="Custom (e.g. T-12)"
                value={customTable}
                onChange={(e) => setCustomTable(e.target.value)}
                className="w-28 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                soundAlert.playNewOrderBell();
                onShowToast('Test chime played!');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Test restaurant order bell sound"
            >
              <Volume2 size={14} className="text-blue-600" />
              <span>Test Chime</span>
            </button>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: TABLE QR STANDEE CARD */}
          <div className="lg:col-span-4 bg-[#0B1528] text-white p-6 sm:p-7 rounded-[28px] text-center shadow-xl border border-slate-800 space-y-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800/50">
                  {activeTable} Standee
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <ShieldCheck size={12} /> Live QR Active
                </span>
              </div>

              {/* QR Image Box */}
              <div className="bg-white p-3.5 rounded-2xl w-52 h-52 flex items-center justify-center mx-auto shadow-2xl relative group">
                {tableQRDataUrl ? (
                  <img 
                    src={tableQRDataUrl} 
                    alt={`Order QR code for ${activeTable}`} 
                    className="w-full h-full object-contain rounded-lg block"
                  />
                ) : (
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <div className="mt-4 space-y-1">
                <h3 className="text-white font-black text-lg tracking-tight uppercase">
                  SELF ORDER — {activeTable}
                </h3>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed max-w-[280px] mx-auto">
                  Diners scan this QR to browse live dishes, place orders, and pay via Google Pay / Counter.
                </p>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={handleOpenLiveOrdering}
                className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-900/40"
              >
                <ExternalLink size={14} />
                <span>Open Live Ordering Page</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleDownloadQr}
                  className="h-9 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold rounded-lg text-[11px] transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-1"
                  title="Download PNG for printing"
                >
                  <Download size={13} />
                  <span>PNG</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="h-9 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold rounded-lg text-[11px] transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-1"
                  title="Copy table link to clipboard"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>

                <button
                  onClick={handlePrintStandee}
                  className="h-9 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold rounded-lg text-[11px] transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-1"
                  title="Print Table Tent Standee"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ACTIVE INCOMING SELF-ORDERS */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between pl-1">
              <div className="flex items-center gap-2 text-slate-700 font-black uppercase tracking-wider text-xs">
                <Clock size={15} className="text-blue-600 stroke-[2.5]" />
                <span>Incoming Self-Orders</span>
                <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                  {activeSelfOrders.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-bold">
                Auto-syncs live with Firestore
              </span>
            </div>

            <div className="min-h-[460px] flex flex-col justify-start w-full bg-white border border-slate-200/90 rounded-[28px] p-5 sm:p-6 shadow-xs">
              {activeSelfOrders.length === 0 ? (
                <div className="text-center py-28 space-y-3 my-auto">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <UtensilsCrossed size={26} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-sm text-slate-700">
                      No active self-orders right now
                    </p>
                    <p className="font-sans text-xs text-slate-400 font-medium max-w-sm mx-auto">
                      When customers scan a table QR code and confirm their cart, orders will immediately arrive here with an audio alert.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {activeSelfOrders.map(so => {
                    const isPaid = (so as any).isPaid || (so as any).paymentStatus === 'PAID' || (so as any).paymentStatus === 'Paid';
                    const token = (so as any).orderToken || (so as any).token || 'A001';
                    const payMethod = (so as any).paymentMethod || (isPaid ? 'Google Pay' : 'Pay at Counter');

                    return (
                      <div 
                        key={so.id} 
                        className="p-4 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl flex flex-col gap-3 transition-all text-left shadow-2xs justify-between relative overflow-hidden"
                      >
                        {/* Status bar top */}
                        <div className={`absolute top-0 left-0 right-0 h-1 ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />

                        <div className="space-y-2 pt-1 font-sans">
                          {/* Header row: Token & Table */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-black bg-blue-600 text-white px-2 py-0.5 rounded font-mono shadow-2xs">
                                TOKEN #{token}
                              </span>
                              <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase leading-none">
                                {so.tableNo || so.tableNumber || 'Table 01'}
                              </span>
                            </div>
                            <span className="text-sm font-black text-slate-900 font-mono">
                              ₹{so.total || 0}
                            </span>
                          </div>

                          {/* Customer & Payment details */}
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="font-extrabold text-slate-800 truncate max-w-[130px]">
                              {so.customerName || 'Guest Diner'}
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase leading-none border ${
                              isPaid 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isPaid ? 'PAID (GPay)' : 'PAY AT COUNTER'}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 font-medium">
                            Phone: {so.customerPhone || 'N/A'} • {so.items ? so.items.length : 0} items
                          </div>

                          {/* Items row */}
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/80">
                            {so.items?.map((item, id) => (
                              <span key={id} className="text-[9.5px] font-bold bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded">
                                {item.menuItem.name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={() => onDeclineSelfOrder(so.id)}
                            className="bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 h-8 px-3 text-[11px] font-extrabold uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <XCircle size={13} />
                            <span>Decline</span>
                          </button>
                          <button
                            onClick={() => onApproveSelfOrder(so.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3.5 text-[11px] font-extrabold uppercase rounded-lg transition-all cursor-pointer border-none shadow-xs flex items-center gap-1.5"
                          >
                            <CheckCircle2 size={13} />
                            <span>Accept &amp; Kitchen</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* PRINTABLE STAND-ALONE STANDEE (Triggered on Print) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable_standee_card, #printable_standee_card * {
            visibility: visible !important;
          }
          #printable_standee_card {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 4.5in !important;
            border: 2px solid #000 !important;
            padding: 24px !important;
            border-radius: 16px !important;
            text-align: center !important;
            background: #fff !important;
            color: #000 !important;
            display: block !important;
          }
        }
      `}</style>

      {/* Hidden container for print */}
      <div id="printable_standee_card" className="hidden">
        <div className="text-center space-y-3 font-sans">
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            OrderPoint Pro
          </h2>
          <div className="inline-block bg-black text-white text-base font-black px-4 py-1 rounded-full uppercase tracking-wider">
            {activeTable}
          </div>
          <div className="py-2">
            {tableQRDataUrl && (
              <img 
                src={tableQRDataUrl} 
                alt="Table QR" 
                className="w-48 h-48 mx-auto object-contain border border-slate-300 p-2 rounded-xl"
              />
            )}
          </div>
          <p className="text-sm font-extrabold text-slate-800">
            SCAN TO ORDER &amp; PAY
          </p>
          <p className="text-xs text-slate-500">
            Open camera or Google Pay • Choose your dishes • Pay via Google Pay or at Counter
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
