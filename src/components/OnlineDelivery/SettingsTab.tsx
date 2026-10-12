import React from 'react';

interface OnlineDeliveryConfig {
  integrationStatus: 'Active' | 'Inactive';
  swiggy: {
    enabled: boolean;
    connected: boolean;
    clientId: string;
    clientSecret: string;
    merchantId: string;
    partnerApiKey: string;
    lastSync: string;
  };
  zomato: {
    enabled: boolean;
    connected: boolean;
    clientId: string;
    clientSecret: string;
    merchantId: string;
    partnerApiKey: string;
    lastSync: string;
  };
  settings: {
    autoAccept: boolean;
    syncInventory: boolean;
    riderNotification: boolean;
    commissionOffset: number;
    delayPrepMinutes: number;
  };
}

interface SettingsTabProps {
  config: OnlineDeliveryConfig;
  setConfig: React.Dispatch<React.SetStateAction<OnlineDeliveryConfig>>;
  saveConfigToFirestore: (newConfig: OnlineDeliveryConfig) => Promise<void>;
}

export default function SettingsTab({
  config,
  setConfig,
  saveConfigToFirestore
}: SettingsTabProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-150 p-5 flex flex-col h-full min-h-0 justify-between">
      <div className="space-y-4">
        <div className="border-b border-gray-50 pb-3 shrink-0">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Delivery Preferences</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Manage automated logic, delay triggers, and platform price parameters.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-gray-800">Auto-Accept Incoming Orders</span>
                <span className="text-[10px] text-gray-400 block leading-tight">Orders are auto-approved and sent directly to kitchen.</span>
              </div>
              <input 
                type="checkbox" 
                checked={config.settings.autoAccept}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.settings.autoAccept = e.target.checked;
                  setConfig(updated);
                }}
                className="w-4.5 h-4.5 text-emerald-600 border-gray-300 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-gray-800">Synchronize Inventory Levels</span>
                <span className="text-[10px] text-gray-400 block leading-tight">Sync stock levels dynamically to prevent unfulfilled orders.</span>
              </div>
              <input 
                type="checkbox" 
                checked={config.settings.syncInventory}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.settings.syncInventory = e.target.checked;
                  setConfig(updated);
                }}
                className="w-4.5 h-4.5 text-emerald-600 border-gray-300 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-gray-800">Active Rider Alerts</span>
                <span className="text-[10px] text-gray-400 block leading-tight">Ping rider coordinate dispatch once chef marks ready.</span>
              </div>
              <input 
                type="checkbox" 
                checked={config.settings.riderNotification}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.settings.riderNotification = e.target.checked;
                  setConfig(updated);
                }}
                className="w-4.5 h-4.5 text-emerald-600 border-gray-300 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Commission Markup (%)</span>
                <input 
                  type="number" 
                  value={config.settings.commissionOffset}
                  onChange={(e) => {
                    const updated = { ...config };
                    updated.settings.commissionOffset = parseInt(e.target.value) || 0;
                    setConfig(updated);
                  }}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Prep Delay (Minutes)</span>
                <input 
                  type="number" 
                  value={config.settings.delayPrepMinutes}
                  onChange={(e) => {
                    const updated = { ...config };
                    updated.settings.delayPrepMinutes = parseInt(e.target.value) || 0;
                    setConfig(updated);
                  }}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 flex justify-end shrink-0">
        <button 
          onClick={() => saveConfigToFirestore(config)}
          className="px-6 h-9 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/10"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
