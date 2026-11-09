/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import PageLayout from './PageLayout';
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Sparkles, 
  Lock, 
  Check, 
  ArrowRight, 
  History, 
  ArrowDownRight, 
  ArrowUpRight 
} from 'lucide-react';
import { formatISTDateTime } from '../lib/dateUtils';
import { InventoryItem, StockTransaction } from '../types';

interface InventoryProps {
  inventoryItems: InventoryItem[];
  stockTransactions?: StockTransaction[];
  onAddStockTransaction?: (tx: StockTransaction) => void;
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventoryItem: (item: InventoryItem) => void;
  onDeleteInventoryItem: (id: string) => void;
  onShowToast: (msg: string) => void;
  subscriptionPlan?: string;
  isExpired?: boolean;
  onUpgradeToPro?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function Inventory({
  inventoryItems,
  stockTransactions = [],
  onAddStockTransaction,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  onShowToast,
  subscriptionPlan = 'pro',
  isExpired = false,
  onUpgradeToPro,
  onNavigateToTab
}: InventoryProps) {
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'history'>('stock');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Quick Stock Adjustment Modal state
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'reduce' | 'set'>('add');
  const [adjustAmount, setAdjustAmount] = useState<string>('5');
  const [adjustReason, setAdjustReason] = useState<string>('Restocked from supplier');

  // Delete Confirm Modal state
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  // Add Item Form state
  const [name, setName] = useState('');
  const [qty, setQty] = useState('15');
  const [limit, setLimit] = useState('10');
  const [unit, setUnit] = useState('kg');
  const [supplier, setSupplier] = useState('');

  // PLAN LOCK GUARD: Basic Plan or Expired License
  const isLocked = subscriptionPlan === 'basic' || isExpired;

  if (isLocked) {
    return (
      <PageLayout
        title="Inventory Register"
        subtitle="Track ingredient stock, low limit alerts, and procurement suppliers."
        activeTab="Inventory"
        onTabChange={onNavigateToTab}
      >
        <div className="max-w-3xl mx-auto my-8 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 rounded-3xl text-white shadow-2xl border border-slate-800 text-center space-y-6 relative overflow-hidden font-sans">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-900/20 animate-pulse">
            <Lock size={38} className="stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block font-mono">
              {isExpired ? 'License Expired' : 'Pro Plan Feature'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Unlock Inventory & Stock Control
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              {isExpired 
                ? 'Your OrderPoint Pro subscription has expired. Please renew your plan to regain access to real-time inventory management.' 
                : 'Inventory Management is exclusive to Pro & Business subscribers. Upgrade your plan to prevent stock shortages and optimize ingredient costs.'}
            </p>
          </div>

          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 text-left max-w-md mx-auto space-y-3 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block font-mono">
              What You Get with Pro Plan:
            </span>
            <ul className="space-y-2.5 text-slate-200">
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>Real-time ingredient depletion & stock tracking</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>Automated Low-Stock alerts & thresholds</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>Procurement supplier directory & logs</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={onUpgradeToPro}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-900/30 transition-all inline-flex items-center gap-2 cursor-pointer active:scale-[0.98] border-none"
            >
              <Sparkles size={16} />
              <span>Upgrade to Pro Plan (₹1499/mo)</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Handle Add New Inventory Item
  const handleAddNewItem = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const quantity = parseFloat(qty) || 0;
    const lowLimit = parseFloat(limit) || 0;
    const statusVal: 'NORMAL' | 'LOW STOCK' | 'OUT OF STOCK' = 
      quantity === 0 ? 'OUT OF STOCK' : (quantity <= lowLimit ? 'LOW STOCK' : 'NORMAL');

    const newItem: InventoryItem = {
      id: 'i_' + Date.now(),
      name: name.trim(),
      quantity,
      lowLimit,
      status: statusVal,
      unit: unit.trim() || 'kg',
      supplier: supplier.trim() || 'House Procurement'
    };

    onAddInventoryItem(newItem);
    onShowToast(`Added ${name} to stock register!`);

    // Log transaction to Firestore
    if (onAddStockTransaction) {
      onAddStockTransaction({
        id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        itemId: newItem.id,
        itemName: newItem.name,
        type: 'IN',
        quantity: quantity,
        prevQuantity: 0,
        newQuantity: quantity,
        reason: 'Initial stock register entry',
        timestamp: Date.now()
      });
    }

    setName('');
    setQty('15');
    setLimit('10');
    setUnit('kg');
    setSupplier('');
    setIsAddModalOpen(false);

    if (statusVal === 'LOW STOCK') {
      onShowToast(`Alert: ${newItem.name} is below low stock threshold!`);
    }
  };

  // Open In-App Adjust Stock Modal
  const openAdjustModal = (item: InventoryItem, mode: 'add' | 'reduce' | 'set' = 'add') => {
    setAdjustingItem(item);
    setAdjustMode(mode);
    setAdjustAmount(mode === 'set' ? String(item.quantity) : '5');
    setAdjustReason(
      mode === 'add' 
        ? 'Supplier Restock' 
        : (mode === 'reduce' ? 'Kitchen Spoilage / Wastage' : 'Physical Inventory Count')
    );
  };

  // Save Stock Adjustment
  const handleSaveStockAdjustment = (e: FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const val = parseFloat(adjustAmount) || 0;
    let newQty = adjustingItem.quantity;
    let txType: 'IN' | 'OUT' = 'IN';

    if (adjustMode === 'add') {
      newQty = parseFloat((adjustingItem.quantity + Math.abs(val)).toFixed(2));
      txType = 'IN';
    } else if (adjustMode === 'reduce') {
      newQty = Math.max(0, parseFloat((adjustingItem.quantity - Math.abs(val)).toFixed(2)));
      txType = 'OUT';
    } else {
      newQty = Math.max(0, parseFloat(val.toFixed(2)));
      txType = newQty >= adjustingItem.quantity ? 'IN' : 'OUT';
    }

    const statusVal: 'NORMAL' | 'LOW STOCK' | 'OUT OF STOCK' = 
      newQty === 0 ? 'OUT OF STOCK' : (newQty <= adjustingItem.lowLimit ? 'LOW STOCK' : 'NORMAL');

    const updatedItem: InventoryItem = {
      ...adjustingItem,
      quantity: newQty,
      status: statusVal
    };

    onUpdateInventoryItem(updatedItem);
    onShowToast(`Updated ${adjustingItem.name} stock: ${newQty} ${adjustingItem.unit}`);

    // Log transaction
    if (onAddStockTransaction) {
      const diff = Math.abs(parseFloat((newQty - adjustingItem.quantity).toFixed(2)));
      if (diff > 0 || adjustMode === 'set') {
        onAddStockTransaction({
          id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          itemId: adjustingItem.id,
          itemName: adjustingItem.name,
          type: txType,
          quantity: diff,
          prevQuantity: adjustingItem.quantity,
          newQuantity: newQty,
          reason: adjustReason.trim() || 'Manual stock adjustment',
          timestamp: Date.now()
        });
      }
    }

    setAdjustingItem(null);
  };

  return (
    <PageLayout
      title="Inventory"
      subtitle="Track stock levels and supplier inventory."
      id="inventory_view"
      activeTab="Inventory"
      onTabChange={onNavigateToTab}
      actions={
        <button
          id="btn_open_add_inventory"
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#111111] hover:bg-black text-white h-8.5 px-4.5 rounded-full text-[11px] font-black tracking-wider flex items-center justify-center gap-1.5 shadow-sm uppercase active:scale-95 cursor-pointer border-none"
        >
          <Plus size={14} className="stroke-[3]" />
          <span>Add Inventory</span>
        </button>
      }
    >

      {/* Navigation Sub-Tabs & Live Stock Health Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 select-none">
        <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('stock')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${
              activeSubTab === 'stock'
                ? 'bg-white text-gray-950 shadow-xs font-black'
                : 'text-gray-500 hover:text-gray-800 bg-transparent'
            }`}
          >
            Current Stock ({inventoryItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'bg-white text-gray-950 shadow-xs font-black'
                : 'text-gray-500 hover:text-gray-800 bg-transparent'
            }`}
          >
            <History size={13} />
            <span>Movement History ({stockTransactions.length})</span>
          </button>
        </div>

        {/* Live inventory health pills */}
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
            In Stock: {inventoryItems.filter(i => i.quantity > i.lowLimit).length}
          </span>
          {inventoryItems.some(i => i.quantity > 0 && i.quantity <= i.lowLimit) && (
            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
              Low: {inventoryItems.filter(i => i.quantity > 0 && i.quantity <= i.lowLimit).length}
            </span>
          )}
          {inventoryItems.some(i => i.quantity === 0) && (
            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full">
              Out of Stock: {inventoryItems.filter(i => i.quantity === 0).length}
            </span>
          )}
        </div>
      </div>

      {activeSubTab === 'stock' ? (
        <>
          {/* MOBILE CARDS VIEW (Clean, touch-friendly, no ugly wrapped tables) */}
          <div className="block md:hidden space-y-3">
            {inventoryItems.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-2xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mx-auto">
                  <Package size={22} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">No Inventory Items</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    Keep track of kitchen ingredients, supplier stock, and low-level alerts.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-950 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-black transition-all cursor-pointer border-none"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              </div>
            ) : (
              inventoryItems.map(item => {
                const isOutOfStock = item.quantity === 0;
                const isLow = !isOutOfStock && item.quantity <= item.lowLimit;
                
                return (
                  <div
                    id={`inventory_card_${item.id}`}
                    key={item.id}
                    className="bg-white border border-gray-100 rounded-2xl p-4 shadow-2xs space-y-3 font-sans"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-950 truncate leading-snug">{item.name}</h4>
                        {item.supplier && (
                          <span className="text-[11px] font-medium text-gray-400 block truncate mt-0.5">{item.supplier}</span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                          isOutOfStock || isLow
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isOutOfStock ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Quantity</span>
                        <span className={`text-sm font-black ${isOutOfStock || isLow ? 'text-rose-600' : 'text-gray-900'}`}>
                          {item.quantity} <span className="text-xs font-semibold text-gray-500">{item.unit || 'units'}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Low Stock Limit</span>
                        <span className="text-sm font-bold text-gray-700">
                          {item.lowLimit} <span className="text-xs font-semibold text-gray-400">{item.unit || 'units'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <button
                        id={`btn_adj_stock_mob_${item.id}`}
                        onClick={() => openAdjustModal(item, 'add')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none"
                      >
                        <Edit2 size={13} />
                        <span>Adjust Stock</span>
                      </button>
                      <button
                        onClick={() => setDeletingItem(item)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW (Spacious, non-wrapping headers, clean typography) */}
          <div className="hidden md:block bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-2xs font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold text-gray-400 uppercase tracking-wider h-14">
                    <th className="py-4 px-6 text-left whitespace-nowrap">ITEM NAME</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">QUANTITY</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">LOW STOCK LIMIT</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">STATUS</th>
                    <th className="py-4 px-6 text-right whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {inventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-gray-400 font-medium space-y-2">
                        <Package size={30} className="mx-auto text-gray-300 mb-2 stroke-[1.5]" />
                        <p className="text-sm font-bold text-gray-800">No items registered in warehouse</p>
                        <p className="text-xs text-gray-400">
                          Click "Add Inventory" above to register stock items.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    inventoryItems.map(item => {
                      const isOutOfStock = item.quantity === 0;
                      const isLow = !isOutOfStock && item.quantity <= item.lowLimit;
                      
                      return (
                        <tr
                          id={`inventory_row_${item.id}`}
                          key={item.id}
                          className="hover:bg-gray-50/50 transition-colors h-16"
                        >
                          {/* Material Name */}
                          <td className="py-4 px-6 text-gray-900 font-bold text-sm">
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              {item.supplier && (
                                <span className="text-[11px] font-normal text-gray-400">{item.supplier}</span>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className={`py-4 px-4 text-center text-sm font-bold ${isOutOfStock || isLow ? 'text-rose-600 font-black' : 'text-gray-900'}`}>
                            {item.quantity} <span className="text-xs font-normal text-gray-500">{item.unit || 'units'}</span>
                          </td>

                          {/* Low Stock Limit */}
                          <td className="py-4 px-4 text-center text-gray-600 font-bold text-sm">
                            {item.lowLimit} <span className="text-xs font-normal text-gray-400">{item.unit || 'units'}</span>
                          </td>

                          {/* Status chip pill */}
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isOutOfStock || isLow
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isOutOfStock ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                            </span>
                          </td>

                          {/* Standard actions icon styling */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-3 text-gray-400">
                              <button
                                id={`btn_adj_stock_${item.id}`}
                                onClick={() => openAdjustModal(item, 'add')}
                                className="hover:text-gray-900 transition-colors cursor-pointer p-1.5 hover:bg-gray-100 rounded-lg border-none bg-transparent"
                                title="Adjust Stock Quantity"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => setDeletingItem(item)}
                                className="hover:text-rose-600 transition-colors cursor-pointer p-1.5 hover:bg-rose-50 rounded-lg border-none bg-transparent"
                                title="Delete Warehousing record"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* LIVE STOCK MOVEMENT HISTORY LEDGER */
        <div className="bg-white border border-gray-150 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in font-sans">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Stock Movement Audit Trail</h3>
              <p className="text-xs text-gray-400">Real-time ledger of orders, restocks, and kitchen adjustments.</p>
            </div>
            <span className="text-[11px] font-mono font-bold text-gray-400">
              {stockTransactions.length} Transactions
            </span>
          </div>

          {stockTransactions.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-2 select-none">
              <History size={32} className="mx-auto text-gray-300 stroke-[1.5]" />
              <p className="text-sm font-bold text-gray-800">No Stock Movements Logged</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Transactions automatically appear here whenever food orders are placed, stock is added, or wastage is recorded.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2">
                    <th className="py-2.5 px-3">Date & Time (IST)</th>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-center">Movement</th>
                    <th className="py-2.5 px-3 text-center">Quantity</th>
                    <th className="py-2.5 px-3 text-center">Stock Level</th>
                    <th className="py-2.5 px-3">Reason / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-sans">
                  {stockTransactions.map(tx => {
                    const isIncoming = tx.type === 'IN';
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-3 text-gray-600 font-medium whitespace-nowrap">
                          {formatISTDateTime(tx.timestamp)}
                        </td>
                        <td className="py-3 px-3 font-bold text-gray-950">
                          {tx.itemName}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            isIncoming
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isIncoming ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                            {isIncoming ? 'Restock / IN' : 'Usage / OUT'}
                          </span>
                        </td>
                        <td className={`py-3 px-3 text-center font-black font-mono ${isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIncoming ? '+' : '-'}{tx.quantity}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-gray-500 font-medium whitespace-nowrap">
                          {tx.prevQuantity} → <strong className="text-gray-900">{tx.newQuantity}</strong>
                        </td>
                        <td className="py-3 px-3 text-gray-700 font-medium max-w-[220px] truncate" title={tx.reason}>
                          {tx.reason || 'General inventory adjustment'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {adjustingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-tight">Adjust Stock Level</h3>
                <p className="text-xs text-gray-500">{adjustingItem.name} (Current: {adjustingItem.quantity} {adjustingItem.unit})</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-3.5">
              {/* Mode Switcher */}
              <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-3 text-center text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('add');
                    setAdjustReason('Supplier Restock');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                    adjustMode === 'add' ? 'bg-emerald-600 text-white shadow-xs font-black' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('reduce');
                    setAdjustReason('Kitchen Spoilage / Wastage');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                    adjustMode === 'reduce' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
                >
                  - Wastage / Out
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('set');
                    setAdjustAmount(String(adjustingItem.quantity));
                    setAdjustReason('Physical Inventory Count');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer border-none ${
                    adjustMode === 'set' ? 'bg-black text-white shadow-xs font-black' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
                >
                  Set Count
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">
                  {adjustMode === 'add' ? 'Quantity to Add' : (adjustMode === 'reduce' ? 'Quantity to Deduct' : 'Exact Count in Stock')} ({adjustingItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950/10 focus:border-gray-950"
                  required
                />
              </div>

              {/* Reason input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Reason / Reference Note</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Amul daily milk delivery"
                  className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/10 focus:border-gray-950"
                />
              </div>

              {/* Preview stock calculation */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-150 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Resulting Stock:</span>
                <span className="font-mono font-black text-gray-950">
                  {adjustMode === 'add' 
                    ? parseFloat((adjustingItem.quantity + (parseFloat(adjustAmount) || 0)).toFixed(2))
                    : (adjustMode === 'reduce'
                      ? Math.max(0, parseFloat((adjustingItem.quantity - (parseFloat(adjustAmount) || 0)).toFixed(2)))
                      : Math.max(0, parseFloat(adjustAmount) || 0)
                    )} {adjustingItem.unit}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-black text-white font-bold text-xs hover:bg-neutral-800 border-none cursor-pointer"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-950">Delete {deletingItem.name}?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to remove this item from your warehouse register?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="h-10 rounded-xl bg-[#991B1B] hover:bg-[#7F1D1D] text-white font-bold text-xs transition-colors border-none cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteInventoryItem(deletingItem.id);
                  onShowToast(`Deleted ${deletingItem.name} from inventory`);
                  setDeletingItem(null);
                }}
                className="h-10 rounded-xl bg-[#065F46] hover:bg-[#064E3B] text-white font-bold text-xs transition-colors border-none cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD INVENTORY MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-fade-in space-y-5 text-gray-900">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="text-emerald-600" size={18} />
                <h3 className="text-base font-bold text-gray-900">Add Inventory Stock</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewItem} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase block">Item / Ingredient Name</label>
                <input
                  id="modal_stock_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fresh Milk, Paneer, Basmati Rice"
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500 placeholder:text-gray-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block">Opening Stock</label>
                  <input
                    id="modal_stock_qty"
                    type="number"
                    step="any"
                    min="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block">Low Stock Limit</label>
                  <input
                    id="modal_stock_limit"
                    type="number"
                    step="any"
                    min="0"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block">Unit</label>
                  <input
                    id="modal_stock_unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="kg, ltr, pcs"
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block">Supplier Partner</label>
                  <input
                    id="modal_stock_supplier"
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. Amul Corp"
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <button
                id="modal_save_stock_btn"
                type="submit"
                className="w-full h-11 bg-[#111111] hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] border-none cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus size={14} className="stroke-[2.5]" />
                <span>Add Inventory</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
