/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  Package,
  Users,
  Contact,
  LineChart,
  QrCode,
  Settings,
  LogOut,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  User,
  Star,
  Lock,
  Sparkles,
  Zap,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { SubscriptionInfo } from '../types';

export type SidebarTab =
  | 'Dashboard'
  | 'Orders'
  | 'Kitchen'
  | 'Billing'
  | 'Menu'
  | 'Inventory'
  | 'Staff'
  | 'Customers'
  | 'Reports'
  | 'Feedback'
  | 'ScanGo'
  | 'Settings'
  | 'SuperAdmin';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  adminName: string;
  onLogout: () => void;
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  restaurantName: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  settingsSection?: string;
  onSettingsSectionChange?: (sec: string) => void;
  subscription?: SubscriptionInfo;
  userRole?: string | null;
  userEmail?: string | null;
  stores?: { id: string; name: string }[];
  activeStoreId?: string | null;
  onSwitchStore?: (id: string) => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  adminName,
  onLogout,
  isOpenOnMobile,
  onCloseMobile,
  restaurantName,
  isCollapsed,
  onToggleCollapse,
  settingsSection,
  onSettingsSectionChange,
  subscription,
  userRole,
  userEmail,
  stores,
  activeStoreId,
  onSwitchStore
}: SidebarProps) {
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  // Clean, simple navigation list: Scan Now positioned right above Settings
  const navigationItems: { id: SidebarTab; label: string; icon: any; isLocked?: boolean }[] = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Orders', label: 'Orders', icon: ShoppingCart },
    { id: 'Kitchen', label: 'Kitchen', icon: ChefHat },
    { id: 'Billing', label: 'Billing', icon: Receipt },
    { id: 'Menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'Inventory', label: 'Inventory', icon: Package },
    { id: 'Reports', label: 'Reports', icon: LineChart },
    { id: 'ScanGo', label: 'Scan Now', icon: QrCode },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  const isSuperAdmin = userRole === 'super_admin' || userEmail === 'admin@orderpointpro.in' || userEmail === 'zaid@orderpointpro.in' || userEmail?.includes('admin@orderpoint');
  if (isSuperAdmin) {
    navigationItems.push({ id: 'SuperAdmin', label: 'Super Admin', icon: Shield });
  }

  const handleTabClick = (tabId: SidebarTab) => {
    onTabChange(tabId);
    if (isOpenOnMobile) {
      onCloseMobile();
    }
  };

  const displayName = adminName && adminName !== "Mohammed Zaid'..." ? adminName : 'Mohammed Zaid';
  
  // Set widths
  const sidebarWidth = isCollapsed ? 'w-[72px]' : 'w-[220px]';

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpenOnMobile && (
        <div
          id="sidebar_backdrop"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar */}
      <aside
        id="sidebar_container"
        className={`fixed inset-y-0 left-0 bg-[#030B1C] text-slate-400 w-[280px] lg:${sidebarWidth} transform ${
          isOpenOnMobile ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:relative lg:h-screen transition-all duration-300 ease-in-out z-50 flex flex-col justify-between shrink-0 border-r border-blue-950/60 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]`}
      >
        {/* Brand/Status Header */}
        <div className="p-4 border-b border-blue-950/50 flex-shrink-0 h-[72px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className={`flex items-center ${isCollapsed ? 'lg:justify-center lg:w-full gap-3' : 'gap-3'}`}>
              <div className="w-[36px] h-[36px] rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-sans shrink-0 shadow-md shadow-blue-900/40 ring-1 ring-blue-400/30 transition-all">
                <Layers size={18} />
              </div>
              {(!isCollapsed || isOpenOnMobile) && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300">
                  <span className="text-white font-[800] text-[15px] leading-none tracking-tight font-sans truncate">
                    ORDERPOINT PRO
                  </span>
                  <span className="text-blue-300 text-[9px] font-extrabold mt-1 leading-none uppercase tracking-widest truncate opacity-90">
                    POS SYSTEM
                  </span>
                  {restaurantName && restaurantName.toLowerCase() !== 'orderpoint pro' && (
                    <span className="text-blue-400 text-[11px] font-[800] mt-1.5 leading-none uppercase tracking-widest truncate max-w-[140px]">
                      {restaurantName}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Collapse Toggle for Desktop */}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center text-blue-300 hover:text-white transition-colors rounded-lg hover:bg-blue-900/30 p-1.5 absolute right-[-14px] top-5 bg-[#07132B] border border-blue-900/60 shadow-sm z-50"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
            </button>

            {/* Close button for Mobile */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-slate-400 hover:text-white focus:outline-none p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable navigation menu tabs */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-[4px] scrollbar-thin scrollbar-thumb-blue-950">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isSettings = item.id === 'Settings';
            const showSubMenu = isSettings && settingsExpanded && !isCollapsed;

            return (
              <div key={item.id} className="space-y-[4px]">
                <button
                  id={`tab_${item.id}`}
                  onClick={() => {
                    handleTabClick(item.id);
                  }}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3.5 px-4'} py-3 text-xs rounded-xl transition-all duration-150 font-sans tracking-wide shrink-0 ${
                    isActive
                      ? 'bg-[#0A1E45] text-blue-300 font-extrabold border border-blue-500/30 shadow-sm shadow-blue-950/50'
                      : 'text-slate-400 hover:bg-[#071530] hover:text-blue-200 font-medium'
                  }`}
                  title={item.label}
                >
                  <Icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="leading-none whitespace-nowrap text-left">{item.label}</span>
                      {item.isLocked && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase flex items-center gap-1 border border-amber-500/30 ml-1">
                          <Lock size={10} />
                          <span>PRO</span>
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Profile Section */}
        <div className="p-3 border-t border-blue-950/50 bg-[#020814]/90 flex-shrink-0 space-y-2">
          {stores && stores.length > 1 && !isCollapsed && (
            <div className="px-1.5 pb-1 select-none w-full text-left">
              <span className="text-[9px] font-black uppercase text-blue-400/70 tracking-wider block mb-1">Select Outlet</span>
              <select
                value={activeStoreId || ''}
                onChange={(e) => onSwitchStore?.(e.target.value)}
                className="w-full bg-[#07132B] border border-blue-900/40 rounded-lg text-[11px] font-bold text-white py-1.5 px-2 focus:outline-none focus:border-blue-500"
              >
                {stores.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={`flex items-center ${isCollapsed && !isOpenOnMobile ? 'justify-center flex-col gap-2 py-2' : 'justify-between gap-2 bg-[#07132B] p-2.5 border border-blue-900/40'} rounded-[14px] transition-all duration-300`}>
            <div className={`flex items-center ${isCollapsed && !isOpenOnMobile ? 'justify-center' : 'gap-2.5'} overflow-hidden`}>
              {/* User Avatar */}
              <div className="w-[32px] h-[32px] rounded-full bg-[#0A1E45] text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/20">
                <User size={16} />
              </div>
              {(!isCollapsed || isOpenOnMobile) && (
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-white text-[13px] font-bold font-sans truncate leading-none mb-1">
                    {displayName}
                  </span>
                  <span className="inline-block self-start px-1.5 py-[2px] bg-blue-500/15 text-blue-300 border border-blue-400/20 text-[8px] font-black tracking-widest uppercase rounded">
                    Admin
                  </span>
                </div>
              )}
            </div>
            
            {/* Logout button */}
            <button
              id="sidebar_logout_btn"
              onClick={onLogout}
              className={`text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all shrink-0 flex items-center justify-center ${isCollapsed ? 'w-[32px] h-[32px] rounded-xl' : 'p-1.5 rounded-xl'}`}
              title="Logout Session"
            >
              <LogOut size={isCollapsed ? 16 : 16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
