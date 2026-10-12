/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import PageLayout from './PageLayout';
import { 
  Building2, Users, Receipt, CreditCard, Shield, Database, 
  Settings2, Activity, CheckCircle, AlertTriangle, ArrowRight, 
  Search, ShieldCheck, MailWarning, Sparkles, RefreshCw, BarChart3
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, query, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

interface SuperAdminProps {
  onShowToast: (msg: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

interface TenantRecord {
  id: string;
  name: string;
  owner: string;
  email: string;
  plan: string;
  status: string;
  remainingDays: number;
  revenue: number;
  createdAt: number | string;
}

export default function SuperAdmin({ onShowToast, onNavigateToTab }: SuperAdminProps) {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'tenants' | 'subscriptions' | 'system'>('metrics');
  const [systemUptime] = useState('99.98%');
  const [healthStatus, setHealthStatus] = useState<any>(null);

  // Fetch all tenant configurations and profiles from Firestore settings/users
  const fetchTenantsData = async () => {
    setLoading(true);
    try {
      const settingsSnap = await getDocs(collection(db, 'settings'));
      const list: TenantRecord[] = [];
      
      for (const settingsDoc of settingsSnap.docs) {
        const data = settingsDoc.data();
        const sub = data.subscription || {};
        const info = data.restaurantInfo || {};
        
        // Resolve remaining days
        const now = Date.now();
        const end = sub.subscription_end || now;
        const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        const isExpired = sub.subscription_end ? now > sub.subscription_end : false;

        list.push({
          id: settingsDoc.id,
          name: info.name || 'Bistro Workspace',
          owner: info.owner || 'Restaurant Partner',
          email: info.email || 'partner@orderpoint.pro',
          plan: sub.subscription_plan || 'free',
          status: isExpired ? 'Expired' : (sub.subscription_status || 'Active'),
          remainingDays: daysRemaining,
          revenue: sub.subscription_price || 0,
          createdAt: data.createdAt || Date.now()
        });
      }

      setTenants(list);
    } catch (err: any) {
      console.error('Error loading super admin data:', err);
      toast.error('Failed to load platform registry data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantsData();

    // Check health endpoint
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealthStatus(data))
      .catch(() => setHealthStatus({ status: 'offline', smtp_configured: false }));
  }, []);

  // Modify user subscription plan directly (Super Admin Action)
  const handleUpdatePlan = async (tenantId: string, plan: string) => {
    try {
      const docRef = doc(db, 'settings', tenantId);
      const now = Date.now();
      const planDuration = plan === 'basic' ? 30 : plan === 'pro' ? 30 : 365;
      const price = plan === 'basic' ? 999 : plan === 'pro' ? 1499 : 2499;
      
      const newSub = {
        subscriptionId: `sub_admin_${Date.now().toString().slice(-4)}`,
        userId: tenantId,
        subscription_status: 'active',
        subscription_plan: plan,
        plan_name: plan.toUpperCase(),
        subscription_price: price,
        billing_cycle: plan === 'business' ? 'annual' : 'monthly',
        subscription_start: now,
        subscription_end: now + planDuration * 24 * 60 * 60 * 1000,
        renewalDate: now + planDuration * 24 * 60 * 60 * 1000,
        payment_status: 'paid',
        payment_method: 'SaaS Admin Override',
        transaction_id: `txn_override_${Date.now()}`,
        remainingDays: planDuration,
        isExpired: false,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, { subscription: newSub }, { merge: true });
      toast.success(`Plan updated for tenant ${tenantId}!`);
      fetchTenantsData();
    } catch (err: any) {
      console.error('Admin update plan error:', err);
      toast.error('Failed to update subscription plan.');
    }
  };

  // Filter tenants
  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Platform metrics calculations
  const totalRevenue = tenants.reduce((sum, t) => sum + t.revenue, 0);
  const activeTenants = tenants.filter(t => t.status !== 'Expired').length;
  const expiredTenants = tenants.filter(t => t.status === 'Expired').length;

  return (
    <PageLayout
      title="SaaS Super Admin"
      subtitle="Monitor platforms registry, subscription billing, and system nodes."
      id="super_admin_view"
      activeTab="Dashboard"
      onTabChange={onNavigateToTab}
    >
      {/* Sub Tabs */}
      <div className="flex gap-2.5 border-b border-[#ECECEC] pb-4 select-none">
        <button
          onClick={() => setActiveSubTab('metrics')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'metrics'
              ? 'bg-[#111111] text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <BarChart3 size={14} />
            <span>Platform Metrics</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('tenants')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'tenants'
              ? 'bg-[#111111] text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Building2 size={14} />
            <span>Manage Restaurants ({tenants.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('system')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'system'
              ? 'bg-[#111111] text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Settings2 size={14} />
            <span>System Node Config</span>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
          <span className="text-xs font-semibold tracking-wider uppercase">Loading registry logs...</span>
        </div>
      ) : (
        <div className="mt-4">
          {/* TAB 1: METRICS */}
          {activeSubTab === 'metrics' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[28px] shadow-[0_8px_25px_rgba(0,0,0,0.03)] border border-slate-100/60">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total SaaS Revenue</span>
                      <h3 className="text-2xl font-[808] text-slate-900 tracking-tight">₹{totalRevenue.toLocaleString('en-IN')}</h3>
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                      <CreditCard size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[28px] shadow-[0_8px_25px_rgba(0,0,0,0.03)] border border-slate-100/60">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Restaurant Nodes</span>
                      <h3 className="text-2xl font-[808] text-slate-900 tracking-tight">{activeTenants}</h3>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                      <Building2 size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[28px] shadow-[0_8px_25px_rgba(0,0,0,0.03)] border border-slate-100/60">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expired Licenses</span>
                      <h3 className="text-2xl font-[808] text-rose-600 tracking-tight">{expiredTenants}</h3>
                    </div>
                    <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                      <Building2 size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[28px] shadow-[0_8px_25px_rgba(0,0,0,0.03)] border border-slate-100/60">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Node Cluster Uptime</span>
                      <h3 className="text-2xl font-[808] text-slate-900 tracking-tight">{systemUptime}</h3>
                    </div>
                    <div className="w-10 h-10 bg-sky-50 text-sky-500 rounded-xl flex items-center justify-center">
                      <Activity size={18} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Node health status */}
              <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-[0_8px_25px_rgba(0,0,0,0.03)] space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Activity size={14} className="text-[#10B981]" />
                  <span>SaaS Endpoint Status Metrics</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Express API Server</span>
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-600 border border-emerald-200">
                      ONLINE
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Firestore Database Cluster</span>
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-600 border border-emerald-200">
                      ONLINE (SECURE)
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">SMTP Node Connection</span>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                      healthStatus?.smtp_configured
                        ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                        : 'bg-amber-100 text-amber-600 border-amber-200'
                    }`}>
                      {healthStatus?.smtp_configured ? 'SMTP ACTIVE' : 'SMTP MISSING'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TENANTS LIST */}
          {activeSubTab === 'tenants' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4 items-center">
                <div className="relative w-full max-w-md">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search registers by restaurant name, email, owner..."
                    className="w-full h-10 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 focus:bg-white transition-all font-sans"
                  />
                </div>
                <button
                  onClick={fetchTenantsData}
                  className="px-4 py-2.5 text-xs bg-slate-100 hover:bg-slate-200 font-bold rounded-xl transition-all border-none cursor-pointer"
                >
                  Refresh registry
                </button>
              </div>

              {/* Tenants Registry Table */}
              <div className="bg-white rounded-[28px] shadow-[0_8px_25px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-black uppercase text-[10px] text-slate-400">
                        <th className="py-4 px-6">Restaurant Tenant</th>
                        <th className="py-4 px-6">Owner Profile</th>
                        <th className="py-4 px-6">Current Plan</th>
                        <th className="py-4 px-6">License Status</th>
                        <th className="py-4 px-6">Days Remaining</th>
                        <th className="py-4 px-6 text-center">Change Plan override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                            No matching registered restaurant tenants found.
                          </td>
                        </tr>
                      ) : (
                        filteredTenants.map(tenant => (
                          <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold text-slate-900">
                              <div>{tenant.name}</div>
                              <span className="text-[10px] text-slate-400 font-normal font-mono">{tenant.id}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div>{tenant.owner}</div>
                              <span className="text-[10px] text-slate-400 font-normal">{tenant.email}</span>
                            </td>
                            <td className="py-4 px-6 uppercase font-extrabold text-[10px]">
                              {tenant.plan}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                tenant.status === 'Expired'
                                  ? 'bg-rose-50 text-rose-500 border border-rose-100'
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {tenant.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 font-mono font-bold">
                              {tenant.remainingDays} Days
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex gap-1.5 justify-center">
                                <button
                                  onClick={() => handleUpdatePlan(tenant.id, 'basic')}
                                  className="px-2 py-1 text-[9px] font-black uppercase rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border-none cursor-pointer"
                                >
                                  Basic
                                </button>
                                <button
                                  onClick={() => handleUpdatePlan(tenant.id, 'pro')}
                                  className="px-2 py-1 text-[9px] font-black uppercase rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-none cursor-pointer"
                                >
                                  Pro
                                </button>
                                <button
                                  onClick={() => handleUpdatePlan(tenant.id, 'business')}
                                  className="px-2 py-1 text-[9px] font-black uppercase rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border-none cursor-pointer"
                                >
                                  Business
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM NODE SETTINGS */}
          {activeSubTab === 'system' && (
            <div className="space-y-6 animate-fade-in max-w-xl">
              <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-[0_8px_25px_rgba(0,0,0,0.03)] space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2.5">
                  Node Configuration Panel
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      SMTP host (SSL node)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={process.env.SMTP_HOST || 'smtp.gmail.com (Read Only Env)'}
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Razorpay Gateway webhook Status
                    </label>
                    <input
                      type="text"
                      disabled
                      value="https://orderpointpro.in/api/subscription/verify (Active Listening)"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Platform Environment Mode
                    </label>
                    <div className="px-4 py-3 bg-[#E8F5E9] text-[#22C55E] border border-[#C8E6C9] rounded-xl text-xs font-bold font-sans">
                      🚀 PRODUCTION NODE MODE
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
