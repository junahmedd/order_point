/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import PageLayout from './PageLayout';
import { useSettings } from '../hooks/useSettings';
import { Store, LayoutDashboard, MonitorDot, Trash2, Plus, CheckCircle, Save, Receipt, Phone, Mail, MapPin, Hash, IndianRupee } from 'lucide-react';
import { TableConfig, Order, MenuItem } from '../types';
import { motion } from 'motion/react';

type SettingsTab = 'profile' | 'tables' | 'system';

interface SettingsViewProps {
  orders?: Order[];
  menuItems?: MenuItem[];
  onAddOrderToKitchen?: (order: any) => Promise<void>;
  onShowToast?: (msg: string) => void;
  activeSection?: SettingsTab;
  onSectionChange?: (section: SettingsTab) => void;
  onGoToDashboard?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function SettingsView({
  orders,
  menuItems,
  onAddOrderToKitchen,
  onShowToast,
  activeSection,
  onSectionChange,
  onGoToDashboard,
  onNavigateToTab
}: SettingsViewProps) {
  const { data, loading, updateData, saveSection, saveMultipleSections, savingSection } = useSettings();
  const [localActiveTab, setLocalActiveTab] = useState<SettingsTab>('profile');
  const activeTab = activeSection || localActiveTab;
  const setActiveTab = onSectionChange || setLocalActiveTab;

  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const triggerSuccessPopup = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessPopup(true);
    setTimeout(() => {
      setShowSuccessPopup(false);
    }, 1800);
  };

  const handleSave = async (section: any, label: string) => {
    await saveSection(section);
    triggerSuccessPopup(`${label} saved successfully!`);
  };

