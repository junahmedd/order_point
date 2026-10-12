import React from 'react';
import { ShieldCheck, Copy, Check, AlertCircle } from 'lucide-react';

interface WebhooksTabProps {
  userId: string | null;
  copiedField: string | null;
  handleCopyWebhookUrl: (platform: 'swiggy' | 'zomato') => void;
  SwiggyLogo: React.ComponentType<{ className?: string }>;
  ZomatoLogo: React.ComponentType<{ className?: string }>;
}

export default function WebhooksTab({
  userId,
  copiedField,
  handleCopyWebhookUrl,
  SwiggyLogo,
  ZomatoLogo
}: WebhooksTabProps) {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://orderpointpro.in';

  return (
    <div className="bg-white rounded-2xl border border-gray-150 p-5 flex flex-col h-full min-h-0 justify-between">
      <div className="space-y-4">
        <div className="border-b border-gray-50 pb-3 shrink-0">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Webhook Endpoints</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Receive instant order placements and status updates securely via platform webhook push.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
          {/* Swiggy Webhook */}
          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-150 space-y-3">
            <div className="flex items-center gap-2">
              <SwiggyLogo className="w-5 h-5" />
              <span className="font-extrabold text-xs text-gray-800">Swiggy Webhook URL</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-150">
              <span className="font-mono text-[10px] text-gray-500 truncate flex-1">
                {`${currentOrigin}/api/webhooks/swiggy/${userId || 'demo_user_123'}`}
              </span>
              <button 
                onClick={() => handleCopyWebhookUrl('swiggy')}
                className="p-1.5 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer shrink-0"
              >
                {copiedField === 'swiggy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Zomato Webhook */}
          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-150 space-y-3">
            <div className="flex items-center gap-2">
              <ZomatoLogo className="w-5 h-5" />
              <span className="font-extrabold text-xs text-gray-800">Zomato Webhook URL</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-150">
              <span className="font-mono text-[10px] text-gray-500 truncate flex-1">
                {`${currentOrigin}/api/webhooks/zomato/${userId || 'demo_user_123'}`}
              </span>
              <button 
                onClick={() => handleCopyWebhookUrl('zomato')}
                className="p-1.5 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer shrink-0"
              >
                {copiedField === 'zomato' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <span className="font-extrabold block mb-0.5">Webhook Setup Instructions:</span>
            Partner APIs require secure handshake validation ending with your unique authorization token. Copy the endpoints above and paste them into your Swiggy Partner dashboard or Zomato Merchant Portal.
          </div>
        </div>
      </div>
    </div>
  );
}
