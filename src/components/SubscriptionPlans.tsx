import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PageLayout from './PageLayout';
import { 
  Zap, 
  Sparkles, 
  Crown, 
  Check, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  X, 
  CheckCircle2,
  CreditCard,
  CheckCircle,
  HelpCircle,
  Lock,
  Flame,
  Gift,
  BadgePercent,
  CheckSquare,
  FileText,
  Download,
  Receipt,
  Users,
  TrendingUp,
  BarChart3,
  DollarSign,
  PieChart,
  Bell,
  Minus,
  Search,
  ChevronDown,
  Shield,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { SubscriptionInfo, RestaurantInfo, PaymentHistoryRecord } from '../types';
import { generateInvoicePDF } from '../utils/invoicePdfGenerator';

interface SubscriptionPlansProps {
  subscriptionInfo?: SubscriptionInfo;
  restaurantInfo?: RestaurantInfo;
  userEmail?: string;
  userId?: string;
  onSubscriptionUpdated?: (updatedSub: SubscriptionInfo) => Promise<void> | void;
  onGoToDashboard?: () => void;
  onShowToast?: (msg: string) => void;
}

export const PLAN_DATA = [
  {
    id: 'basic',
    name: 'Basic',
    planKey: 'basic',
    badge: 'Best for New Businesses',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold',
    accentColor: 'emerald',
    description: 'Essential POS operations for small cafés, food trucks, and single outlets starting out.',
    icon: Zap,
    isPopular: false,
    pricing: {
      monthly: { price: 999, original: 1699, period: '/month', periodText: 'Billed monthly', discountPct: 41 },
      annual: { price: 14999, original: 20000, period: '/year', periodText: 'Billed annually (₹1,250/mo)', discountPct: 25 },
      founders: { price: 5999, original: 14999, period: '/first year', periodText: 'Limited Launch Offer • Save 60%', discountPct: 60 }
    },
    features: [
      'Unlimited Orders & KOT Printing',
      'Unlimited Customers & Phone Directory',
      'Unlimited Menu Catalog Items',
      'Standard POS Billing & Tax Summaries',
      'Tax Reports & Daily Cash Register',
      'Mobile & Tablet Browser Access',
      'Future Platform Updates Included',
      'Standard Email & Chat Support'
    ]
  },
  {
    id: 'pro',
    name: 'Professional',
    planKey: 'pro',
    badge: 'Most Popular',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200/80 font-extrabold',
    accentColor: 'blue',
    description: 'Complete operational suite with full inventory, recipe costing, staff & expense tracking.',
    icon: Sparkles,
    isPopular: true,
    pricing: {
      monthly: { price: 1499, original: 2199, period: '/month', periodText: 'Billed monthly', discountPct: 32 },
      annual: { price: 19999, original: 25000, period: '/year', periodText: 'Billed annually (₹1,666/mo)', discountPct: 20 },
      founders: { price: 9999, original: 24999, period: '/first year', periodText: 'Limited Launch Offer • Save 60%', discountPct: 60 }
    },
    features: [
      'Everything in Basic plus',
      'Automated Stock & Low Inventory Audits',
      'Recipe Ingredient Costing Engine',
      'Employee Attendance & Staff Permissions',
      'Daily Expense Tracker & P&L Calculator',
      'Multi-Device Concurrent POS Sign-in',
      'Priority 24/7 Phone & WhatsApp Support'
    ]
  },
  {
    id: 'business',
    name: 'Enterprise',
    planKey: 'business',
    badge: 'Best Value',
    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200/80 font-bold',
    accentColor: 'purple',
    description: 'Advanced AI demand forecasting, multi-branch control & custom REST API integrations.',
    icon: Crown,
    isPopular: false,
    pricing: {
      monthly: { price: 2499, original: 2999, period: '/month', periodText: 'Billed monthly', discountPct: 17 },
      annual: { price: 24999, original: 30000, period: '/year', periodText: 'Billed annually (₹2,083/mo)', discountPct: 17 },
      founders: { price: 14999, original: 34999, period: '/first year', periodText: 'Limited Launch Offer • Save 57%', discountPct: 57 }
    },
    features: [
      'Everything in Professional plus',
      'Gemini AI Demand & Sales Forecasting',
      'Multi-Branch Central Outlet Dashboard',
      'Custom Webhooks & REST API Access',
      'Dedicated Customer Success Manager',
      'Custom Staff Onboarding & Setup',
      'Early Access to Beta Features',
      '24/7 VIP Escalation Support Line'
    ]
  }
];

export const FEATURE_COMPARISON = [
  { feature: 'Unlimited Orders & KOT', basic: true, pro: true, enterprise: true },
  { feature: 'Unlimited Customers Database', basic: true, pro: true, enterprise: true },
  { feature: 'Unlimited Products & Menu Catalog', basic: true, pro: true, enterprise: true },
  { feature: 'Sales & Revenue Analytics', basic: true, pro: true, enterprise: true },
  { feature: 'Sales & Tax Reports', basic: true, pro: true, enterprise: true },
  { feature: 'Inventory & Stock Auditing', basic: false, pro: true, enterprise: true },
  { feature: 'Employees & Role Permissions', basic: false, pro: true, enterprise: true },
  { feature: 'Daily Expenses & P&L Tracker', basic: false, pro: true, enterprise: true },
  { feature: 'Gemini AI Demand Forecasting', basic: false, pro: false, enterprise: true },
  { feature: 'Multi-Branch Management', basic: false, pro: false, enterprise: true },
  { feature: 'Custom REST API & Webhooks', basic: false, pro: false, enterprise: true },
  { feature: 'Dedicated Account Manager', basic: false, pro: false, enterprise: true },
  { feature: 'Priority 24/7 VIP Support', basic: false, pro: true, enterprise: true },
  { feature: 'Free Lifetime Updates', basic: true, pro: true, enterprise: true }
];

export default function SubscriptionPlans({
  subscriptionInfo,
  restaurantInfo,
  userEmail,
  userId = 'default_rest_id',
  onSubscriptionUpdated,
  onGoToDashboard,
  onShowToast
}: SubscriptionPlansProps) {
  // Billing cycle state: 'monthly' | 'annual' | 'founders'
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual' | 'founders'>('founders');
  
  // Selected plan choice
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    subscriptionInfo?.subscription_plan || 'pro'
  );

  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Live Subscription State
  const [liveSubInfo, setLiveSubInfo] = useState<SubscriptionInfo | null>(subscriptionInfo || null);

  // Payment History State
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'paid' | 'pending' | 'expired' | 'cancelled'>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedDetailsRecord, setSelectedDetailsRecord] = useState<PaymentHistoryRecord | null>(null);

  // Countdown timer state for Special Discount tab
  const [timeLeft, setTimeLeft] = useState({ hours: 18, minutes: 42, seconds: 15 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (subscriptionInfo) {
      setLiveSubInfo(subscriptionInfo);
    }
  }, [subscriptionInfo]);

  // Fetch live subscription status and history on mount or when userId changes
  useEffect(() => {
    fetchLiveSubscription();
    fetchPaymentHistory();
  }, [userId]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchQuery, historyStatusFilter]);

  const fetchLiveSubscription = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/subscription/status?restaurantId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.subscription) {
          setLiveSubInfo(json.subscription);
          if (onSubscriptionUpdated) {
            onSubscriptionUpdated(json.subscription);
          }
        }
      }
    } catch (e: any) {
      console.info('Failed to load live subscription status:', e?.message || String(e));
    }
  };

  const fetchPaymentHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/subscription/history?restaurantId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.history && Array.isArray(json.history)) {
          setPaymentHistory(json.history);
        }
      }
    } catch (e: any) {
      console.info('Failed to load payment history:', e?.message || String(e));
    } finally {
      setLoadingHistory(false);
    }
  };

  // Modals state
  const [demoPaymentModal, setDemoPaymentModal] = useState<{
    isOpen: boolean;
    planId: string;
    planName: string;
    amount: number;
    billingCycleText: string;
  } | null>(null);

  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    planName: string;
    expiryDate: string;
    price: number;
    transactionId: string;
    billingCycleText: string;
    invoiceRecord?: PaymentHistoryRecord;
  } | null>(null);

  const [failureModal, setFailureModal] = useState<{
    isOpen: boolean;
    errorMsg: string;
    planId: string;
  } | null>(null);

  // Active subscription calculations
  const currentSub = liveSubInfo || subscriptionInfo;
  const activePlan = currentSub?.subscription_plan || 'pro';
  const planName = currentSub?.plan_name || 'Professional';
  const status = currentSub?.subscription_status || 'active';
  const endDate = currentSub?.subscription_end ? new Date(currentSub.subscription_end) : null;
  const isExpired = endDate ? Date.now() > endDate.getTime() : false;

  const daysRemaining = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30;

  // Status color badge logic
  const getStatusBadge = (st: string, exp: boolean) => {
    if (exp || st === 'expired') {
      return { label: 'EXPIRED', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
    if (st === 'pending') {
      return { label: 'PENDING', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (st === 'cancelled') {
      return { label: 'CANCELLED', bg: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
    }
    if (st === 'renewing') {
      return { label: 'RENEWING', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    }
    return { label: 'ACTIVE', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  };

  const statusBadge = getStatusBadge(status, isExpired);

  // Dynamically load Razorpay SDK
  const loadRazorpaySDK = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleActivatePlan = async (planId: string, customTxId?: string) => {
    setLoadingPlanId(planId);
    try {
      const planObj = PLAN_DATA.find(p => p.id === planId) || PLAN_DATA[1];
      const cyclePricing = planObj.pricing[billingCycle];
      const amountToPay = cyclePricing.price;
      const paymentId = customTxId || `pay_rzp_${Date.now()}`;

      const cycleLabel = billingCycle === 'founders' 
        ? 'Special Discount Offer' 
        : billingCycle === 'annual' 
        ? 'Annual Billed Plan' 
        : 'Monthly Billed Plan';

      const res = await fetch('/api/subscription/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: userId,
          planId,
          billingCycle,
          razorpay_payment_id: paymentId,
          razorpay_order_id: `ord_${Date.now()}`
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.subscription) {
          setLiveSubInfo(json.subscription);
          if (onSubscriptionUpdated) {
            await onSubscriptionUpdated(json.subscription);
          }
        }

        await fetchPaymentHistory();

        const formattedExpiry = new Date(json.subscription?.subscription_end || (Date.now() + 30 * 86400000))
          .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        setSuccessModal({
          isOpen: true,
          planName: planObj.name,
          price: amountToPay,
          expiryDate: formattedExpiry,
          transactionId: paymentId,
          billingCycleText: cycleLabel,
          invoiceRecord: json.invoice
        });

        onShowToast?.(`Payment Verified! Activated OrderPoint Pro ${planObj.name} Plan.`);
      } else {
        throw new Error('Server verification failed.');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      onShowToast?.(`Error activating plan: ${err?.message || 'Server error'}`);
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSelectedPlanId(planId);
    setLoadingPlanId(planId);

    const planObj = PLAN_DATA.find(p => p.id === planId) || PLAN_DATA[1];
    const cyclePricing = planObj.pricing[billingCycle];
    const amountToPay = cyclePricing.price;

    const cycleLabel = billingCycle === 'founders' 
      ? 'Special Discount' 
      : billingCycle === 'annual' 
      ? 'Annual Plan' 
      : 'Monthly Plan';

    try {
      const sdkLoaded = await loadRazorpaySDK();

      let orderData: any = null;
      try {
        const orderRes = await fetch('/api/subscription/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, restaurantId: userId, billingCycle })
        });
        if (orderRes.ok) {
          orderData = await orderRes.json();
        }
      } catch (e) {
        console.warn('Backend Razorpay order endpoint fallback:', e);
      }

      if (sdkLoaded && (window as any).Razorpay) {
        const rzpOptions = {
          key: orderData?.keyId || 'rzp_test_placeholder',
          amount: amountToPay * 100,
          currency: 'INR',
          name: 'OrderPoint Pro',
          description: `Subscription Upgrade - ${planObj.name} (${cycleLabel})`,
          order_id: orderData?.razorpayOrderId,
          prefill: {
            name: restaurantInfo?.ownerName || restaurantInfo?.name || 'OrderPoint Partner',
            email: userEmail || restaurantInfo?.email || 'owner@orderpointpro.in',
            contact: restaurantInfo?.phone || ''
          },
          theme: {
            color: '#2563eb'
          },
          handler: async function (response: any) {
            try {
              onShowToast?.('Verifying payment signature with Razorpay...');
              
              try {
                await fetch('/api/subscription/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    planId,
                    billingCycle,
                    restaurantId: userId
                  })
                });
              } catch (verifyErr) {
                console.warn('Backend verify signature fallback:', verifyErr);
              }

              await handleActivatePlan(planId, response.razorpay_payment_id);
            } catch (err: any) {
              console.error('Subscription verification error:', err);
              setFailureModal({
                isOpen: true,
                errorMsg: err.message || 'Payment signature verification failed.',
                planId
              });
            } finally {
              setLoadingPlanId(null);
            }
          },
          modal: {
            ondismiss: function () {
              setLoadingPlanId(null);
              onShowToast?.('Subscription checkout cancelled.');
            }
          }
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.open();
      } else {
        setDemoPaymentModal({
          isOpen: true,
          planId,
          planName: planObj.name,
          amount: amountToPay,
          billingCycleText: cycleLabel
        });
      }
    } catch (err: any) {
      console.error('Error starting subscription checkout:', err);
      setDemoPaymentModal({
        isOpen: true,
        planId,
        planName: planObj.name,
        amount: amountToPay,
        billingCycleText: cycleLabel
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  // Filter payment history
  // Filter payment history by Search and Status
  const filteredHistory = paymentHistory.filter(item => {
    // 1. Status Filter
    if (historyStatusFilter !== 'all') {
      const itemStatus = (item.paymentStatus || 'paid').toLowerCase();
      if (historyStatusFilter === 'paid' && itemStatus !== 'paid') return false;
      if (historyStatusFilter === 'pending' && itemStatus !== 'pending') return false;
      if (historyStatusFilter === 'expired' && itemStatus !== 'expired' && !item.isExpired) return false;
      if (historyStatusFilter === 'cancelled' && itemStatus !== 'cancelled') return false;
    }

    // 2. Search Query (invoice number, transaction ID, customer name, plan)
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase().trim();
    const inv = (item.invoiceNumber || '').toLowerCase();
    const txn = (item.transactionId || item.razorpayPaymentId || '').toLowerCase();
    const plan = (item.planName || item.plan || '').toLowerCase();
    const cust = ((item as any).customerName || restaurantInfo?.name || '').toLowerCase();

    return inv.includes(q) || txn.includes(q) || plan.includes(q) || cust.includes(q);
  });

  // Pagination (10 entries per page)
  const ITEMS_PER_PAGE = 10;
  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  return (
    <PageLayout
      title="Subscription Plans"
      subtitle="Choose the perfect plan for your business and upgrade anytime."
      id="subscription_plans_view"
      actions={
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-xs font-bold tracking-wide shadow-2xs">
          <ShieldCheck size={14} className="text-blue-600" />
          <span>Secure Razorpay SaaS Billing Gateway</span>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto space-y-5">
        
        {/* ================= CURRENT SUBSCRIPTION CARD (COMPACT DASHBOARD) ================= */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden border border-slate-800 space-y-4">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3.5">
            
            {/* Top Row: Info & Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
              
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold font-mono">
                      CURRENT SUBSCRIPTION
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 border ${statusBadge.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-display">
                      {planName} Plan
                    </h2>
                    <span className="text-sm font-bold text-blue-400 font-mono">
                      ₹{subscriptionInfo?.subscription_price ? subscriptionInfo.subscription_price.toLocaleString('en-IN') : (activePlan === 'basic' ? '999' : activePlan === 'business' ? '2,499' : '1,499')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSubscribe(activePlan)}
                  className="h-[38px] px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <RefreshCw size={13} />
                  <span>Renew Plan</span>
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById('pricing-plans-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                    onShowToast?.('Explore upgrade plans below.');
                  }}
                  className="h-[38px] px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Crown size={13} className="text-amber-400" />
                  <span>Upgrade Plan</span>
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById('payment-history-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="h-[38px] px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Receipt size={13} />
                  <span>Payment History</span>
                </button>
              </div>

            </div>

            {/* Bottom Details Grid: 6 Compact Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
              <div className="space-y-0.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Billing Cycle</span>
                <span className="font-bold text-slate-200 capitalize truncate block">
                  {subscriptionInfo?.billing_cycle || 'monthly'}
                </span>
              </div>

              <div className="space-y-0.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Renewal Date</span>
                <span className="font-bold text-slate-200 truncate block">
                  {endDate ? endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '30 Days'}
                </span>
              </div>

              <div className="space-y-0.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Days Remaining</span>
                <span className={`font-bold truncate block ${isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isExpired ? 'Expired' : `${daysRemaining} Days`}
                </span>
              </div>

              <div className="space-y-0.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Subscription ID</span>
                <span className="font-bold text-slate-200 truncate block" title={subscriptionInfo?.subscriptionId || 'sub_init'}>
                  {subscriptionInfo?.subscriptionId || 'sub_init_active'}
                </span>
              </div>

              <div className="space-y-0.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Payment Status</span>
                <span className="font-bold text-emerald-400 uppercase truncate block">
                  {subscriptionInfo?.payment_status || 'PAID'}
                </span>
              </div>

              <div className="space-y-0.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Transaction ID</span>
                <span className="font-bold text-slate-200 truncate block" title={subscriptionInfo?.transaction_id || 'pay_init'}>
                  {subscriptionInfo?.transaction_id || 'pay_init_101'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ================= REMINDER BANNERS ================= */}
        {!isExpired && daysRemaining <= 30 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs ${
                daysRemaining <= 3 
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : daysRemaining <= 7
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  daysRemaining <= 3 ? 'bg-rose-100 text-rose-600' : daysRemaining <= 7 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <Bell size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold">
                    {daysRemaining <= 3 
                      ? `Urgent: Subscription expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}!` 
                      : `Subscription Reminder: ${daysRemaining} days remaining on your ${planName} license.`}
                  </h4>
                  <p className="text-[11px] opacity-90">Renew now to maintain continuous access to POS, Inventory, and GST features.</p>
                </div>
              </div>

              <button
                onClick={() => handleSubscribe(activePlan)}
                className="h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow shrink-0 cursor-pointer"
              >
                Renew Now
              </button>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ================= BILLING TOGGLE SWITCHER ================= */}
        <div id="pricing-plans-section" className="flex justify-center border-b border-slate-200/80 pb-3 pt-1">
          <div className="bg-slate-200/80 p-1 rounded-full border border-slate-300/70 inline-flex items-center gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setBillingCycle('monthly');
                onShowToast?.('Switched to Monthly Billing.');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => {
                setBillingCycle('annual');
                onShowToast?.('Switched to Annual Billing.');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <span>Annual</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                Save 25%
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBillingCycle('founders');
                onShowToast?.('Switched to Special Discount Offer!');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'founders'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs font-extrabold'
                  : 'bg-amber-100/70 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Flame size={13} className={billingCycle === 'founders' ? 'text-yellow-200' : 'text-amber-600'} />
              <span>Special Discount</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                billingCycle === 'founders' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                Save 60%
              </span>
            </button>
          </div>
        </div>

        {/* ================= PRICING PLANS VIEW ================= */}
        <div className="space-y-4">
            
            {/* SPECIAL DISCOUNT BANNER WITH LIVE COUNTDOWN TIMER */}
            <AnimatePresence mode="wait">
              {billingCycle === 'founders' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.99, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.99, y: -6 }}
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-3.5 sm:p-4 rounded-2xl text-white shadow-md space-y-2 border border-amber-400/40 relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-white text-[10px] font-extrabold uppercase tracking-wider border border-white/30 font-mono">
                        <Flame size={12} className="text-yellow-200" />
                        <span>LIMITED TIME OFFER • SAVE UP TO 60%</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight font-display">
                        Special Launch Discount Offer
                      </h3>
                      <p className="text-xs text-amber-100 max-w-lg">
                        Promotional pricing for restaurant registrations. Lock in your discounted rate today!
                      </p>
                    </div>

                    {/* Countdown Timer Badge */}
                    <div className="bg-black/30 backdrop-blur px-3.5 py-2 rounded-xl border border-white/20 text-center space-y-0.5 shrink-0">
                      <span className="text-[9px] font-extrabold text-yellow-300 uppercase tracking-widest block font-mono">
                        Offer Expires In:
                      </span>
                      <div className="flex items-center justify-center gap-1.5 font-mono font-bold text-sm text-white">
                        <span className="bg-white/20 px-2 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}h</span>
                        <span>:</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}m</span>
                        <span>:</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}s</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THREE EQUAL PRICING CARDS GRID (1 ROW ON DESKTOP) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch pt-1">
              {PLAN_DATA.map((plan) => {
                const IconComponent = plan.icon;
                const isCurrentActive = activePlan === plan.planKey && !isExpired;
                const isSelectedChoice = selectedPlanId === plan.id;
                const isLoadingThis = loadingPlanId === plan.id;
                
                const currentPricing = plan.pricing[billingCycle];

                return (
                  <div
                    key={plan.id}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      onShowToast?.(`Selected choice: ${plan.name} Plan`);
                    }}
                    className={`rounded-2xl bg-white p-5 transition-all duration-200 flex flex-col justify-between relative cursor-pointer select-none ${
                      plan.isPopular
                        ? 'border-2 border-blue-500 shadow-xl ring-2 ring-blue-500/10'
                        : isSelectedChoice
                        ? 'border-2 border-slate-800 shadow-lg'
                        : 'border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {/* MOST POPULAR HIGHLIGHT RIBBON */}
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>MOST POPULAR</span>
                        </span>
                      </div>
                    )}

                    <div className="space-y-4">
                      
                      {/* TOP BADGE & ICON */}
                      <div className="flex justify-between items-center">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${plan.badgeStyle}`}>
                          {plan.badge}
                        </span>

                        <div className={`p-2 rounded-xl ${
                          plan.isPopular ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <IconComponent size={18} />
                        </div>
                      </div>

                      {/* PLAN NAME & DESCRIPTION */}
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
                          <span>{plan.name}</span>
                          {isCurrentActive && (
                            <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                              Active
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 leading-tight mt-1 min-h-[28px]">
                          {plan.description}
                        </p>
                      </div>

                      {/* PRICE DISPLAY */}
                      <div className="pt-2 border-t border-slate-100 space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
                            ₹{currentPricing.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">{currentPricing.period}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-xs font-semibold text-slate-400 line-through">
                            ₹{currentPricing.original.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/80">
                            Save {currentPricing.discountPct}%
                          </span>
                        </div>

                        <p className="text-[10px] font-bold text-slate-500 font-mono pt-0.5">
                          {currentPricing.periodText}
                        </p>
                      </div>

                      <div className="w-full h-px bg-slate-100" />

                      {/* FEATURE LIST */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block font-mono">
                          What's Included:
                        </span>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-snug">
                              <Check className="text-emerald-500 stroke-[3] shrink-0 mt-0.5" size={15} />
                              <span className={feature.startsWith('Everything') ? 'font-bold text-slate-900' : 'text-slate-700 font-medium'}>
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                    </div>

                    {/* SUBSCRIBE BUTTON - COMPACT HEIGHT 42px */}
                    <div className="pt-5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubscribe(plan.id);
                        }}
                        disabled={!!loadingPlanId}
                        className={`w-full h-[42px] rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98 ${
                          isLoadingThis
                            ? 'bg-slate-400 text-white cursor-not-allowed'
                            : isCurrentActive
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                            : plan.isPopular
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                        }`}
                      >
                        {isLoadingThis ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Opening Checkout...</span>
                          </>
                        ) : isCurrentActive ? (
                          <>
                            <RefreshCw size={14} />
                            <span>Renew Current Plan</span>
                          </>
                        ) : (
                          <>
                            <CreditCard size={14} />
                            <span>Subscribe Now (₹{currentPricing.price.toLocaleString('en-IN')})</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* TRUST GUARANTEES BAR */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-0.5">
                  <ShieldCheck size={20} className="mx-auto text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">Razorpay Verified</h4>
                  <p className="text-[10px] text-slate-500">256-bit encrypted SSL checkout</p>
                </div>
                <div className="space-y-0.5">
                  <Receipt size={20} className="mx-auto text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">GST Invoice</h4>
                  <p className="text-[10px] text-slate-500">18% GST tax breakdown & PDF</p>
                </div>
                <div className="space-y-0.5">
                  <Zap size={20} className="mx-auto text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">Instant Activation</h4>
                  <p className="text-[10px] text-slate-500">Features unlocked immediately</p>
                </div>
                <div className="space-y-0.5">
                  <Users size={20} className="mx-auto text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">24/7 VIP Support</h4>
                  <p className="text-[10px] text-slate-500">Phone & WhatsApp assistance</p>
                </div>
              </div>
            </div>

          </div>

          {/* ================= PAYMENT HISTORY SECTION (READ ONLY) ================= */}
          <div id="payment-history-section" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden font-sans space-y-0">
            
            {/* Header & Controls Bar */}
            <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/50 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                    <Receipt size={20} className="text-slate-700" />
                    <span>Payment History</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    View completed subscription payments and download official tax invoices.
                  </p>
                </div>

                {/* Controls: Search and Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  
                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search invoice, ID, or customer..."
                      value={historySearchQuery}
                      onChange={e => setHistorySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs placeholder:text-slate-400"
                    />
                    {historySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setHistorySearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Status Filters */}
                  <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-xl shadow-2xs overflow-x-auto">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'paid', label: 'Paid' },
                      { id: 'pending', label: 'Pending' },
                      { id: 'expired', label: 'Expired' },
                      { id: 'cancelled', label: 'Cancelled' },
                    ].map((tab) => {
                      const isActive = historyStatusFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setHistoryStatusFilter(tab.id as any)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                </div>
              </div>
            </div>

            {/* Table or Empty State */}
            {loadingHistory ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-medium">Loading payment records...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-50/30 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                  <Receipt size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No Payment History Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your completed subscription payments will appear here.
                </p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Invoice</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Plan</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Expiry</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans text-xs">
                      {paginatedHistory.map((record) => {
                        const statusLower = (record.paymentStatus || 'paid').toLowerCase();
                        let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        if (statusLower === 'pending') badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                        else if (statusLower === 'expired') badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                        else if (statusLower === 'cancelled') badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';

                        const formattedDate = record.createdAt
                          ? new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—';

                        const formattedExpiry = record.subscriptionEnd
                          ? new Date(record.subscriptionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—';

                        return (
                          <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Invoice Number */}
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {record.invoiceNumber}
                            </td>

                            {/* Date */}
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {formattedDate}
                            </td>

                            {/* Plan */}
                            <td className="py-3 px-4 font-semibold text-slate-800 capitalize">
                              {record.planName || record.plan}
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                              ₹{record.totalAmount?.toLocaleString('en-IN') || '0'}
                            </td>

                            {/* Payment Method */}
                            <td className="py-3 px-4 text-slate-600 font-semibold uppercase text-[11px]">
                              {record.paymentMethod || 'UPI'}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border tracking-wider ${badgeStyle}`}>
                                {record.paymentStatus || 'paid'}
                              </span>
                            </td>

                            {/* Expiry */}
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {formattedExpiry}
                            </td>

                            {/* Actions (View Details & Download PDF only) */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDetailsRecord(record)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye size={12} className="text-slate-600" />
                                  <span>View</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    generateInvoicePDF(record, restaurantInfo);
                                    onShowToast?.(`Downloading invoice ${record.invoiceNumber}...`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                                  title="Download Invoice PDF"
                                >
                                  <Download size={12} />
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-slate-600">
                  <div>
                    Showing <span className="font-bold text-slate-900">{(historyPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                    <span className="font-bold text-slate-900">{Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)}</span> of{' '}
                    <span className="font-bold text-slate-900">{filteredHistory.length}</span> entries
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft size={13} />
                      <span>Previous</span>
                    </button>
                    
                    <span className="px-2 font-bold text-slate-700 text-[11px]">
                      Page {historyPage} of {totalHistoryPages}
                    </span>

                    <button
                      type="button"
                      disabled={historyPage >= totalHistoryPages}
                      onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                      className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <span>Next</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

      </div>

      {/* ================= DEMO / BACKEND CHECKOUT MODAL ================= */}
      <AnimatePresence>
        {demoPaymentModal?.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-slate-100 relative"
            >
              <button
                onClick={() => setDemoPaymentModal(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="space-y-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                  <CreditCard size={28} />
                </div>
                <h3 className="text-xl font-black text-slate-900 font-display">
                  Confirm Subscription Order
                </h3>
                <p className="text-xs text-slate-500">
                  Review subscription summary before completing payment.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Selected Plan:</span>
                  <span className="font-bold text-slate-900">{demoPaymentModal.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Billing Cycle:</span>
                  <span className="font-bold text-slate-900">{demoPaymentModal.billingCycleText}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxable Amount:</span>
                  <span className="font-bold text-slate-900">₹{Math.round(demoPaymentModal.amount / 1.18).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GST (18%):</span>
                  <span className="font-bold text-slate-900">₹{(demoPaymentModal.amount - Math.round(demoPaymentModal.amount / 1.18)).toLocaleString('en-IN')}</span>
                </div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between text-sm font-black text-slate-900">
                  <span>Total Payable:</span>
                  <span className="text-blue-600">₹{demoPaymentModal.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={async () => {
                    const pid = demoPaymentModal.planId;
                    setDemoPaymentModal(null);
                    await handleActivatePlan(pid);
                  }}
                  className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={16} />
                  <span>Proceed & Activate License</span>
                </button>

                <button
                  onClick={() => setDemoPaymentModal(null)}
                  className="w-full py-2.5 rounded-2xl text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= SUCCESS PAYMENT MODAL ================= */}
      <AnimatePresence>
        {successModal?.isOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-slate-100 text-center relative"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-50">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900 font-display">
                  Payment Successful!
                </h3>
                <p className="text-xs text-slate-500">
                  Your OrderPoint Pro subscription has been activated.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Activated Plan:</span>
                  <span className="font-bold text-slate-900">{successModal.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valid Until:</span>
                  <span className="font-bold text-emerald-600">{successModal.expiryDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-slate-900">₹{successModal.price.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment ID:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[160px]">{successModal.transactionId}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {successModal.invoiceRecord && (
                  <button
                    onClick={() => {
                      generateInvoicePDF(successModal.invoiceRecord!, restaurantInfo);
                      onShowToast?.('Tax invoice PDF downloaded.');
                    }}
                    className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-300"
                  >
                    <Download size={15} />
                    <span>Download Tax Invoice PDF</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setSuccessModal(null);
                    onGoToDashboard?.();
                  }}
                  className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowRight size={16} />
                  <span>Go to Dashboard</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= FAILURE PAYMENT MODAL ================= */}
      <AnimatePresence>
        {failureModal?.isOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-slate-100 text-center relative"
            >
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border-4 border-rose-50">
                <X size={36} />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900 font-display">
                  Payment Failed
                </h3>
                <p className="text-xs text-rose-600 font-medium">
                  {failureModal.errorMsg || 'Your transaction could not be processed.'}
                </p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Please check your network connection, card/UPI balance, or try an alternative payment method.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    const pid = failureModal.planId;
                    setFailureModal(null);
                    handleSubscribe(pid);
                  }}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={15} />
                  <span>Retry Payment</span>
                </button>

                <button
                  onClick={() => setFailureModal(null)}
                  className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PAYMENT DETAILS MODAL (READ ONLY) ================= */}
      <AnimatePresence>
        {selectedDetailsRecord && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden font-sans relative"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-slate-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">Invoice Details</h3>
                    <p className="text-[11px] font-mono text-slate-500">{selectedDetailsRecord.invoiceNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailsRecord(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body - Read Only Details */}
              <div className="p-6 space-y-4 text-xs">
                
                {/* Status Badge & Total Amount Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Total Paid</span>
                    <span className="text-xl font-extrabold text-slate-900 font-mono">
                      ₹{selectedDetailsRecord.totalAmount?.toLocaleString('en-IN') || '0'}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">
                    {selectedDetailsRecord.paymentStatus || 'PAID'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Invoice Number</span>
                    <span className="font-mono font-bold text-slate-900">{selectedDetailsRecord.invoiceNumber}</span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Customer Name</span>
                    <span className="font-bold text-slate-900 truncate block">
                      {(selectedDetailsRecord as any).customerName || restaurantInfo?.name || 'Enterprise Customer'}
                    </span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Date</span>
                    <span className="font-medium text-slate-800">
                      {selectedDetailsRecord.createdAt
                        ? new Date(selectedDetailsRecord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Transaction ID</span>
                    <span className="font-mono font-bold text-slate-900 truncate block">
                      {selectedDetailsRecord.transactionId || selectedDetailsRecord.razorpayPaymentId || 'N/A'}
                    </span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Payment Method</span>
                    <span className="font-bold text-slate-900 uppercase">{selectedDetailsRecord.paymentMethod || 'UPI'}</span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Plan Purchased</span>
                    <span className="font-bold text-slate-900 capitalize">{selectedDetailsRecord.planName || selectedDetailsRecord.plan}</span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Billing Cycle</span>
                    <span className="font-medium text-slate-800">{selectedDetailsRecord.billingCycle || 'Founders Lifetime'}</span>
                  </div>

                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Expiry Date</span>
                    <span className="font-medium text-slate-800">
                      {selectedDetailsRecord.subscriptionEnd
                        ? new Date(selectedDetailsRecord.subscriptionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Lifetime'}
                    </span>
                  </div>
                </div>

                {/* Amount Breakdown */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>Base Amount:</span>
                    <span>₹{selectedDetailsRecord.price?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                  {selectedDetailsRecord.discount > 0 && (
                    <div className="flex justify-between text-rose-600 font-sans">
                      <span>Discount Applied:</span>
                      <span>-₹{selectedDetailsRecord.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>GST (18%):</span>
                    <span>₹{selectedDetailsRecord.gst?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-xs font-sans">
                    <span>Total Amount Paid:</span>
                    <span className="font-mono text-sm">₹{selectedDetailsRecord.totalAmount?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                </div>

              </div>

              {/* Modal Footer - Allowed Actions: Download Invoice PDF & Close */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedDetailsRecord(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    generateInvoicePDF(selectedDetailsRecord, restaurantInfo);
                    onShowToast?.(`Downloading invoice ${selectedDetailsRecord.invoiceNumber}...`);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download size={14} />
                  <span>Download Invoice PDF</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </PageLayout>
  );
}
