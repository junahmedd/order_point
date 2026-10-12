import React from 'react';
import { RefreshCw } from 'lucide-react';

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
}

interface PlatformsTabProps {
  config: OnlineDeliveryConfig;
  setConfig: React.Dispatch<React.SetStateAction<OnlineDeliveryConfig>>;
  testingConnection: string | null;
  handleTestConnection: (platform: 'swiggy' | 'zomato') => Promise<void>;
  saveConfigToFirestore: (newConfig: OnlineDeliveryConfig) => Promise<void>;
  SwiggyLogo: React.ComponentType<{ className?: string }>;
  ZomatoLogo: React.ComponentType<{ className?: string }>;
}

export default function PlatformsTab({
  config,
  setConfig,
  testingConnection,
  handleTestConnection,
  saveConfigToFirestore,
  SwiggyLogo,
  ZomatoLogo
}: PlatformsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
      {/* Swiggy Setup */}
      <div className="bg-white rounded-2xl border border-gray-150 p-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
            <SwiggyLogo className="w-8 h-8" />
            <div>
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Swiggy Integration Setup</h3>
              <p className="text-[10px] text-gray-400">Configure credentials to establish secure handshake with Swiggy Partner API.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Client ID</label>
              <input 
                type="text" 
                value={config.swiggy.clientId}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.swiggy.clientId = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Client Secret Key</label>
              <input 
                type="password" 
                value={config.swiggy.clientSecret}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.swiggy.clientSecret = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Merchant Store ID</label>
              <input 
                type="text" 
                value={config.swiggy.merchantId}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.swiggy.merchantId = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Partner Access API Key</label>
              <input 
                type="text" 
                value={config.swiggy.partnerApiKey}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.swiggy.partnerApiKey = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="swiggy_enable_chk"
              checked={config.swiggy.enabled}
              onChange={(e) => {
                const updated = { ...config };
                updated.swiggy.enabled = e.target.checked;
                setConfig(updated);
                saveConfigToFirestore(updated);
              }}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="swiggy_enable_chk" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
              Enable Swiggy Integration
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button 
            disabled={testingConnection === 'swiggy'}
            onClick={() => handleTestConnection('swiggy')}
            className="px-3 py-1.5 border border-gray-200 text-[11px] font-bold text-gray-600 rounded-xl hover:bg-gray-50 cursor-pointer transition-all flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${testingConnection === 'swiggy' ? 'animate-spin' : ''}`} />
            Test Connection
          </button>
          <button 
            onClick={() => saveConfigToFirestore(config)}
            className="px-4 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer transition-all shadow-sm"
          >
            Save Credentials
          </button>
        </div>
      </div>

      {/* Zomato Setup */}
      <div className="bg-white rounded-2xl border border-gray-150 p-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
            <ZomatoLogo className="w-8 h-8" />
            <div>
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Zomato Integration Setup</h3>
              <p className="text-[10px] text-gray-400">Configure credentials to establish secure handshake with Zomato Partner API.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Client ID</label>
              <input 
                type="text" 
                value={config.zomato.clientId}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.zomato.clientId = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Client Secret Key</label>
              <input 
                type="password" 
                value={config.zomato.clientSecret}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.zomato.clientSecret = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Merchant Store ID</label>
              <input 
                type="text" 
                value={config.zomato.merchantId}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.zomato.merchantId = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">Partner Access API Key</label>
              <input 
                type="text" 
                value={config.zomato.partnerApiKey}
                onChange={(e) => {
                  const updated = { ...config };
                  updated.zomato.partnerApiKey = e.target.value;
                  setConfig(updated);
                }}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-mono text-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="zomato_enable_chk"
              checked={config.zomato.enabled}
              onChange={(e) => {
                const updated = { ...config };
                updated.zomato.enabled = e.target.checked;
                setConfig(updated);
                saveConfigToFirestore(updated);
              }}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="zomato_enable_chk" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
              Enable Zomato Integration
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button 
            disabled={testingConnection === 'zomato'}
            onClick={() => handleTestConnection('zomato')}
            className="px-3 py-1.5 border border-gray-200 text-[11px] font-bold text-gray-600 rounded-xl hover:bg-gray-50 cursor-pointer transition-all flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${testingConnection === 'zomato' ? 'animate-spin' : ''}`} />
            Test Connection
          </button>
          <button 
            onClick={() => saveConfigToFirestore(config)}
            className="px-4 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer transition-all shadow-sm"
          >
            Save Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
