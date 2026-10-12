import React, { useState } from 'react';
import { 
  Zap, CheckCircle, ShoppingBag, 
  Copy, Check, Clock, XCircle
} from 'lucide-react';
import { Order } from '../../types';
import toast from 'react-hot-toast';

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

interface WebhookLog {
  id: string;
  timestamp: number;
  source: 'Swiggy' | 'Zomato';
  eventType: string;
  status: '200 OK' | '500 Error' | 'Pending';
  payload: string;
  response: string;
}

interface OverviewTabProps {
  config: OnlineDeliveryConfig;
  totalOrdersCount: number;
  swiggyOrdersToday: number;
  zomatoOrdersToday: number;
  totalRevenue: number;
  webhookLogs: WebhookLog[];
  testingConnection: string | null;
  handleTestConnection: (platform: 'swiggy' | 'zomato') => Promise<void>;
  simulatingOrder: string | null;
  handleSimulateIncomingOrder: (platform: 'Swiggy' | 'Zomato') => Promise<void>;
  onlineOrders: Order[];
  setSelectedOrderDetails: (order: Order) => void;
  setActiveSubTab: (tab: 'overview' | 'platforms' | 'logs' | 'settings') => void;
  SwiggyLogo: React.ComponentType<{ className?: string }>;
  ZomatoLogo: React.ComponentType<{ className?: string }>;
}

