/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import PageLayout from './PageLayout';
import { Package, Search, Plus, Edit2, Trash2, X, AlertTriangle, Sparkles, Filter, Lock, Check, ArrowRight, ShieldAlert } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form state
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
        <div className="max-w-3xl mx-auto my-8 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 rounded-3xl text-white shadow-2xl border border-slate-800 text-center space-y-6 relative overflow-hidden">
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
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-900/30 transition-all inline-flex items-center gap-2 cursor-pointer active:scale-[0.98]"
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

  const filteredItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNewItem = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const quantity = Number(qty) || 0;
    const lowLimit = Number(limit) || 0;
    const statusVal = quantity <= lowLimit ? 'LOW STOCK' : 'NORMAL';

    const newItem: InventoryItem = {
      id: 'i_' + Date.now(),
      name,
      quantity,
      lowLimit,
      status: statusVal as 'NORMAL' | 'LOW STOCK',
      unit,
      supplier: supplier.trim() || 'House Procurement'
    };

    onAddInventoryItem(newItem);
    onShowToast(`Added ${name} to stock register!`);

    // Log transaction
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
      onShowToast(`Alert: ${name} is below low stock threshold!`);
    }
  };

  const handleAdjustQuantity = (item: InventoryItem) => {
    const input = prompt(`Update stock quantity for ${item.name}:`, String(item.quantity));
    if (input !== null) {
      const quantity = Number(input) || 0;
      const statusVal = (quantity <= item.lowLimit ? 'LOW STOCK' : 'NORMAL') as 'NORMAL' | 'LOW STOCK';
      const updatedItem = {
        ...item,
        quantity,
        status: statusVal
      };
      onUpdateInventoryItem(updatedItem);
      onShowToast(`Adjusted ${item.name} stock level to ${quantity}`);

      // Log transaction
      if (onAddStockTransaction) {
        const diff = quantity - item.quantity;
        if (diff !== 0) {
          onAddStockTransaction({
            id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            itemId: item.id,
            itemName: item.name,
            type: diff > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(diff),
            prevQuantity: item.quantity,
            newQuantity: quantity,
            reason: 'Manual stock adjustment',
            timestamp: Date.now()
          });
        }
      }

      if (statusVal === 'LOW STOCK') {
        onShowToast(`Alert: ${item.name} stock level is LOW!`);
      }
    }
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

      {/* Item count status bar (Search bar removed per requirements) */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Warehouse Inventory Registry
        </span>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          {filteredItems.length} {filteredItems.length === 1 ? 'Item' : 'Items'}
        </span>
      </div>

      {/* MOBILE CARDS VIEW (Clean, touch-friendly, no ugly wrapped tables) */}
      <div className="block md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mx-auto">
              <Package size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {searchQuery ? 'No matching items found' : 'No Inventory Items'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                {searchQuery ? `No records found matching "${searchQuery}".` : 'Keep track of kitchen ingredients, supplier stock, and low-level alerts.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-950 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-black transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(item => {
            const isOutOfStock = item.quantity === 0;
            const isLow = !isOutOfStock && item.quantity <= item.lowLimit;
            
            return (
              <div
                id={`inventory_card_${item.id}`}
                key={item.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-2xs space-y-3"
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
                    onClick={() => handleAdjustQuantity(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Adjust Stock</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${item.name} from warehouse listings?`)) {
                        onDeleteInventoryItem(item.id);
                        onShowToast(`Deleted ${item.name}`);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
      <div className="hidden md:block bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-2xs">
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
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-400 font-medium space-y-2">
                    <Package size={30} className="mx-auto text-gray-300 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-bold text-gray-800">
                      {searchQuery ? 'No matching inventory items found' : 'No items registered in warehouse'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {searchQuery ? 'Try adjusting your search query.' : 'Click "Add Inventory" above to register stock items.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
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

                      {/* Quantity: dynamic red if low limit reached */}
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
                            onClick={() => handleAdjustQuantity(item)}
                            className="hover:text-gray-900 transition-colors cursor-pointer p-1.5 hover:bg-gray-100 rounded-lg"
                            title="Adjust Stock Quantity"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${item.name} from warehouse listings?`)) {
                                onDeleteInventoryItem(item.id);
                                onShowToast(`Deleted ${item.name} list reference`);
                              }
                            }}
                            className="hover:text-rose-600 transition-colors cursor-pointer p-1.5 hover:bg-rose-50 rounded-lg"
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

      {/* Add Inventory Drawer overlay modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-fade-in space-y-6 text-gray-900">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="text-emerald-600" size={18} />
                <h3 className="text-lg font-bold text-gray-900">Add Inventory Stock</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase block">Material/Item Name</label>
                <input
                  id="modal_stock_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wheat flour / Sugar"
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500 placeholder:text-gray-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block">Quantity</label>
                  <input
                    id="modal_stock_qty"
                    type="number"
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
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block">Unit (e.g. kg, L)</label>
                  <input
                    id="modal_stock_unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
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
                className="w-full h-10 bg-[#111111] hover:bg-black text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] border-none cursor-pointer flex items-center justify-center gap-1.5"
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
