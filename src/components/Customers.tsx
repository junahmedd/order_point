/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import PageLayout from './PageLayout';
import { Contact, Search, Plus, Award, Smartphone, UserCheck, Sparkles, X, Trash2 } from 'lucide-react';
import { Customer } from '../types';

interface CustomersProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onShowToast: (msg: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

export default function Customers({ customers, onAddCustomer, onDeleteCustomer, onShowToast, onNavigateToTab }: CustomersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const handleAddNewCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newCust: Customer = {
      id: 'c_' + Date.now(),
      name,
      phone,
      visits: 1,
      totalSpend: 0,
      lastVisit: new Date().toISOString().split('T')[0]
    };

    onAddCustomer(newCust);
    onShowToast(`Successfully registered customer ${name}!`);
    setName('');
    setPhone('');
    setIsAddModalOpen(false);
  };

  const getDinerStatus = (visits: number) => {
    if (visits >= 10) return { label: 'Imperial Gold Member', bg: 'bg-amber-50 text-amber-600 border-amber-200' };
    if (visits >= 5) return { label: 'Silver Regular', bg: 'bg-blue-50 text-blue-600 border-blue-200' };
    return { label: 'New Companion', bg: 'bg-gray-50 text-gray-500 border-gray-200' };
  };

  return (
    <PageLayout
      title="Customers"
      subtitle="View customer profiles and order history."
      id="customers_view"
      activeTab="Customers"
      onTabChange={onNavigateToTab}
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="h-[52px] px-6 bg-[#111111] hover:bg-[#222222] text-white rounded-[16px] text-sm font-bold tracking-wide uppercase flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
        >
          <Plus size={16} />
          + Register Customer
        </button>
      }
    >

      {/* Filter bar */}
      <div className="bg-white rounded-[28px] border-none p-4 shadow-[0_8px_25px_rgba(0,0,0,0.05)] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B8B8B]" />
          <input
            id="customer_search_bar"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients by name or phone..."
            className="w-full h-11 pl-12 pr-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all font-sans"
          />
        </div>
      </div>

      {/* Main Customers table */}
      <div className="bg-white border-none rounded-[28px] overflow-hidden shadow-[0_8px_25px_rgba(0,0,0,0.05)] overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#ECECEC] bg-[#F8F8F8] text-[11px] font-extrabold text-[#8B8B8B] uppercase tracking-[2px]">
              <th className="p-5 pl-8">Customer Name</th>
              <th className="p-5">WhatsApp Phone</th>
              <th className="p-5 text-center">Visits</th>
              <th className="p-5 text-center">Total Spend</th>
              <th className="p-5 text-center">Last Active Visit</th>
              <th className="p-5 text-center">Loyalty Badge</th>
              <th className="p-5 pr-8 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEEEEE] text-sm font-sans">
            {filteredCustomers.map(cust => {
              const b = getDinerStatus(cust.visits);
              return (
                <tr id={`customer_row_${cust.id}`} key={cust.id} className="hover:bg-[#F8F8F8] transition-colors">
                  <td className="p-5 pl-8 font-semibold text-[#111111]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F7F7F7] flex items-center justify-center font-bold text-xs text-[#111111] border border-[#ECECEC]">
                        {cust.name[0]}
                      </div>
                      <span>{cust.name}</span>
                    </div>
                  </td>
                  <td className="p-5 text-[#8B8B8B] font-mono text-xs font-semibold">
                    {cust.phone}
                  </td>
                  <td className="p-5 text-center font-extrabold text-[#111111]">
                    {cust.visits} times
                  </td>
                  <td className="p-5 text-center font-extrabold text-[#111111]">
                    ₹{cust.totalSpend}
                  </td>
                  <td className="p-5 text-center text-[#8B8B8B] font-mono text-xs font-semibold">
                    {cust.lastVisit}
                  </td>
                  <td className="p-5 text-center">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border tracking-wider ${b.bg.replace('bg-amber-50 text-amber-600 border-amber-200', 'bg-[#FFF9C4] text-[#F57F17] border-[#FBC02D]').replace('bg-blue-50 text-blue-600 border-blue-200', 'bg-[#E1F5FE] text-[#0284C7] border-[#B3E5FC]').replace('bg-gray-50 text-gray-500 border-gray-200', 'bg-[#F5F5F5] text-[#757575] border-[#E0E0E0]')}`}>
                      {b.label}
                    </span>
                  </td>
                  <td className="p-5 pr-8 text-center">
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete customer ${cust.name}?`)) {
                          onDeleteCustomer(cust.id);
                          onShowToast(`Deleted customer ${cust.name}.`);
                        }
                      }}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-red-100"
                      title="Delete Customer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add customer Modal overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-xl border border-[#EEEEEE] animate-fade-in space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Contact className="text-[#111111]" size={18} />
                <h3 className="text-lg font-bold text-[#111111]">Register Loyal Diner</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-[#111111]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8B8B8B] uppercase block">Customer Full Name</label>
                <input
                  id="modal_cust_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jean Alvi"
                  className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#8B8B8B] uppercase block">WhatsApp Phone Number</label>
                <input
                  id="modal_cust_phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                    setPhone(numericVal);
                  }}
                  maxLength={10}
                  placeholder="e.g. 9582238472"
                  className="w-full h-11 px-4 bg-[#F8F8F8] border border-[#EEEEEE] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111] font-mono"
                  required
                />
                {phone.length > 0 && (
                  <p className={`text-[10px] font-medium ${phone.length === 10 && /^[6-9]/.test(phone) ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {phone.length < 10 
                      ? "Please enter a valid 10-digit mobile number." 
                      : (!/^[6-9]/.test(phone) 
                        ? "Mobile number must start with 6, 7, 8, or 9." 
                        : "✓ Valid WhatsApp mobile number")}
                  </p>
                )}
              </div>

              <button
                id="modal_save_cust_btn"
                type="submit"
                disabled={!name.trim() || phone.length !== 10 || !/^[6-9]/.test(phone)}
                className={`w-full h-[52px] rounded-[16px] text-sm font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.99] ${
                  name.trim() && phone.length === 10 && /^[6-9]/.test(phone)
                    ? 'bg-[#111111] hover:bg-[#222222] text-white cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Register Account
              </button>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
