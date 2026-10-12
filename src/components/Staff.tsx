/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import PageLayout from './PageLayout';
import { Users, UserPlus, Shield, Smartphone, Mail, X, Check, Search, Sparkles, Lock, ArrowRight } from 'lucide-react';
import { StaffMember } from '../types';

interface StaffProps {
  staffMembers: StaffMember[];
  onAddStaff: (member: StaffMember) => void;
  onUpdateStaff: (member: StaffMember) => void;
  onShowToast: (msg: string) => void;
  subscriptionPlan?: string;
  isExpired?: boolean;
  onUpgradeToPro?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function Staff({ 
  staffMembers, 
  onAddStaff, 
  onUpdateStaff, 
  onShowToast,
  subscriptionPlan = 'pro',
  isExpired = false,
  onUpgradeToPro,
  onNavigateToTab
}: StaffProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState('Waiter');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // PLAN LOCK GUARD: Basic Plan or Expired License
  const isLocked = subscriptionPlan === 'basic' || isExpired;

  if (isLocked) {
    return (
      <PageLayout
        title="Staff Directory & Access"
        subtitle="Manage restaurant staff, kitchen roles, and waiter POS permissions."
        activeTab="Staff"
        onTabChange={onNavigateToTab}
      >
        <div className="max-w-3xl mx-auto my-8 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 rounded-3xl text-white shadow-2xl border border-slate-800 text-center space-y-6 relative overflow-hidden">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-900/20 animate-pulse">
            <Lock size={38} className="stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block font-mono">
              {isExpired ? 'License Expired' : 'Pro Plan Feature'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Unlock Staff Roles & Team Control
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              {isExpired 
                ? 'Your OrderPoint Pro subscription has expired. Renew your plan to restore staff logins & role management.' 
                : 'Staff & Role Management is exclusive to Pro & Business plans. Upgrade to assign custom permissions to waiters, chefs, and cashiers.'}
            </p>
          </div>

          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 text-left max-w-md mx-auto space-y-3 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block font-mono">
              What You Get with Pro Plan:
            </span>
            <ul className="space-y-2.5 text-slate-200">
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>Unlimited Staff Profiles (Waiters, Chefs, Cashiers)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>Role-based POS permissions & PIN security</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>Staff attendance & shift activity logging</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={onUpgradeToPro}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-900/30 transition-all inline-flex items-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Sparkles size={16} />
              <span>Upgrade to Pro Plan (₹1499/mo)</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const filteredStaff = staffMembers.filter(st =>
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNewStaff = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newStaff: StaffMember = {
      id: 's_' + Date.now(),
      name,
      role,
      email,
      phone: phone || 'N/A',
      status: 'Active'
    };

    onAddStaff(newStaff);
    onShowToast(`Successfully onboarded ${name} as ${role}!`);
    setName('');
    setEmail('');
    setPhone('');
    setIsAddModalOpen(false);
  };

  const handleToggleStatus = (st: StaffMember) => {
    const nextStatus = st.status === 'Active' ? 'On Leave' : 'Active';
    onUpdateStaff({ ...st, status: nextStatus });
    onShowToast(`${st.name}'s status updated to ${nextStatus}`);
  };

  return (
    <PageLayout
      title="Staff Management"
      subtitle="Manage employees, roles, and permissions."
      id="staff_view"
      activeTab="Staff"
      onTabChange={onNavigateToTab}
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="h-[52px] px-6 bg-[#111111] hover:bg-[#222222] text-white rounded-[16px] text-sm font-bold tracking-wide uppercase flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
        >
          <UserPlus size={16} />
          + Add Staff Member
        </button>
      }
    >

      {/* Filter and search */}
      <div className="bg-white rounded-[28px] border-none p-4 shadow-[0_8px_25px_rgba(0,0,0,0.05)] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B8B8B]" />
          <input
            id="staff_search_bar"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team member by name or role..."
            className="w-full h-11 pl-12 pr-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all font-sans"
          />
        </div>
      </div>

      {/* Staff Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredStaff.map(st => {
          const isActive = st.status === 'Active';
          return (
            <div
              id={`staff_card_${st.id}`}
              key={st.id}
              className="bg-white border-none rounded-[28px] p-6 shadow-[0_8px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] hover:translate-y-[-2px] transition-all duration-300 flex flex-col justify-between h-[250px]"
            >
              <div>
                <div className="flex justify-between items-start">
                  {/* Avatar bubble */}
                  <div className="w-12 h-12 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#111111] font-[800] text-sm border border-[#ECECEC]">
                    {st.name.split(' ').map(n=>n[0]).join('')}
                  </div>

                  {/* Status Indicator capsule */}
                  <button
                    id={`btn_toggle_staff_status_${st.id}`}
                    onClick={() => handleToggleStatus(st)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      isActive
                        ? 'bg-[#E8F5E9] text-[#22C55E] border-[#C8E6C9] hover:bg-[#C8E6C9]'
                        : 'bg-[#FEE2E2] text-[#EF4444] border-[#FFCDD2] hover:bg-[#FFCDD2]'
                    }`}
                  >
                    {isActive ? 'Active' : 'On Leave'}
                  </button>
                </div>

                <div className="mt-4">
                  <h3 className="text-md font-bold text-[#111111] leading-tight flex items-center gap-1.5">
                    {st.name}
                  </h3>
                  <p className="text-xs text-[#22C55E] font-bold tracking-wide mt-1.5 uppercase bg-[#E8F5E9] px-2.5 py-0.5 rounded-md inline-block">
                    {st.role}
                  </p>
                </div>
              </div>

              {/* Contacts */}
              <div className="space-y-2 pt-4 border-t border-[#ECECEC] text-xs font-semibold text-[#8B8B8B]">
                <div className="flex items-center gap-2.5">
                  <Mail size={13} className="text-gray-400" />
                  <span className="truncate">{st.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Smartphone size={13} className="text-gray-400" />
                  <span>{st.phone}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Onboarding Member Overlay dialog */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-xl border border-[#EEEEEE] animate-fade-in space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="text-[#111111]" size={18} />
                <h3 className="text-lg font-bold text-[#111111]">Onboard Team Member</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-[#111111]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8B8B8B] uppercase block">Full Name</label>
                <input
                  id="modal_staff_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Preeti Sharma"
                  className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#8B8B8B] uppercase block">Work Role</label>
                  <select
                    id="modal_staff_role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full h-11 px-3 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none"
                  >
                    <option value="Waiter">Waiter</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Head Chef">Head Chef</option>
                    <option value="Sous Chef">Sous Chef</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#8B8B8B] uppercase block">Contact Mobile</label>
                  <input
                    id="modal_staff_phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8B8B8B] uppercase block">Corporate Email Address</label>
                <input
                  id="modal_staff_email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@orderpoint.com"
                  className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  required
                />
              </div>

              <button
                id="modal_save_staff_btn"
                type="submit"
                className="w-full h-[52px] bg-[#111111] hover:bg-[#222222] text-white rounded-[16px] text-sm font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.99]"
              >
                Onboard Employee
              </button>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
