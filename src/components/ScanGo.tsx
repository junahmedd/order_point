/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import PageLayout from './PageLayout';
import QRCode from 'qrcode';
import { 
  Clock
} from 'lucide-react';
import { MenuItem, ActiveSelfOrder, Order, InventoryItem } from '../types';

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
  // Customer State Selection & QR parameters
  const [tableQRDataUrl, setTableQRDataUrl] = useState<string>('');

  useEffect(() => {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://orderpointpro.in';
    const universalUrl = `${currentOrigin}/?scan=true&restaurantId=${restaurantId || 'default'}`;
    QRCode.toDataURL(universalUrl, {
      margin: 1.5,
      width: 250,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    })
    .then(url => setTableQRDataUrl(url))
    .catch(err => console.error('Failed to generate table QR code', err));
  }, [restaurantId]);

  return (
    <PageLayout
      title="Scan Now"
      subtitle="Self-ordering system for peak hours."
      id="scango_master_view"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4 items-start select-none">
        
        {/* LEFT COLUMN: SELF ORDER QR CODE CARD */}
        <div className="md:col-span-4 bg-[#0F172A] text-white p-8 rounded-[32px] text-center shadow-xl border border-slate-800 space-y-6 flex flex-col justify-between min-h-[450px]">
          
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

          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-white font-extrabold text-base tracking-tight leading-none uppercase">
                SELF ORDER
              </h3>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed max-w-[245px] mx-auto">
                Customers can scan this to view menu and order instantly.
              </p>
            </div>
          </div>

          {/* Test Link Button */}
          <button
            onClick={() => {
              const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://orderpointpro.in';
              const universalUrl = `${currentOrigin}/?scan=true&restaurantId=${restaurantId || 'default'}`;
              window.open(universalUrl, '_blank');
              onShowToast('Opened self-ordering link in a new tab!');
            }}
            className="w-full h-11 bg-white hover:bg-slate-100 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-slate-950/20"
          >
            <span>Open Ordering Link</span>
          </button>
        </div>

        {/* RIGHT COLUMN: ACTIVE SELF-ORDERS */}
        <div className="md:col-span-8 space-y-4">
          <div className="flex items-center gap-2 text-slate-500 font-extrabold uppercase tracking-wider text-[11px] select-none pl-1">
            <Clock size={14} className="text-slate-400 stroke-[2.5]" />
            <span>Active Self-Orders</span>
          </div>

          <div className="min-h-[450px] flex flex-col justify-center select-none w-full bg-white border border-slate-200 rounded-[32px] p-6 shadow-xs">
            {activeSelfOrders.length === 0 ? (
              <div className="text-center py-24">
                <p className="font-sans text-xs text-slate-400 font-semibold italic">
                  No active self-orders at the moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {activeSelfOrders.map(so => (
                  <div 
                    key={so.id} 
                    className="p-4 bg-slate-50 border border-slate-150 hover:border-slate-300 rounded-2xl flex flex-col gap-3.5 transition-all text-left shadow-2xs justify-between"
                  >
                    <div className="space-y-1 font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-slate-900 text-xs truncate max-w-[130px]">{so.customerName}</span>
                          <span className="text-[8.5px] font-black bg-amber-500 text-white px-2 py-0.5 rounded leading-none uppercase">
                            {so.tableNo || so.tableNumber || 'Table 1'}
                          </span>
                        </div>
                        <span className="text-xs font-black text-slate-900 font-mono font-extrabold">₹{so.total || 0}</span>
                      </div>
                      <span className="text-[9.5px] text-slate-400 block font-semibold leading-none">
                        Contact: {so.customerPhone || 'N/A'} • {so.items ? so.items.length : 0} item(s) logged
                      </span>
                      
                      {/* Items row */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {so.items?.map((item, id) => (
                          <span key={id} className="text-[9px] font-black bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            {item.menuItem.name} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => onDeclineSelfOrder(so.id)}
                        className="bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 h-7 p-0.5 px-3 text-[10px] font-black uppercase rounded-lg transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => onApproveSelfOrder(so.id)}
                        className="bg-[#0F172A] hover:bg-black text-white h-7 p-0.5 px-3 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer border-none shadow-xs"
                      >
                        Accept &amp; Kitchen Send
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </PageLayout>
  );
}
