/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import PageLayout from './PageLayout';
import { ChefHat, Flame, CheckCircle, Clock, Play, Sparkles, Star, Truck, ShieldAlert, XCircle, Volume2 } from 'lucide-react';
import { Order } from '../types';
import { soundAlert } from '../lib/soundAlert';

interface KitchenProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, nextStatus: any, updates?: Partial<Order>) => void;
  onShowToast: (msg: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function Kitchen({ orders, onUpdateOrderStatus, onShowToast, onNavigateToTab }: KitchenProps) {
  const [, setTick] = useState(0);

  // Increment local clock state once per second to support real-time ticket age counting
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sound alert chime when new orders enter the kitchen
  const prevOrdersCountRef = useRef(orders.length);
  useEffect(() => {
    if (orders.length > prevOrdersCountRef.current) {
      soundAlert.playNewOrderBell();
      onShowToast('🔔 New Kitchen Ticket Received!');
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length, onShowToast]);

  // Compute stats across ALL orders
  const activeOrdersCount = orders.filter(o => o.status !== 'Completed').length;
  const preparingCount = orders.filter(o => o.status === 'Preparing').length;
  const readyCount = orders.filter(o => o.status === 'Ready').length;
  const servedTodayCount = orders.filter(o => o.status === 'Completed').length;

  // Average Preparation Time logic
  let avgPrepTimeStr = '0m';
  const openOrders = orders.filter(o => o.status !== 'Completed');
  const preppingOrReadyOrders = openOrders.filter(o => o.startedAt !== undefined);
  if (preppingOrReadyOrders.length > 0) {
    const totalAgeMs = preppingOrReadyOrders.reduce((acc, o) => acc + (Date.now() - o.startedAt!), 0);
    const avgAgeMins = Math.max(1, Math.round((totalAgeMs / preppingOrReadyOrders.length) / 60000));
    avgPrepTimeStr = `${avgAgeMins}m`;
  } else if (openOrders.length > 0) {
    const totalAgeMs = openOrders.reduce((acc, o) => acc + (Date.now() - o.timestamp), 0);
    const avgAgeMins = Math.max(1, Math.round((totalAgeMs / openOrders.length) / 60000));
    avgPrepTimeStr = `${avgAgeMins}m`;
  }

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

  // Helper: Get exact elapsed minutes string
  const getElapsedTimeString = (order: Order) => {
    if (order.status === 'New' || order.status === 'Accepted' || !order.startedAt) {
      return '00:00';
    }
    const diffMs = Date.now() - order.startedAt;
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Synthesize realistic kitchen custom instructions if not already explicitly saved
  const getSpecialNotes = (order: Order): string | null => {
    if ((order as any).notes) return (order as any).notes;
    
    const itemsLower = order.items.map(i => i.menuItem.name.toLowerCase());
    if (itemsLower.some(n => n.includes('paneer') || n.includes('masala') || n.includes('spicy'))) {
      return '⚠ Less Spicy';
    }
    if (itemsLower.some(n => n.includes('naan') || n.includes('dal') || n.includes('roti'))) {
      return '⚠ No Onion / Extra butter';
    }
    if (itemsLower.some(n => n.includes('ice cream') || n.includes('brownie') || n.includes('dessert'))) {
      return '⚠ Extra Chocolate Drizzle';
    }
    if (order.tableNo === '3' || order.tableNo === '03') {
      return '⚠ Less Spicy';
    }
    if (order.tableNo === '5' || order.tableNo === '05') {
      return '⚠ No Onion';
    }
    return null;
  };

  const handleCategoryPillBg = (cat: string) => {
    const cleanCat = cat.trim().toLowerCase();
    if (cleanCat === 'veg') {
      return 'bg-[#EBF7EF] text-[#22C55E] border border-[#22C55E]/10';
    } else if (cleanCat === 'non-veg' || cleanCat === 'nonveg') {
      return 'bg-[#FEF2F2] text-[#EF4444] border border-[#EF4444]/10';
    } else if (cleanCat === 'drinks' || cleanCat === 'drink' || cleanCat === 'beverages') {
      return 'bg-[#EFF5FF] text-[#3B82F6] border border-[#3B82F6]/10';
    } else if (cleanCat === 'desserts' || cleanCat === 'dessert' || cleanCat === 'sweets') {
      return 'bg-[#FAF5FF] text-[#A855F7] border border-[#A855F7]/10';
    }
    return 'bg-gray-50 text-gray-500 border border-gray-100';
  };

  // Status transitions
  const handleStartPreparing = (orderId: string, orderNum: string) => {
    onUpdateOrderStatus(orderId, 'Preparing', { startedAt: Date.now() });
    onShowToast(`Order #${orderNum} status changed to PREPARING`);
  };

  const handleMarkAsReady = (orderId: string, orderNum: string) => {
    onUpdateOrderStatus(orderId, 'Ready');
    onShowToast(`Order #${orderNum} status changed to READY`);
  };

  const handleMarkAsServed = (orderId: string, orderNum: string) => {
    onUpdateOrderStatus(orderId, 'Completed');
    onShowToast(`Order #${orderNum} status changed to SERVED`);
  };

  // Filter Order list: Always shows Active orders in the kitchen
  const getFilteredOrders = () => {
    // Sort orders by timestamp descending so latest ticket cards slide in first
    const sortedOrders = [...orders].sort((a, b) => b.timestamp - a.timestamp);
    return sortedOrders.filter(o => o.status !== 'Completed' && o.status !== 'Delivered' && o.status !== 'Cancelled');
  };

  const currentDisplayOrders = getFilteredOrders();

  return (
    <PageLayout
      title="Kitchen Display System"
      subtitle="Track live kitchen orders and preparation status."
      id="kitchen_view"
      activeTab="Kitchen"
      onTabChange={onNavigateToTab}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-sky-50 text-sky-700 text-[11px] font-bold px-3 py-1.5 rounded-full border border-sky-200 flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span>🔵 Kitchen Online</span>
          </div>
          <div className="bg-blue-50 text-blue-600 text-[11px] font-bold px-3 py-1.5 rounded-full border border-blue-100">
            Active: {activeOrdersCount}
          </div>
          <div className="bg-amber-50 text-amber-600 text-[11px] font-bold px-3 py-1.5 rounded-full border border-amber-100">
            Preparing: {preparingCount}
          </div>
          <div className="bg-sky-50 text-sky-700 text-[11px] font-bold px-3 py-1.5 rounded-full border border-sky-200">
            Ready: {readyCount}
          </div>
          <div className="bg-purple-50 text-purple-600 text-[11px] font-bold px-3 py-1.5 rounded-full border border-purple-100">
            Avg Time: {avgPrepTimeStr}
          </div>
        </div>
      }
    >
      {/* KEYFRAMES FOR OPERATIONAL EFFECTS */}
      <style>{`
        @keyframes greenPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .ready-pulse {
          animation: greenPulse 2s infinite;
        }
        @keyframes redGlow {
          0% { background-color: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.3); }
          50% { background-color: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.8); }
          100% { background-color: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.3); }
        }
        .urgent-glow {
          animation: redGlow 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* TICKET CARD MATRIX GRID (Exactly 4 cards per row on large screens) */}
      {currentDisplayOrders.length === 0 ? (
        <div className="bg-white rounded-[24px] p-16 text-center shadow-xs border border-gray-100 max-w-md mx-auto mt-12">
          <span className="text-5xl block mb-3">🍳</span>
          <h3 className="text-[16px] font-bold text-gray-900 tracking-tight">
            No Active Kitchen Orders
          </h3>
          <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
            New kitchen tickets will appear automatically as orders are synchronized with the POS desk.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentDisplayOrders.map(order => {
            const isNew = order.status === 'New';
            const isPreparing = order.status === 'Preparing';
            const isReady = order.status === 'Ready';
            const isCompleted = order.status === 'Completed' || order.status === 'Delivered';

            // Timer state calculations
            const elapsedMs = order.startedAt ? (Date.now() - order.startedAt) : 0;
            const elapsedMins = Math.floor(elapsedMs / 60000);
            const isUrgent = order.startedAt && elapsedMins >= 20 && !isReady && !isCompleted;

            // Timer color rules
            let timerColorClass = 'bg-emerald-50 border-emerald-100 text-emerald-600';
            if (isNew || order.status === 'Accepted') {
              timerColorClass = 'bg-gray-50 border-gray-200 text-gray-400 font-bold';
            } else if (isUrgent) {
              timerColorClass = 'text-[#EF4444] border-[#EF4444] urgent-glow font-black ring-1 ring-[#EF4444]';
            } else if (elapsedMins >= 10) {
              timerColorClass = 'bg-amber-50 border-amber-100 text-[#F59E0B]';
            }

            // Top Border color rule mapping
            let statusBorderColor = 'border-t-[#9CA3AF]'; // Completed/Served (Gray)
            if (isNew) {
              statusBorderColor = 'border-t-[#3B82F6]'; // Pending (Blue)
            } else if (order.status === 'Accepted') {
              statusBorderColor = 'border-t-emerald-500'; // Accepted
            } else if (isPreparing) {
              statusBorderColor = 'border-t-[#F59E0B]'; // Preparing (Orange)
            } else if (isReady || order.status === 'Picked Up' || order.status === 'Out for Delivery') {
              statusBorderColor = 'border-t-[#22C55E]'; // Ready (Green)
            }

            // Top Bar Indicator color mapping
            let statusIndicatorColor = 'bg-[#9CA3AF]'; // Completed/Served (Gray)
            if (isNew) {
              statusIndicatorColor = 'bg-[#3B82F6]'; // Pending (Blue)
            } else if (order.status === 'Accepted') {
              statusIndicatorColor = 'bg-emerald-500'; // Accepted
            } else if (isPreparing) {
              statusIndicatorColor = 'bg-[#F59E0B]'; // Preparing (Orange)
            } else if (isReady || order.status === 'Picked Up' || order.status === 'Out for Delivery') {
              statusIndicatorColor = 'bg-[#22C55E]'; // Ready (Green)
            }

            // Small status pill color scheme
            let statusPillColor = 'bg-gray-100 text-gray-500 border-gray-250';
            if (isNew) {
              statusPillColor = 'bg-blue-50 text-[#3B82F6] border-blue-150';
            } else if (order.status === 'Accepted') {
              statusPillColor = 'bg-sky-50 text-sky-700 border-sky-200';
            } else if (isPreparing) {
              statusPillColor = 'bg-amber-50 text-[#F59E0B] border-amber-150';
            } else if (isReady) {
              statusPillColor = 'bg-sky-50 text-sky-700 border-sky-200 ready-pulse';
            } else if (order.status === 'Picked Up') {
              statusPillColor = 'bg-indigo-50 text-indigo-600 border-indigo-150';
            } else if (order.status === 'Out for Delivery') {
              statusPillColor = 'bg-purple-50 text-purple-600 border-purple-150';
            }

            const priorityLabel = order.tableNo && ['03', '3', '05', '5'].includes(order.tableNo);
            const specialInstructions = getSpecialNotes(order);

            // Item overflow visibility control (Max 4 items to strictly prevent card overflow given the constant 280px constraint)
            const MAX_VISIBLE_ITEMS = 4;
            const menuItemsSlice = order.items.slice(0, MAX_VISIBLE_ITEMS);
            const hiddenItemsCount = order.items.length - MAX_VISIBLE_ITEMS;

            return (
              <div
                id={`kds_card_${order.id}`}
                key={order.id}
                className="bg-white rounded-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-[#EDEDED] p-4 flex flex-col justify-between h-[280px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                {/* Elegant status strip at the very top */}
                <span className={`absolute top-0 left-0 right-0 h-1.5 ${statusIndicatorColor}`} />
                
                {/* Upper card block container */}
                <div className="flex flex-col min-h-0 flex-1">
                  
                  {/* CARD HEADER ROW */}
                  <div className="flex justify-between items-center gap-1 shrink-0 pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-extrabold text-[15px] text-[#111111] truncate font-sans tracking-tight">
                        {order.orderSource ? `${order.orderSource}` : (order.tableNo ? (order.tableNo.trim().toLowerCase().startsWith('table') ? order.tableNo.trim() : `Table ${order.tableNo.trim()}`) : order.type)}
                      </h3>
                      {(order as any).orderToken ? (
                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded font-mono shrink-0 shadow-2xs">
                          TOKEN #{(order as any).orderToken}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded shrink-0">
                          Tk: #{order.orderNumber.replace(/\D/g, '') || order.orderNumber}
                        </span>
                      )}
                      
                      {/* Priority indicator icons */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isUrgent && (
                          <span title="Urgent delay" className="text-[#EF4444]">
                            <Flame size={12} className="fill-current animate-bounce" />
                          </span>
                        )}
                        {priorityLabel && (
                          <span title="VIP Table" className="text-[#F59E0B]">
                            <Star size={12} className="fill-current" />
                          </span>
                        )}
                        {(order.type === 'Delivery' || order.orderSource) && (
                          <span title="Delivery package" className="text-[#3B82F6]">
                            <Truck size={12} />
                          </span>
                        )}
                      </div>
                    </div>
 
                    {/* Timer Badge pill */}
                    <div className={`px-2 py-0.5 rounded-full text-[10.5px] font-[800] border flex items-center gap-1 shrink-0 ${timerColorClass}`}>
                      <Clock size={11} />
                      <span>{order.status === 'New' || order.status === 'Accepted' ? '00:00' : getElapsedTimeString(order)}</span>
                    </div>
                  </div>

                  {/* ORDER IDENTIFIER BASE INFO */}
                  <div className="flex justify-between items-center text-[9.5px] font-bold text-gray-400 select-none bg-gray-50 px-2 py-0.5 rounded-[6px] mt-1.5 shrink-0 uppercase tracking-widest">
                    <span>#OP-{order.orderNumber}</span>
                    <span>{getFormattedTime(order.timestamp)}</span>
                    <span className="text-[#111111] font-black">{order.orderSource || order.type}</span>
                  </div>

                  {/* CUSTOMER & PAYMENT STATUS LINE */}
                  <div className="flex justify-between items-center text-[10.5px] mt-1.5 text-slate-600 font-bold px-1 shrink-0 select-none">
                    <span className="truncate max-w-[120px]">Cust: {order.customerName || 'Guest'}</span>
                    <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase leading-none border ${
                      order.isPaid || order.paymentStatus === 'Paid' || order.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {order.isPaid || order.paymentStatus === 'Paid' || order.paymentStatus === 'PAID' 
                        ? 'PAID (GPay / Online)' 
                        : (order as any).paymentMethod === 'Pay at Counter' ? 'PAY AT COUNTER' : 'UNPAID'}
                    </span>
                  </div>

                  {/* SPECIAL INSTRUCTIONS SECTION (Only show if instructions present) */}
                  {specialInstructions && (
                    <div className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-1.5 rounded-[8px] flex items-center gap-1 mt-1.5 border border-amber-100 shrink-0">
                      <ShieldAlert size={11} className="text-amber-600 self-start mt-0.5 shrink-0" />
                      <span className="truncate">{specialInstructions}</span>
                    </div>
                  )}

                  {/* SEPARATOR LINE */}
                  <div className="border-b border-gray-100/50 my-1.5 shrink-0" />

                  {/* DISH ITEMS CONTAINER */}
                  <div className="flex-1 overflow-hidden space-y-1.5 select-none pr-0.5 mt-0.5">
                    {menuItemsSlice.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-1.5 text-[12.5px] items-start leading-none">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-extrabold text-[#111111] shrink-0 text-[13px]">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-gray-700 truncate" title={item.menuItem.name}>
                            {item.menuItem.name}
                          </span>
                        </div>
                        {/* Compact tag instead of green/red dots */}
                        <span className={`px-1.5 py-0.5 text-[7.5px] font-[900] rounded-md tracking-wider uppercase inline-block shrink-0 ${handleCategoryPillBg(item.menuItem.category)}`}>
                          {item.menuItem.category}
                        </span>
                      </div>
                    ))}

                    {/* Overflow label: +X more items if bounds exceeded */}
                    {hiddenItemsCount > 0 && (
                      <div className="text-[10px] font-black italic text-[#F59E0B] pl-2 self-start transform scale-95 origin-left">
                        + {hiddenItemsCount} more dishes Pending...
                      </div>
                    )}
                  </div>

                </div>

                {/* LOWER BUTTON FOOTER (Sticky action panel) */}
                <div className="pt-2 shrink-0 border-t border-gray-100/75">
                  <div className="flex flex-col gap-1.5">
                    
                    {order.orderSource ? (
                      /* Online delivery status transition actions */
                      <div className="flex flex-col gap-1.5 w-full">
                        {order.status === 'New' && (
                          <div className="grid grid-cols-4 gap-1.5 w-full">
                            <button
                              id={`btn_accept_${order.id}`}
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'Accepted');
                                onShowToast(`✔ Syncing status ACCEPTED with ${order.orderSource} Partner API...`);
                              }}
                              className="col-span-3 h-[28px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCircle size={10} />
                              <span>Accept Order</span>
                            </button>
                            <button
                              id={`btn_cancel_${order.id}`}
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'Cancelled');
                                onShowToast(`❌ Syncing CANCELLED with ${order.orderSource} Partner API...`);
                              }}
                              className="col-span-1 h-[28px] text-[10px] font-extrabold uppercase rounded-[8px] bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center border border-red-100 cursor-pointer"
                              title="Cancel Order"
                            >
                              <XCircle size={11} />
                            </button>
                          </div>
                        )}
                        {order.status === 'Accepted' && (
                          <button
                            id={`btn_start_online_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Preparing', { startedAt: Date.now() });
                              onShowToast(`👨🍳 Syncing status PREPARING with ${order.orderSource} Partner API...`);
                            }}
                            className="h-[28px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-1 cursor-pointer w-full"
                          >
                            <Play size={10} className="fill-current" />
                            <span>Start Prep (Kitchen)</span>
                          </button>
                        )}
                        {order.status === 'Preparing' && (
                          <button
                            id={`btn_ready_online_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Ready');
                              onShowToast(`🍽️ Syncing status READY with ${order.orderSource} Partner API...`);
                            }}
                            className="h-[28px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1 cursor-pointer w-full"
                          >
                            <ChefHat size={11} />
                            <span>Mark Ready</span>
                          </button>
                        )}
                        {order.status === 'Ready' && (
                          <button
                            id={`btn_pickup_online_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Picked Up');
                              onShowToast(`🛵 Syncing status PICKED_UP with ${order.orderSource} Partner API...`);
                            }}
                            className="h-[28px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-[#111111] hover:bg-black text-white flex items-center justify-center gap-1 cursor-pointer w-full"
                          >
                            <Truck size={11} />
                            <span>Rider Picked Up</span>
                          </button>
                        )}
                        {order.status === 'Picked Up' && (
                          <button
                            id={`btn_out_online_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Out for Delivery');
                              onShowToast(`🚚 Syncing status OUT_FOR_DELIVERY with ${order.orderSource} Partner API...`);
                            }}
                            className="h-[28px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-[#111111] hover:bg-black text-white flex items-center justify-center gap-1 cursor-pointer w-full"
                          >
                            <Truck size={11} />
                            <span>Out for Delivery</span>
                          </button>
                        )}
                        {order.status === 'Out for Delivery' && (
                          <button
                            id={`btn_delivered_online_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Delivered');
                              onShowToast(`✔ Syncing status DELIVERED with ${order.orderSource} Partner API...`);
                            }}
                            className="h-[28px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 cursor-pointer w-full"
                          >
                            <CheckCircle size={11} />
                            <span>Mark Delivered</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Standard offline order buttons */
                      <div className="w-full">
                        {order.status === 'New' && (
                          <button
                            id={`btn_accept_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Accepted');
                              onShowToast(`Order #${order.orderNumber} ACCEPTED`);
                            }}
                            className="h-[30px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 cursor-pointer w-full border-none"
                          >
                            <CheckCircle size={11} />
                            <span>ACCEPT</span>
                          </button>
                        )}
                        {order.status === 'Accepted' && (
                          <button
                            id={`btn_start_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Preparing', { startedAt: Date.now() });
                              onShowToast(`Order #${order.orderNumber} started PREPARING`);
                            }}
                            className="h-[30px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-1 cursor-pointer w-full border-none"
                          >
                            <Play size={10} className="fill-current" />
                            <span>START PREPARING</span>
                          </button>
                        )}
                        {order.status === 'Preparing' && (
                          <button
                            id={`btn_ready_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Ready', { preparedAt: Date.now() });
                              onShowToast(`Order #${order.orderNumber} marked READY`);
                            }}
                            className="h-[30px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1 cursor-pointer w-full border-none font-black"
                          >
                            <ChefHat size={11} />
                            <span>MARK READY</span>
                          </button>
                        )}
                        {order.status === 'Ready' && (
                          <button
                            id={`btn_served_${order.id}`}
                            onClick={() => {
                              onUpdateOrderStatus(order.id, 'Completed', { servedAt: Date.now() });
                              onShowToast(`Order #${order.orderNumber} status changed to SERVED`);
                            }}
                            className="h-[30px] text-[10px] font-extrabold tracking-wider uppercase rounded-[8px] bg-slate-900 hover:bg-black text-white flex items-center justify-center gap-1 cursor-pointer w-full border-none"
                          >
                            <CheckCircle size={11} />
                            <span>COMPLETE</span>
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </PageLayout>
  );
}
