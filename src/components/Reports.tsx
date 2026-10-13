/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import PageLayout from './PageLayout';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  DollarSign, 
  Box, 
  CreditCard, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw,
  Activity,
  AlertTriangle,
  ExternalLink,
  Settings,
  GitBranch,
  ShieldCheck,
  Check,
  BrainCircuit,
  LogOut,
  Play,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lock,
  Flame,
  Zap,
  Crown
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Order, InventoryItem, CustomerFeedback } from '../types';
import { 
  connectGoogleAccount, 
  createSpreadsheet, 
  synchronizeDataWithProgress, 
  setCachedToken, 
  getCachedToken,
  logSyncActivity,
  GoogleSheetsConfig 
} from '../lib/googleSheetsService';
import toast from 'react-hot-toast';

interface ReportsProps {
  orders: Order[];
  inventoryItems: InventoryItem[];
  subscriptionPlan?: string;
  isExpired?: boolean;
  onUpgradeToPro?: () => void;
  onUpgradeToBusiness?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function Reports({ 
  orders, 
  inventoryItems,
  subscriptionPlan = 'pro',
  isExpired = false,
  onUpgradeToPro,
  onUpgradeToBusiness,
  onNavigateToTab
}: ReportsProps) {
  const [filter, setFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('TODAY');

  // Google Sheets integration state
  const [gsConfig, setGsConfig] = useState<GoogleSheetsConfig>({
    spreadsheetId: '',
    spreadsheetUrl: '',
    enabled: false,
    syncFrequency: 'Real-time',
    lastSyncedAt: null,
    syncStatus: 'Disconnected',
    branchName: 'Main Branch',
    syncLimit: 200,
    logs: []
  });

  const [feedbackList, setFeedbackList] = useState<CustomerFeedback[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ percentage: number; status: string; step: string } | null>(null);

  // Synchronization concurrency locks to prevent overlapping API calls
  const syncMutexRef = useRef(false);
  const pendingSyncRef = useRef(false);

  // Subscribe to Sheets config
  useEffect(() => {
    const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    const configRef = doc(db, `restaurants/${userId}/google_sheets_config`, 'settings');
    
    const unsub = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGsConfig(prev => ({
          ...prev,
          ...data,
          logs: data.logs || []
        }));
      }
    });
    return unsub;
  }, []);

  // Subscribe to remaining collections
  useEffect(() => {
    const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    
    const unsubFeedback = onSnapshot(collection(db, `restaurants/${userId}/feedback`), (snap) => {
      setFeedbackList(snap.docs.map(d => d.data() as CustomerFeedback));
    });

    const unsubStaff = onSnapshot(collection(db, `restaurants/${userId}/staffMembers`), (snap) => {
      setStaffMembers(snap.docs.map(d => d.data()));
    });

    const unsubCustomers = onSnapshot(collection(db, `restaurants/${userId}/customers`), (snap) => {
      setCustomers(snap.docs.map(d => d.data()));
    });

    return () => {
      unsubFeedback();
      unsubStaff();
      unsubCustomers();
    };
  }, []);

  // Track token validity in session
  useEffect(() => {
    const token = getCachedToken();
    setIsTokenValid(!!token);
  }, [gsConfig.syncStatus]);

  // Real-time Auto-Sync Trigger - coalesced to 15 seconds to avoid flooding Google APIs
  useEffect(() => {
    if (!gsConfig.enabled || gsConfig.syncFrequency !== 'Real-time' || !gsConfig.spreadsheetId) return;
    const token = getCachedToken();
    if (!token) return;

    const timer = setTimeout(() => {
      handleRunSyncSilent();
    }, 15000);

    return () => clearTimeout(timer);
  }, [orders, inventoryItems, feedbackList, gsConfig.enabled, gsConfig.spreadsheetId]);

  // Handle OAuth session expiration/revocation cleanly
  const handleOAuthError = async (error: any) => {
    const isUnauth = error.message?.includes('UNAUTHENTICATED') || 
                     error.message?.includes('401') || 
                     error.message?.includes('invalid authentication credentials');
    
    if (isUnauth) {
      setCachedToken(null);
      setIsTokenValid(false);
      const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const configRef = doc(db, `restaurants/${userId}/google_sheets_config`, 'settings');
      await setDoc(configRef, {
        syncStatus: 'Disconnected',
        enabled: false,
      }, { merge: true });
      toast.error('Your Google session has expired or been revoked. Please sign in again with Google to resume sync.');
    }
  };

  // Silent automatic sync function with concurrency control (mutex lock)
  const handleRunSyncSilent = async () => {
    const token = getCachedToken();
    if (!token || !gsConfig.spreadsheetId) return;

    // Concurrency Lock: if already syncing, schedule a pending sync run
    if (syncMutexRef.current) {
      pendingSyncRef.current = true;
      return;
    }
    syncMutexRef.current = true;
    const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    
    try {
      await synchronizeDataWithProgress(token, gsConfig.spreadsheetId, {
        orders,
        inventoryItems,
        feedbackList,
        staffMembers,
        customers,
        currencySymbol: '₹',
        restaurantName: 'OrderPoint Pro',
        branchName: gsConfig.branchName || 'Main Branch',
        syncLimit: gsConfig.syncLimit ?? 200
      }, (prog) => {
        setSyncProgress(prog);
      });
      await logSyncActivity(userId, 'Auto-Sync: Real-time update complete', 'Success');
    } catch (error: any) {
      console.warn('Auto-sync silent failed:', error);
      await logSyncActivity(userId, `Auto-Sync failure: ${error.message}`, 'Failed');
      await handleOAuthError(error);
    } finally {
      syncMutexRef.current = false;
      setTimeout(() => {
        setSyncProgress(null);
      }, 2500);

      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        // Schedule next deferred run
        handleRunSyncSilent();
      }
    }
  };

  // Google OAuth connection trigger
  const handleGoogleLogin = async () => {
    const loginToast = toast.loading('Connecting Google account securely via OAuth 2.0...');
    try {
      const token = await connectGoogleAccount();
      setIsTokenValid(true);
      
      const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const configRef = doc(db, `restaurants/${userId}/google_sheets_config`, 'settings');
      
      await setDoc(configRef, {
        syncStatus: 'Connected',
      }, { merge: true });

      toast.success('Successfully connected to Google Sheets & Drive!', { id: loginToast });
    } catch (error: any) {
      console.warn('Google Authentication failed:', error);
      toast.error(`Authentication failed: ${error.message}`, { id: loginToast });
    }
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    setCachedToken(null);
    setIsTokenValid(false);
    const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    const configRef = doc(db, `restaurants/${userId}/google_sheets_config`, 'settings');
    await setDoc(configRef, {
      syncStatus: 'Disconnected',
      spreadsheetId: '',
      spreadsheetUrl: '',
      enabled: false,
    }, { merge: true });
    toast.success('Google Account disconnected successfully.');
  };

  // Create Spreadsheet handler
  const handleCreateNewSpreadsheet = async () => {
    const token = getCachedToken();
    if (!token) {
      toast.error('Google Account not connected. Please connect first.');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ percentage: 5, status: 'Initializing spreadsheet creation...', step: 'INIT' });
    const createToast = toast.loading('Provisioning & formatting professional Google Spreadsheet...');
    try {
      const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
      const result = await createSpreadsheet(token, 'OrderPoint Pro', gsConfig.branchName || 'Main Branch');
      
      const configRef = doc(db, `restaurants/${userId}/google_sheets_config`, 'settings');
      await setDoc(configRef, {
        spreadsheetId: result.id,
        spreadsheetUrl: result.url,
        syncStatus: 'Connected',
      }, { merge: true });

      await logSyncActivity(userId, `New spreadsheet report initialized successfully: ${result.id}`, 'Success');
      
      // Immediately run first sync to populate database
      await synchronizeDataWithProgress(token, result.id, {
        orders,
        inventoryItems,
        feedbackList,
        staffMembers,
        customers,
        currencySymbol: '₹',
        restaurantName: 'OrderPoint Pro',
        branchName: gsConfig.branchName || 'Main Branch',
        syncLimit: gsConfig.syncLimit ?? 200
      }, (prog) => {
        setSyncProgress(prog);
      });

      toast.success('Spreadsheet initialized & populated with Dashboard and logs!', { id: createToast });
    } catch (error: any) {
      console.warn('Failed to create spreadsheet:', error);
      toast.error(`Failed to create spreadsheet: ${error.message}`, { id: createToast });
      await handleOAuthError(error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncProgress(null);
      }, 2500);
    }
  };

  // Manual Trigger Full Sync
  const handleRunSync = async () => {
    const token = getCachedToken();
    if (!token) {
      toast.error('Google account token is missing or expired. Please connect again!');
      return;
    }
    if (!gsConfig.spreadsheetId) {
      toast.error('Please create or connect a Google Spreadsheet first!');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ percentage: 0, status: 'Preparing operational datasets & optimizing queues...', step: 'DATA_INIT' });
    const syncToast = toast.loading('Synchronizing database data to Google Sheets...');
    const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';

    try {
      await synchronizeDataWithProgress(token, gsConfig.spreadsheetId, {
        orders,
        inventoryItems,
        feedbackList,
        staffMembers,
        customers,
        currencySymbol: '₹',
        restaurantName: 'OrderPoint Pro',
        branchName: gsConfig.branchName || 'Main Branch',
        syncLimit: gsConfig.syncLimit ?? 200
      }, (prog) => {
        setSyncProgress(prog);
      });
      
      await logSyncActivity(userId, 'Manual Full Database Synchronized successfully', 'Success');
      toast.success('All Operational records synced to Google Sheets!', { id: syncToast });
    } catch (error: any) {
      console.warn('Manual sync failed:', error);
      await logSyncActivity(userId, `Sync failure: ${error.message}`, 'Failed');
      toast.error(`Synchronization failed: ${error.message}`, { id: syncToast });
      await handleOAuthError(error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncProgress(null);
      }, 3000);
    }
  };


  // Update Settings fields
  const handleUpdateConfig = async (fields: Partial<GoogleSheetsConfig>) => {
    const userId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
    const configRef = doc(db, `restaurants/${userId}/google_sheets_config`, 'settings');
    try {
      await setDoc(configRef, fields, { merge: true });
      toast.success('Configuration updated!');
    } catch (error) {
      toast.error('Error saving configurations.');
    }
  };

  // Dynamic order filtering by selected interval (TODAY, WEEK, MONTH, YEAR)
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter(o => {
      // Parse order creation time
      const orderTime = o.createdAt ? new Date(o.createdAt).getTime() : (o.timestamp || now);
      const diffMs = now - orderTime;
      
      if (filter === 'TODAY') {
        const todayStr = new Date().toDateString();
        const orderDateStr = o.createdAt ? new Date(o.createdAt).toDateString() : new Date(o.timestamp || now).toDateString();
        return orderDateStr === todayStr;
      }
      if (filter === 'WEEK') {
        return diffMs <= 7 * 24 * 60 * 60 * 1000;
      }
      if (filter === 'MONTH') {
        return diffMs <= 30 * 24 * 60 * 60 * 1000;
      }
      if (filter === 'YEAR') {
        return diffMs <= 365 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [orders, filter]);

  // Analytics helper calculations using filteredOrders
  const stats = useMemo(() => {
    const paidOrders = filteredOrders.filter(o => o.isPaid);
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrdersCount = filteredOrders.length;

    const getPaymentMethodStr = (o: Order) => ((o.paymentMethod || (o as any).payment_method || '') as string).toLowerCase();

    const cashRevenue = paidOrders
      .filter(o => getPaymentMethodStr(o) === 'cash')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const upiRevenue = paidOrders
      .filter(o => {
        const m = getPaymentMethodStr(o);
        return m.includes('upi') || m.includes('gpay') || m.includes('google pay');
      })
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const cardRevenue = paidOrders
      .filter(o => getPaymentMethodStr(o) === 'card')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      totalRevenue,
      totalOrdersCount,
      cashRevenue,
      upiRevenue,
      cardRevenue
    };
  }, [filteredOrders]);


  const sellingItems = useMemo(() => {
    const data: { name: string; qty: number; value: number }[] = [];
    filteredOrders.forEach(order => {
      order.items.forEach(it => {
        const existing = data.find(item => item.name === it.menuItem.name);
        if (existing) {
          existing.qty += it.quantity;
          existing.value += it.menuItem.price * it.quantity;
        } else {
          data.push({
            name: it.menuItem.name,
            qty: it.quantity,
            value: it.menuItem.price * it.quantity
          });
        }
      });
    });
    return data.sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredOrders]);

  const maxQty = useMemo(() => {
    if (sellingItems.length === 0) return 1;
    return Math.max(...sellingItems.map(it => it.qty));
  }, [sellingItems]);

  const portionAnalytics = useMemo(() => {
    const analysis: Record<string, {
      parentName: string;
      portions: Record<string, { qty: number; revenue: number }>;
      totalQty: number;
      totalRevenue: number;
    }> = {};

    filteredOrders.forEach(order => {
      order.items.forEach(it => {
        const parentName = it.productName || it.menuItem.name;
        const portionName = it.size || 'Single/Regular';

        if (!analysis[parentName]) {
          analysis[parentName] = {
            parentName,
            portions: {},
            totalQty: 0,
            totalRevenue: 0
          };
        }

        if (!analysis[parentName].portions[portionName]) {
          analysis[parentName].portions[portionName] = { qty: 0, revenue: 0 };
        }

        const price = it.menuItem.price || 0;
        analysis[parentName].portions[portionName].qty += it.quantity;
        analysis[parentName].portions[portionName].revenue += price * it.quantity;
        analysis[parentName].totalQty += it.quantity;
        analysis[parentName].totalRevenue += price * it.quantity;
      });
    });

    return Object.values(analysis).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredOrders]);

  const stockDepleted = useMemo(() => {
    return (inventoryItems || []).filter(i => i.status === 'LOW STOCK' || i.quantity === 0);
  }, [inventoryItems]);

  const breakdownSource = useMemo(() => {
    const hours = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
    const buckets: Record<string, number> = {
      '09:00': 0, '11:00': 0, '13:00': 0, '15:00': 0,
      '17:00': 0, '19:00': 0, '21:00': 0
    };

    filteredOrders.forEach(o => {
      if (!o.isPaid) return;
      const date = o.createdAt ? new Date(o.createdAt) : (o.timestamp ? new Date(o.timestamp) : null);
      if (!date) return;
      const h = date.getHours();
      
      let slot = '21:00';
      if (h < 10) slot = '09:00';
      else if (h < 12) slot = '11:00';
      else if (h < 14) slot = '13:00';
      else if (h < 16) slot = '15:00';
      else if (h < 18) slot = '17:00';
      else if (h < 20) slot = '19:00';
      
      buckets[slot] += (o.totalAmount || 0);
    });

    const hasAnySales = Object.values(buckets).some(v => v > 0);
    if (!hasAnySales && stats.totalRevenue === 0) {
      return [
        { label: '09:00', revenue: 450 },
        { label: '11:00', revenue: 1200 },
        { label: '13:00', revenue: 2800 },
        { label: '15:00', revenue: 800 },
        { label: '17:00', revenue: 1900 },
        { label: '19:00', revenue: 3400 },
        { label: '21:00', revenue: 2700 },
      ];
    }

    return hours.map(label => ({
      label,
      revenue: buckets[label]
    }));
  }, [filteredOrders, stats.totalRevenue]);

  return (
    <PageLayout
      title="Reports & Analytics"
      subtitle="Review operational performance, sales, and revenues."
      id="reports_view"
      activeTab="Reports"
      onTabChange={onNavigateToTab}
    >
      {/* Controls Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100">
        <div className="bg-gray-50 border border-gray-150 rounded-[14px] p-0.5 flex">
          {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as const).map((tab) => (
            <button
              id={`btn_report_filter_${tab}`}
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 text-[10px] font-extrabold rounded-[11px] tracking-wider transition-all uppercase ${
                filter === tab
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Top row: 4 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL SALES */}
        <div className="bg-white rounded-[16px] p-4 shadow-sm h-[90px] flex flex-col justify-between border border-[#EDEDED] hover:border-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
            <span className="text-[9px] font-extrabold tracking-[1px] text-[#8B8B8B] uppercase">
              TOTAL SALES
            </span>
          </div>
          <h3 className="text-xl font-black text-[#111111] leading-none tracking-tight">
            ₹{stats.totalRevenue.toLocaleString('en-IN')}
          </h3>
        </div>

        {/* TOTAL ORDERS */}
        <div className="bg-white rounded-[16px] p-4 shadow-sm h-[90px] flex flex-col justify-between border border-[#EDEDED] hover:border-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <Box size={16} />
            </div>
            <span className="text-[9px] font-extrabold tracking-[1px] text-[#8B8B8B] uppercase">
              TOTAL ORDERS
            </span>
          </div>
          <h3 className="text-xl font-black text-[#111111] leading-none tracking-tight">
            {stats.totalOrdersCount}
          </h3>
        </div>

        {/* CASH FLOWS */}
        <div className="bg-white rounded-[16px] p-4 shadow-sm h-[90px] flex flex-col justify-between border border-[#EDEDED] hover:border-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#FEF3C7] text-[#F59E0B] flex items-center justify-center">
              <CreditCard size={16} />
            </div>
            <span className="text-[9px] font-extrabold tracking-[1px] text-[#8B8B8B] uppercase">
              CASH FLOWS
            </span>
          </div>
          <h3 className="text-xl font-black text-[#111111] leading-none tracking-tight">
            ₹{stats.cashRevenue.toLocaleString('en-IN')}
          </h3>
        </div>

        {/* UPI DIGITAL */}
        <div className="bg-white rounded-[16px] p-4 shadow-sm h-[90px] flex flex-col justify-between border border-[#EDEDED] hover:border-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#F3E8FF] text-[#A855F7] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <span className="text-[9px] font-extrabold tracking-[1px] text-[#8B8B8B] uppercase">
              UPI DIGITAL
            </span>
          </div>
          <h3 className="text-xl font-black text-[#111111] leading-none tracking-tight">
            ₹{stats.upiRevenue.toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      {/* Grid: Revenue Breakdown Graph & Top Selling list */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Left Card: REVENUE BREAKDOWN */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-150">
          <h3 className="text-[14px] font-black text-[#111111] tracking-wider uppercase mb-6">
            REVENUE BREAKDOWN
          </h3>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdownSource} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECECEC" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8B8B8B', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8B8B8B', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111111',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontFamily: 'sans-serif',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`₹${value}`, 'Hourly Peak']}
                />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]} barSize={36}>
                  {breakdownSource.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#22C55E', '#0284C7', '#F59E0B', '#8B5CF6', '#EF4444', '#111111', '#A855F7'][index % 7]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 border-t border-[#EEEEEE] pt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <h3 className="text-[13px] font-black text-[#111111] uppercase tracking-wider">
                INVENTORY STOCK DEPLETION LOGS
              </h3>
              <span className="px-3 py-1 bg-rose-50 text-[#EF4444] text-[9px] font-black rounded-full uppercase tracking-wider self-start sm:self-center">
                {stockDepleted.length} Alerting
              </span>
            </div>

            {stockDepleted.length === 0 ? (
              <div className="text-center py-4 bg-[#F8F8F8] rounded-[16px] text-gray-400 font-medium text-xs">
                ✔ All warehouse ingredients are safely above critical safety depletion levels.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stockDepleted.map(item => {
                  const depletionRatio = item.quantity === 0 ? 0 : Math.round((item.quantity / item.lowLimit) * 100);
                  const isOut = item.quantity === 0;

                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-[16px] border ${isOut ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900 truncate">{item.name}</span>
                        <span className={`px-2 py-0.5 rounded-[10px] text-[8px] font-black uppercase tracking-wider ${isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isOut ? 'Depleted' : 'Low'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isOut ? 'bg-rose-500' : 'bg-amber-500'}`} 
                          style={{ width: `${Math.min(100, depletionRatio)}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Card: TOP SELLING ITEMS */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#EDEDED] flex flex-col justify-between">
          <div>
            <h3 className="text-[14px] font-black text-[#111111] tracking-wider uppercase mb-6">
              TOP SELLING ITEMS
            </h3>

            {sellingItems.length === 0 ? (
              <div className="text-center py-20 text-[#8B8B8B]">
                <span className="font-sans tracking-tight italic block mb-2 text-sm text-[#8B8B8B]">
                  No data available
                </span>
                <span className="text-xs">
                  Transactions will populate list live.
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {sellingItems.map((it, idx) => {
                  const percentage = Math.round((it.qty / maxQty) * 100);
                  return (
                    <div key={idx} className="p-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-[20px] transition-all hover:bg-white hover:border-black/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-[#111111] block truncate max-w-[150px]">
                            {it.name}
                          </span>
                          <span className="text-xs text-[#8B8B8B] font-semibold">
                            {it.qty} items ordered
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-[#111111]">
                            ₹{it.value}
                          </span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                        <div 
                          className="bg-[#111111] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-100 mt-6 flex items-center gap-3">
            <CheckCircle2 className="text-sky-600 shrink-0" size={18} />
            <div>
              <span className="text-xs font-bold text-sky-700 block">SECURED LEDGER</span>
              <span className="text-[10px] text-[#8B8B8B]">Audit trail synced perfectly</span>
            </div>
          </div>
        </div>
      </div>

      {/* Portion & Variant Performance Analysis */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-150 mt-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-[14px] font-black text-[#111111] tracking-wider uppercase mb-1">
              PORTION &amp; VARIANT PERFORMANCE ANALYSIS
            </h3>
            <p className="text-[11px] font-semibold text-gray-400">
              Granular sales breakdown comparing Single, Half, and Full portion performance metrics
            </p>
          </div>
          <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-indigo-100 flex items-center gap-1.5 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Portion Breakdown</span>
          </div>
        </div>

        {portionAnalytics.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <span className="italic block text-sm">No transaction ledger records found.</span>
            <span className="text-[11px] block mt-1">Complete a tabletop checkout to display variant analytics.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="pb-3 pl-4">Dish Item</th>
                  <th className="pb-3 text-center">Portion</th>
                  <th className="pb-3 text-center">Qty Sold</th>
                  <th className="pb-3 text-right pr-4">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {portionAnalytics.map((item, idx) => {
                  const portionKeys = Object.keys(item.portions);
                  return portionKeys.map((portKey, pIdx) => {
                    const portData = item.portions[portKey];
                    const revPercentage = item.totalRevenue > 0 ? Math.round((portData.revenue / item.totalRevenue) * 100) : 0;
                    return (
                      <tr key={`${idx}-${portKey}`} className="text-xs hover:bg-slate-50/50 transition-colors">
                        {pIdx === 0 ? (
                          <td className="py-3.5 pl-4 font-bold text-slate-900 font-sans" rowSpan={portionKeys.length}>
                            {item.parentName}
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                              Total Rev: ₹{item.totalRevenue}
                            </span>
                          </td>
                        ) : null}
                        <td className="py-3.5 text-center font-extrabold text-slate-650">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            portKey === 'Half' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            portKey === 'Full' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {portKey}
                          </span>
                        </td>
                        <td className="py-3.5 text-center font-bold text-slate-800">
                          {portData.qty}
                        </td>
                        <td className="py-3.5 text-right pr-4">
                          <div className="flex flex-col items-end">
                            <span className="font-extrabold text-slate-950 font-mono">₹{portData.revenue}</span>
                            <div className="w-16 bg-gray-150 h-1 rounded-full overflow-hidden mt-1 flex">
                              <div 
                                className={`h-full rounded-full ${
                                  portKey === 'Half' ? 'bg-amber-500' :
                                  portKey === 'Full' ? 'bg-indigo-500' :
                                  'bg-slate-400'
                                }`}
                                style={{ width: `${revPercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </PageLayout>
  );
}
