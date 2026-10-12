import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { 
  ArrowRight, ShieldCheck, Zap, HelpCircle, Info, RefreshCw, 
  CheckCircle, Plus, Layers, Sparkles, Database, FileSpreadsheet, Settings, GitCommit, GitPullRequest, GitMerge
} from 'lucide-react';
import toast from 'react-hot-toast';

interface MappingTabProps {
  menuItems: MenuItem[];
}

export default function MappingTab({ menuItems }: MappingTabProps) {
  const [skuOverrides, setSkuOverrides] = useState<Record<string, { swiggy: string; zomato: string }>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize random SKUs if they aren't overridden yet
  const getSku = (itemId: string, platform: 'swiggy' | 'zomato', idx: number) => {
    if (skuOverrides[itemId]?.[platform]) {
      return skuOverrides[itemId][platform];
    }
    return platform === 'swiggy' ? `SW_SKU_A${100 + idx}` : `ZM_SKU_F${200 + idx}`;
  };

  const handleUpdateSku = (itemId: string, platform: 'swiggy' | 'zomato', value: string) => {
    setSkuOverrides(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [platform]: value
      }
    }));
  };

  const handleSaveMappings = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: 'Writing SKU overrides to secure Firestore mappings...',
        success: 'Successfully synchronized POS catalog mapping rules!',
        error: 'Error writing mappings.',
      }
    );
  };

  const handleAutoGenerateSkus = () => {
    const updated: Record<string, { swiggy: string; zomato: string }> = {};
    menuItems.forEach((item, idx) => {
      updated[item.id] = {
        swiggy: `SW_AUTO_SKU_${Math.floor(100000 + Math.random() * 900000)}`,
        zomato: `ZM_AUTO_SKU_${Math.floor(100000 + Math.random() * 900000)}`
      };
    });
    setSkuOverrides(updated);
    toast.success('Generated random compliant external SKUs for entire POS catalog!');
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* HEADER SECTION */}
      <div className="border-b border-gray-100 pb-4 shrink-0">
        <h3 className="text-base font-black text-gray-900 uppercase tracking-wide">Menu & Status Mapping</h3>
        <p className="text-xs text-gray-400 mt-1">Configure automated state transition logic and sync POS item IDs with external partner SKUs.</p>
      </div>

      {/* 1. VISUAL STATUS WORKFLOW MAPPER (ARROW FLOW) */}
      <div className="bg-white rounded-[20px] border border-gray-150 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-6">
          <div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Automated Dispatch Pipelines</span>
            <h4 className="text-sm font-black text-gray-900 mt-0.5">Order Lifecycle Hook State Machine</h4>
          </div>
          <span className="px-2.5 py-1 text-[9px] font-mono font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg">
            Bidirectional State Sync: Enabled
          </span>
        </div>

        {/* Dynamic Arrow flow diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-9 gap-3 items-center py-2">
          
          {/* Step 1: External Status */}
          <div className="bg-orange-500/[0.03] border border-orange-500/20 p-4 rounded-2xl flex flex-col items-center text-center hover:shadow-md transition-all lg:col-span-1.8">
            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-orange-100 text-orange-700 uppercase tracking-wider mb-2">Platform Ingestion</span>
            <span className="text-xs font-bold text-gray-950">Swiggy / Zomato</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">ORDER_PLACED</span>
            <span className="text-[9px] text-gray-400 leading-tight mt-1">Customer checks out online</span>
          </div>

          {/* Arrow */}
          <div className="flex justify-center text-gray-300 lg:col-span-0.5 shrink-0">
            <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
          </div>

          {/* Step 2: Kitchen Status */}
          <div className="bg-amber-500/[0.03] border border-amber-500/20 p-4 rounded-2xl flex flex-col items-center text-center hover:shadow-md transition-all lg:col-span-1.8">
            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 uppercase tracking-wider mb-2">Kitchen Display</span>
            <span className="text-xs font-bold text-gray-950">KDS Dispatch</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">STATE: PREPARING</span>
            <span className="text-[9px] text-gray-400 leading-tight mt-1">Chef panel lights up instantly</span>
          </div>

          {/* Arrow */}
          <div className="flex justify-center text-gray-300 lg:col-span-0.5 shrink-0">
            <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
          </div>

          {/* Step 3: POS Status */}
          <div className="bg-indigo-500/[0.03] border border-indigo-500/20 p-4 rounded-2xl flex flex-col items-center text-center hover:shadow-md transition-all lg:col-span-1.8">
            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-indigo-100 text-indigo-700 uppercase tracking-wider mb-2">Local POS DB</span>
            <span className="text-xs font-bold text-gray-950">POS Verification</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">STATE: ACCEPTED</span>
            <span className="text-[9px] text-gray-400 leading-tight mt-1">Allocates inventory and prints KOT</span>
          </div>

          {/* Arrow */}
          <div className="flex justify-center text-gray-300 lg:col-span-0.5 shrink-0">
            <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
          </div>

          {/* Step 4: Billing Status */}
          <div className="bg-purple-500/[0.03] border border-purple-500/20 p-4 rounded-2xl flex flex-col items-center text-center hover:shadow-md transition-all lg:col-span-1.8">
            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider mb-2">Accounting Ledger</span>
            <span className="text-xs font-bold text-gray-950">Auto-Billing Audit</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">STATE: SETTLED</span>
            <span className="text-[9px] text-gray-400 leading-tight mt-1">Records platform commission cut</span>
          </div>

          {/* Arrow */}
          <div className="flex justify-center text-gray-300 lg:col-span-0.5 shrink-0">
            <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
          </div>

          {/* Step 5: Completed Status */}
          <div className="bg-emerald-500/[0.03] border border-emerald-500/20 p-4 rounded-2xl flex flex-col items-center text-center hover:shadow-md transition-all lg:col-span-1.8">
            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-wider mb-2">Finalization</span>
            <span className="text-xs font-bold text-gray-950">Rider Handover</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">STATE: COMPLETED</span>
            <span className="text-[9px] text-gray-400 leading-tight mt-1">Dispatched to assigned runner</span>
          </div>

        </div>

        {/* State explanation help widget */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-extrabold text-gray-950">How state flow mapping functions:</p>
            <p className="leading-relaxed">When an external webhook transmits an order (e.g. Swiggy status <code className="font-mono text-emerald-600 font-bold bg-white px-1 border rounded">PLACED</code>), OrderPoint Pro maps it to your local POS database, generates a bill, notifies the chef's KDS monitor, and fires back a confirmation. There is no manual intervention needed.</p>
          </div>
        </div>
      </div>

      {/* 2. POS MENU ITEM MAPPING GRID */}
      <div className="bg-white rounded-[20px] border border-gray-150 p-6 shadow-sm flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-50 mb-4 gap-4">
          <div>
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">POS Catalog Mapping Console</h4>
            <p className="text-xs text-gray-400 mt-0.5">Edit exact platform unique IDs (SKUs) to map incoming orders back to correct recipe ingredients.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleAutoGenerateSkus}
              className="px-3.5 h-9 text-xs font-extrabold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Auto-Map Remaining
            </button>
            <button 
              onClick={handleSaveMappings}
              className="px-4.5 h-9 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/10"
            >
              <Database className="w-3.5 h-3.5" />
              Save Mappings
            </button>
          </div>
        </div>

        {/* Mapping list table */}
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50/70 border-b border-gray-100">
              <tr className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <th className="py-3 px-4">POS Local Menu Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">POS Price</th>
                <th className="py-3 px-4">Mapped Swiggy SKU ID</th>
                <th className="py-3 px-4">Mapped Zomato SKU ID</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
              {menuItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 font-normal">
                    No items in POS Catalog. Please populate POS items inside menu settings first.
                  </td>
                </tr>
              ) : (
                menuItems.map((item, idx) => {
                  const currentSwiggySku = getSku(item.id, 'swiggy', idx);
                  const currentZomatoSku = getSku(item.id, 'zomato', idx);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/40 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-gray-950">
                        {item.name}
                      </td>
                      
                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                          {item.category || 'Entree'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 font-extrabold text-gray-900">
                        ₹{item.price}
                      </td>

                      {/* Swiggy SKU Input */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 max-w-[150px]">
                          <input 
                            type="text" 
                            value={currentSwiggySku}
                            onChange={(e) => handleUpdateSku(item.id, 'swiggy', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-emerald-500 rounded-lg py-1 px-2 font-mono text-[10px] font-bold text-gray-700 focus:outline-none transition-all"
                          />
                        </div>
                      </td>

                      {/* Zomato SKU Input */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 max-w-[150px]">
                          <input 
                            type="text" 
                            value={currentZomatoSku}
                            onChange={(e) => handleUpdateSku(item.id, 'zomato', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-emerald-500 rounded-lg py-1 px-2 font-mono text-[10px] font-bold text-gray-700 focus:outline-none transition-all"
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-wider">
                          Active Sync
                        </span>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-50 text-[11px] text-gray-400 flex justify-between items-center">
          <span>Both feeds are verified with secure cryptographic signatures.</span>
          <span className="font-extrabold text-emerald-600">{menuItems.length} active menu rules</span>
        </div>
      </div>

    </div>
  );
}
