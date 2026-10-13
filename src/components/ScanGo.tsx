/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import PageLayout from './PageLayout';
import QRCode from 'qrcode';
import { 
  Download, Copy, Printer, Volume2
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

  const activeTable = customTable.trim() || selectedTable;

  // Build the live QR code URL
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://orderpointpro.in';
  const tableOrderUrl = `${currentOrigin}/?scan=true&restaurantId=${encodeURIComponent(restaurantId || 'default')}&table=${encodeURIComponent(activeTable)}`;

  useEffect(() => {
    QRCode.toDataURL(tableOrderUrl, {
      margin: 1.5,
      width: 280,
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
    window.print();
  };

  return (
    <PageLayout
      title="Scan Now"
      subtitle="Self-ordering system for peak hours."
      id="scango_master_view"
    >
      <div className="space-y-6 pt-2 select-none">
        {/* TOP BAR: TABLE SELECTOR & TEST CHIME */}
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

        {/* SELF ORDER QR CODE CARD (CLEAN & CENTERED) */}
        <div className="flex justify-center pt-2">
          <div className="w-full max-w-md bg-[#0F172A] text-white p-7 sm:p-8 rounded-[32px] text-center shadow-xl border border-slate-800 space-y-6 flex flex-col justify-between">
            <div>
              {/* QR Image Box */}
              <div className="bg-white p-4 rounded-2xl w-48 h-48 flex items-center justify-center mx-auto shadow-md">
                {tableQRDataUrl ? (
                  <img 
                    src={tableQRDataUrl} 
                    alt="Self Order QR Code" 
                    className="w-full h-full object-contain rounded-lg block"
                  />
                ) : (
                  <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <div className="mt-5 space-y-1">
                <h3 className="text-white font-extrabold text-base tracking-tight leading-none uppercase">
                  SELF ORDER
                </h3>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed max-w-[245px] mx-auto">
                  Customers can scan this to view menu and order instantly.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <button
                onClick={handleOpenLiveOrdering}
                className="w-full h-11 bg-white hover:bg-slate-100 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-slate-950/20"
              >
                <span>Click Here</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleDownloadQr}
                  className="h-9 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold rounded-lg text-xs transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download size={13} />
                  <span>PNG</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="h-9 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold rounded-lg text-xs transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>

                <button
                  onClick={handlePrintStandee}
                  className="h-9 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold rounded-lg text-xs transition-all border border-slate-700/80 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* PRINTABLE STANDEE (Triggered on Print) */}
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
            width: 4in !important;
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
          <p className="text-sm font-extrabold text-slate-800 uppercase">
            SELF ORDER
          </p>
          <p className="text-xs text-slate-500">
            Scan to view menu &amp; place order instantly
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