export default function OverviewTab({
  config,
  totalOrdersCount,
  swiggyOrdersToday,
  zomatoOrdersToday,
  totalRevenue,
  testingConnection,
  handleTestConnection,
  simulatingOrder,
  handleSimulateIncomingOrder,
  onlineOrders,
  setSelectedOrderDetails,
  setActiveSubTab,
  SwiggyLogo,
  ZomatoLogo
}: OverviewTabProps) {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://orderpointpro.in';
  
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopyUrl = (url: string, field: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(field);
    toast.success(`${field} Webhook URL copied to clipboard`);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Rely strictly on live database orders from Firebase (no mock data)
  const displayOrders = React.useMemo(() => {
    return onlineOrders
      .map(o => {
        const minutesAgo = Math.floor((Date.now() - new Date(o.createdAt || Date.now()).getTime()) / 60000);
        return {
          ...o,
          timeStr: minutesAgo <= 0 ? 'Just now' : `${minutesAgo} mins ago`
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [onlineOrders]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6 overflow-y-auto pb-4">
      
      {/* Platform Connections Title */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Platform Connections
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Swiggy Connection Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <SwiggyLogo className="w-8 h-8 shrink-0 rounded-xl" />
                  <span className="text-base font-extrabold text-[#FC8019] tracking-wider uppercase font-sans">
                    SWIGGY
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected</span>
                </div>
              </div>

              {/* Rows of Fields */}
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">API Status</span>
                  <span className="text-xs text-emerald-600 font-bold">Connected</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Last Sync</span>
                  <span className="text-xs text-slate-700 font-semibold">{config.swiggy.lastSync || '2 mins ago'}</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Total Orders Today</span>
                  <span className="text-xs text-slate-700 font-bold">{swiggyOrdersToday}</span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium block">Webhook URL</span>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-3 py-2 rounded-xl">
                    <span className="text-xs text-slate-600 font-mono select-all truncate flex-1">
                      {`${currentOrigin}/api/webhooks/swiggy/*****`}
                    </span>
                    <button 
                      onClick={() => handleCopyUrl(`${currentOrigin}/api/webhooks/swiggy/*****`, 'Swiggy')}
                      className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title="Copy Swiggy Webhook URL"
                    >
                      {copiedUrl === 'Swiggy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-5 mt-4 border-t border-slate-100">
              <button 
                onClick={() => setActiveSubTab('platforms')}
                className="h-9 px-4 text-xs font-semibold text-emerald-600 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer font-sans w-full"
              >
                Configure Swiggy Integration
              </button>
            </div>
          </div>

          {/* Zomato Connection Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ZomatoLogo className="w-8 h-8 shrink-0 rounded-xl" />
                  <span className="text-base font-extrabold text-[#E23744] tracking-wider uppercase font-sans">
                    ZOMATO
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected</span>
                </div>
              </div>

              {/* Rows of Fields */}
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">API Status</span>
                  <span className="text-xs text-emerald-600 font-bold">Connected</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Last Sync</span>
                  <span className="text-xs text-slate-700 font-semibold">{config.zomato.lastSync || '1 min ago'}</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Total Orders Today</span>
                  <span className="text-xs text-slate-700 font-bold">{zomatoOrdersToday}</span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium block">Webhook URL</span>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-3 py-2 rounded-xl">
                    <span className="text-xs text-slate-600 font-mono select-all truncate flex-1">
                      {`${currentOrigin}/api/webhooks/zomato/*****`}
                    </span>
                    <button 
                      onClick={() => handleCopyUrl(`${currentOrigin}/api/webhooks/zomato/*****`, 'Zomato')}
                      className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title="Copy Zomato Webhook URL"
                    >
                      {copiedUrl === 'Zomato' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-5 mt-4 border-t border-slate-100">
              <button 
                onClick={() => setActiveSubTab('platforms')}
                className="h-9 px-4 text-xs font-semibold text-emerald-600 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer font-sans w-full"
              >
                Configure Zomato Integration
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Integration Statistics Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Integration Statistics
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 1: Total Orders Today */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Orders Today</span>
              <h4 className="text-3xl font-black text-slate-800 leading-none">{totalOrdersCount}</h4>
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 pt-1">
                <span>Real-time from Database</span>
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-500 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Successful Orders */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Successful Orders</span>
              <h4 className="text-3xl font-black text-slate-800 leading-none">
                {onlineOrders.filter(o => o.status === 'Completed' || o.status === 'Delivered').length}
              </h4>
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 pt-1">
                <span>Completed successfully</span>
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Pending/Active Orders */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pending / Preparing</span>
              <h4 className="text-3xl font-black text-slate-800 leading-none">
                {onlineOrders.filter(o => o.status !== 'Completed' && o.status !== 'Delivered' && o.status !== 'Cancelled').length}
              </h4>
              <p className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 pt-1">
                <span>Active in kitchen</span>
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Total Revenue Today */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Revenue</span>
              <h4 className="text-2xl font-black text-slate-800 leading-none">₹{totalRevenue.toFixed(2)}</h4>
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 pt-1">
                <span>Synced via Firestore</span>
              </p>
            </div>
            <div className="p-3 bg-teal-50 rounded-full text-teal-600 shrink-0">
              <span className="text-lg font-black leading-none">₹</span>
            </div>
          </div>

        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 tracking-tight">
            Recent Orders
          </h3>
          <button 
            onClick={() => setActiveSubTab('logs')}
            className="border border-emerald-200 hover:bg-emerald-50 text-emerald-600 text-xs px-3.5 py-1.5 rounded-lg transition-all font-semibold cursor-pointer"
          >
            View All Sync Logs
          </button>
        </div>

        {/* Full-width Responsive Table Wrapper */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium text-slate-600">
                {displayOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-normal">
                      No active online integration orders in the database.
                    </td>
                  </tr>
                ) : (
                  displayOrders.map((order) => {
                    const isSwiggy = order.orderSource === 'Swiggy';
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-all">
                        {/* Order ID */}
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                          #{order.orderNumber}
                        </td>

                        {/* Platform */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                            {isSwiggy ? <SwiggyLogo className="w-5 h-5 shrink-0 rounded-md" /> : <ZomatoLogo className="w-5 h-5 shrink-0 rounded-md" />}
                            <span>{order.orderSource}</span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5 text-slate-700">
                          {order.customerName}
                        </td>

                        {/* Items count */}
                        <td className="px-5 py-3.5 text-slate-500">
                          {order.items?.length || 1} {order.items?.length === 1 ? 'item' : 'items'}
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          ₹{order.totalAmount?.toFixed(2)}
                        </td>

                        {/* Status badges matching exact visual styles of the image */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'New' 
                              ? 'bg-amber-50 border border-amber-100 text-amber-600' 
                              : order.status === 'Preparing' || order.status === 'Accepted'
                              ? 'bg-blue-50 border border-blue-100 text-blue-600' 
                              : order.status === 'Cancelled'
                              ? 'bg-red-50 border border-red-100 text-red-600'
                              : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                          }`}>
                            {order.status}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="px-5 py-3.5 text-slate-500">
                          {order.timeStr}
                        </td>

                        {/* View Action */}
                        <td className="px-5 py-3.5 text-right">
                          <button 
                            onClick={() => setSelectedOrderDetails(order)}
                            className="border border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold px-3 py-1 rounded-lg transition-all cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