  const handleSaveMultiple = async (sections: any[], label: string) => {
    await saveMultipleSections(sections);
    triggerSuccessPopup(`${label} saved successfully!`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-64 text-emerald-600 gap-4">
        <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-xs text-gray-500">Loading settings...</p>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: React.FC<any> }[] = [
    { id: 'profile', label: 'Restaurant Profile', icon: Store },
    { id: 'tables', label: 'Tables & Seating', icon: LayoutDashboard },
    { id: 'system', label: 'Preferences & Tax', icon: MonitorDot },
  ];

  return (
    <PageLayout
      title="Settings"
      subtitle="Manage restaurant profile, dining tables, and system preferences."
      id="settings_master_view"
      customPadding="p-3 sm:p-6 flex-1 flex flex-col min-h-0 overflow-y-auto"
      activeTab="Settings"
      onTabChange={onNavigateToTab}
      pillVariant="green"
      actions={
        <button
          onClick={() => onNavigateToTab?.('Dashboard')}
          className="h-8.5 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer border border-gray-200"
        >
          <LayoutDashboard size={13} className="stroke-[2.5]" />
          <span>Dashboard</span>
        </button>
      }
    >
      <div className="w-full max-w-4xl mx-auto space-y-4 pb-12">
        
        {/* Sleek Segmented Navigation Pills */}
        <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border-none ${
                  isActive
                    ? 'bg-[#091E42] text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 bg-transparent'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-6">
          
          {/* 1. RESTAURANT PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-base font-black text-gray-900 tracking-tight">General Restaurant Information</h2>
                <p className="text-xs text-gray-400 font-medium">Used on customer bills, digital QR ordering, and tax invoices.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Restaurant Name */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Store size={12} className="text-gray-400" />
                    <span>Restaurant Name</span>
                  </label>
                  <input
                    type="text"
                    value={data.restaurantInfo.name || ''}
                    onChange={(e) => updateData('restaurantInfo', 'name', e.target.value)}
                    placeholder="e.g. Tropical Cafe"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>

                {/* Owner Name */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <span>Owner / Manager Name</span>
                  </label>
                  <input
                    type="text"
                    value={data.restaurantInfo.ownerName || ''}
                    onChange={(e) => updateData('restaurantInfo', 'ownerName', e.target.value)}
                    placeholder="e.g. Mohammed Zaid"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Phone size={12} className="text-gray-400" />
                    <span>Contact Phone</span>
                  </label>
                  <input
                    type="tel"
                    value={data.restaurantInfo.phone || ''}
                    onChange={(e) => updateData('restaurantInfo', 'phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Mail size={12} className="text-gray-400" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={data.restaurantInfo.email || ''}
                    onChange={(e) => updateData('restaurantInfo', 'email', e.target.value)}
                    placeholder="contact@restaurant.com"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>

                {/* Restaurant Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400" />
                    <span>Restaurant Physical Address</span>
                  </label>
                  <input
                    type="text"
                    value={data.restaurantInfo.address || ''}
                    onChange={(e) => updateData('restaurantInfo', 'address', e.target.value)}
                    placeholder="Shop #12, High Street, Commercial Area, City"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>

                {/* FSSAI / Reg. Number */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Hash size={12} className="text-gray-400" />
                    <span>FSSAI License / GSTIN</span>
                  </label>
                  <input
                    type="text"
                    value={data.restaurantInfo.regNumber || ''}
                    onChange={(e) => updateData('restaurantInfo', 'regNumber', e.target.value)}
                    placeholder="e.g. 10020042000123"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>

                {/* UPI Payment ID */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <IndianRupee size={12} className="text-gray-400" />
                    <span>Google Pay / UPI ID</span>
                  </label>
                  <input
                    type="text"
                    value={data.payment?.upiId || ''}
                    onChange={(e) => updateData('payment', 'upiId', e.target.value)}
                    placeholder="e.g. restaurant@okaxis"
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  disabled={!!savingSection}
                  onClick={() => handleSaveMultiple(['restaurantInfo', 'payment'], 'Restaurant profile & UPI details')}
                  className="h-10 px-5 bg-[#091E42] hover:bg-[#071735] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 border-none cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  <Save size={13} />
                  <span>{savingSection ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. TABLE MANAGEMENT TAB */}
          {activeTab === 'tables' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-gray-900 tracking-tight">Dine-In Tables Configuration</h2>
                  <p className="text-xs text-gray-400 font-medium">Configure tables for POS dining orders and QR customer ordering.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = (data.tables?.length || 0) + 1;
                    const nextName = nextNum < 10 ? `Table 0${nextNum}` : `Table ${nextNum}`;
                    const newTable = { id: `t${Date.now()}`, name: nextName };
                    updateData('tables', '', [...(data.tables || []), newTable]);
                  }}
                  className="h-8.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border-none cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span>Add Table</span>
                </button>
              </div>

              {/* Table Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {data.tables?.map((table: TableConfig, index: number) => (
                  <div
                    key={table.id}
                    className="p-2.5 bg-gray-50 hover:bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs transition-all"
                  >
                    <input
                      type="text"
                      className="bg-transparent text-xs font-bold text-gray-900 flex-1 outline-none min-w-0 border-b border-transparent focus:border-blue-500 focus:bg-white rounded px-1 py-0.5"
                      value={table.name}
                      onChange={(e) => {
                        const newTables = [...data.tables];
                        newTables[index] = { ...table, name: e.target.value };
                        updateData('tables' as any, '', newTables);
                      }}
                    />
                    <button
                      className="text-gray-300 hover:text-rose-600 p-1 cursor-pointer transition-colors bg-transparent border-none shrink-0"
                      title="Delete Table"
                      onClick={() => {
                        const newTables = data.tables.filter((_: any, i: number) => i !== index);
                        updateData('tables' as any, '', newTables);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-semibold">Total active tables: {data.tables?.length || 0}</span>
                <button
                  disabled={!!savingSection}
                  onClick={() => handleSave('tables' as any, 'Table seating list')}
                  className="h-10 px-5 bg-[#091E42] hover:bg-[#071735] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 border-none cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  <Save size={13} />
                  <span>{savingSection === 'tables' ? 'Saving...' : 'Save Tables'}</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* 3. SYSTEM PREFERENCES & TAX TAB */}
          {activeTab === 'system' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-base font-black text-gray-900 tracking-tight">Billing, Taxes &amp; Preferences</h2>
                <p className="text-xs text-gray-400 font-medium">Configure GST rates, currency symbols, and receipts.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Preferred Currency */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 block">Currency Symbol</label>
                  <select
                    value={data.prefCurrency || '₹'}
                    onChange={(e) => updateData('prefCurrency' as any, '', e.target.value)}
                    className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:bg-white"
                  >
                    <option value="₹">₹ (INR - Indian Rupee)</option>
                    <option value="$">$ (USD - US Dollar)</option>
                    <option value="€">€ (EUR - Euro)</option>
                    <option value="£">£ (GBP - British Pound)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                  </select>
                </div>

                {/* GST Tax Rate */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 block">GST / Tax Rate (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={data.gstTax?.gstRate !== undefined ? data.gstTax.gstRate : 5}
                      onChange={(e) => updateData('gstTax', 'gstRate', Number(e.target.value))}
                      className="w-full h-9.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:bg-white"
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700 shrink-0">
                      <input
                        type="checkbox"
                        checked={data.gstTax?.taxEnabled !== false}
                        onChange={(e) => updateData('gstTax', 'taxEnabled', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>Apply Tax</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Toggles List */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="pref_autoprint"
                    checked={data.preferences?.autoPrint || false}
                    onChange={(e) => updateData('preferences', 'autoPrint', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-gray-800">Prompt browser printing automatically upon bill payment</span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="pref_compact"
                    checked={data.preferences?.compactMode || false}
                    onChange={(e) => updateData('preferences', 'compactMode', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-gray-800">Compact high-density cards for tablets &amp; compact screens</span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  disabled={!!savingSection}
                  onClick={() => handleSaveMultiple(['preferences', 'gstTax', 'prefCurrency'], 'System preferences & GST tax')}
                  className="h-10 px-5 bg-[#091E42] hover:bg-[#071735] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 border-none cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  <Save size={13} />
                  <span>{savingSection ? 'Saving...' : 'Save Preferences'}</span>
                </button>
              </div>
            </motion.div>
          )}

        </div>

      </div>

      {/* Success Popup Modal */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs z-[9999] animate-fade-in p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center max-w-xs w-full text-center border-t-4 border-t-emerald-500"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3 text-emerald-500">
              <CheckCircle size={28} className="stroke-[2.5]" />
            </div>
            <h3 className="text-gray-950 font-black text-base tracking-tight mb-1">
              Settings Updated!
            </h3>
            <p className="text-gray-500 text-xs font-medium px-2 leading-relaxed">
              {successMessage}
            </p>
          </motion.div>
        </div>
      )}
    </PageLayout>
  );
}
