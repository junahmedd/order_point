import React, { useState } from 'react';
import PageLayout from './PageLayout';
import { useSettings } from '../hooks/useSettings';
import { Button, Input } from './UI';
import { Store, LayoutDashboard, MonitorDot, Trash2, Plus, CheckCircle } from 'lucide-react';
import { TableConfig, Order, MenuItem } from '../types';
import toast from 'react-hot-toast';
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
          <p className="font-medium text-gray-500">Loading settings...</p>
       </div>
     );
  }

  const tabs: { id: SettingsTab; label: string; icon: React.FC<any> }[] = [
    { id: 'profile', label: 'General Settings', icon: Store },
    { id: 'tables', label: 'Table Management', icon: LayoutDashboard },
    { id: 'system', label: 'System Preferences', icon: MonitorDot },
  ];

  return (
    <PageLayout
      title="Settings"
      subtitle="Manage your restaurant profile, table layouts, and system preferences."
      customPadding="p-3 sm:p-6 flex-1 flex flex-col min-h-0 overflow-hidden"
      activeTab="Settings"
      onTabChange={onNavigateToTab}
      actions={
        <button
          onClick={() => onNavigateToTab?.('Dashboard')}
          className="h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer border border-gray-200 select-none"
        >
          <LayoutDashboard size={14} className="stroke-[2.5]" />
          <span>Dashboard</span>
        </button>
      }
    >

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
        
        {/* Navigation Panel */}
        <div className="w-full lg:w-[280px] lg:flex-shrink-0 bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-y-auto">
          <nav className="p-3 space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                    ${isActive 
                      ? 'bg-emerald-50 text-emerald-800 border-l-[3px] border-emerald-500 shadow-xs font-semibold' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Configuration Panel */}
        <div className="flex-1 bg-white rounded-[20px] shadow-sm border border-gray-100 p-6 sm:p-8 overflow-y-auto hidden-scrollbar">
          
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6 max-w-2xl"
            >
              <h2 className="font-semibold text-lg border-b border-gray-100 pb-2 text-gray-900">General Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Restaurant Name" 
                  value={data.restaurantInfo.name} 
                  onChange={(e: any) => updateData('restaurantInfo', 'name', e.target.value)} 
                />
                <Input 
                  label="Owner Name" 
                  value={data.restaurantInfo.ownerName} 
                  onChange={(e: any) => updateData('restaurantInfo', 'ownerName', e.target.value)} 
                />
                <Input 
                  label="Phone Number" 
                  value={data.restaurantInfo.phone} 
                  onChange={(e: any) => updateData('restaurantInfo', 'phone', e.target.value)} 
                />
                <Input 
                  label="Email Address" 
                  value={data.restaurantInfo.email} 
                  onChange={(e: any) => updateData('restaurantInfo', 'email', e.target.value)} 
                />
                <Input 
                  label="Restaurant Address" 
                  value={data.restaurantInfo.address || ''} 
                  onChange={(e: any) => updateData('restaurantInfo', 'address', e.target.value)} 
                />
                <Input 
                  label="FSSAI / Reg. Number" 
                  value={data.restaurantInfo.regNumber || ''} 
                  onChange={(e: any) => updateData('restaurantInfo', 'regNumber', e.target.value)} 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button 
                  disabled={!!savingSection} 
                  onClick={() => handleSave('restaurantInfo', 'Restaurant profile')}
                >
                  {savingSection === 'restaurantInfo' ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </motion.div>
          )}

          {activeTab === 'tables' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6 max-w-2xl"
            >
              <h2 className="font-semibold text-lg border-b border-gray-100 pb-2 text-gray-900">Table Management</h2>
              
              <div className="flex justify-between items-end mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Total Tables: {data.tables?.length || 0}</label>
                </div>
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    const newTable = { id: `t${Date.now()}`, name: `Table ${(data.tables?.length || 0) + 1}` };
                    updateData('tables', '', [...(data.tables || []), newTable]);
                  }}
                  className="!py-1.5"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Table
                </Button>
              </div>

              {/* Direct handling of tables state */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.tables?.map((table: TableConfig, index: number) => (
                  <div key={table.id} className="bg-gray-50 flex items-center justify-between p-2.5 rounded-xl border border-gray-200">
                    <div className="flex-1 mr-2">
                       <input 
                         className="bg-transparent text-sm font-medium text-gray-900 w-full outline-none focus:border-b focus:border-emerald-500"
                         value={table.name}
                         onChange={(e) => {
                           const newTables = [...data.tables];
                           newTables[index] = { ...table, name: e.target.value };
                           updateData('tables' as any, '', newTables);
                         }}
                       />
                    </div>
                    <button 
                       className="text-gray-400 hover:text-rose-500 p-1 cursor-pointer transition-colors" 
                       title="Delete Table"
                       onClick={() => {
                         const newTables = data.tables.filter((_, i) => i !== index);
                         updateData('tables' as any, '', newTables);
                       }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                   disabled={!!savingSection}
                   onClick={() => handleSave('tables' as any, 'Table configurations')}
                >
                  {savingSection === 'tables' ? 'Saving...' : 'Save Tables'}
                </Button>
              </div>
            </motion.div>
          )}

          {activeTab === 'system' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6 max-w-2xl"
            >
              <h2 className="font-semibold text-lg border-b border-gray-100 pb-2 text-gray-900">System Preferences</h2>
              <div className="space-y-3">
                   <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="pref_autoprint"
                        checked={data.preferences.autoPrint}
                        onChange={(e) => updateData('preferences', 'autoPrint', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="pref_autoprint" className="text-sm font-medium text-gray-700 select-none">Automatically Print Bill on Settlement</label>
                   </div>
                   <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="pref_compact"
                        checked={data.preferences.compactMode}
                        onChange={(e) => updateData('preferences', 'compactMode', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="pref_compact" className="text-sm font-medium text-gray-700 select-none">Compact Layout Mode</label>
                   </div>
                   <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="pref_dark"
                        checked={data.preferences.darkMode}
                        onChange={(e) => updateData('preferences', 'darkMode', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="pref_dark" className="text-sm font-medium text-gray-700 select-none">Dark Mode (Experimental)</label>
                   </div>
              </div>

              <h2 className="font-semibold text-lg border-b border-gray-100 pb-2 pt-4 text-gray-900">WhatsApp Integration</h2>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="WhatsApp Business Phone" 
                  value={data.whatsapp?.number || ''} 
                  onChange={(e: any) => updateData('whatsapp', 'number', e.target.value)} 
                />
                <Input 
                  label="Business Display Name" 
                  value={data.whatsapp?.businessName || ''} 
                  onChange={(e: any) => updateData('whatsapp', 'businessName', e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="wa_autobill"
                  checked={data.whatsapp?.autoSendBills || false}
                  onChange={(e) => updateData('whatsapp', 'autoSendBills', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="wa_autobill" className="text-sm font-medium text-gray-700 select-none">Automatically Send WhatsApp Receipts to Customers</label>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  disabled={!!savingSection} 
                  onClick={() => handleSaveMultiple(['preferences', 'whatsapp'], 'System and WhatsApp preferences')}
                >
                  {savingSection === 'preferences_whatsapp' ? 'Saving...' : 'Save System Preferences'}
                </Button>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* Premium Success Popup Modal */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs z-[9999] animate-fade-in">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center max-w-xs w-full mx-4 text-center border-t-4 border-t-emerald-500"
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-500 animate-bounce">
              <CheckCircle size={32} className="stroke-[2.5]" />
            </div>
            <h3 className="text-gray-950 font-black text-lg tracking-tight mb-1">
              Changes Saved!
            </h3>
            <p className="text-gray-500 text-xs font-semibold px-2 leading-relaxed">
              {successMessage}
            </p>
            <div className="mt-4 w-full bg-gray-100 h-1 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-1 rounded-full w-full animate-pulse" />
            </div>
          </motion.div>
        </div>
      )}
    </PageLayout>
  );
}
