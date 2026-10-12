import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ChefHat, 
  Receipt, 
  UtensilsCrossed, 
  Package, 
  LineChart, 
  Settings,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  customPadding?: string;
  activeTab?: string;
  onTabChange?: (tab: any) => void;
}

export default function PageLayout({
  title,
  subtitle,
  actions,
  children,
  id,
  customPadding,
  activeTab,
  onTabChange
}: PageLayoutProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSyncClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1000);
  };

  const navItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Orders', label: 'Orders / POS', icon: ShoppingCart },
    { id: 'Kitchen', label: 'Kitchen Screen', icon: ChefHat },
    { id: 'Billing', label: 'Billing Desk', icon: Receipt },
    { id: 'Menu', label: 'Menu Catalog', icon: UtensilsCrossed },
    { id: 'Inventory', label: 'Inventory', icon: Package },
    { id: 'Reports', label: 'Reports & Stats', icon: LineChart },
    { id: 'Settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <div id={id} className="w-full flex-1 flex flex-col min-h-0 bg-[#f9fafb] text-gray-900 animate-fade-in font-sans">
      {/* Reusable left-aligned Page Header */}
      <div className="w-full bg-white border-b border-gray-100 py-4 px-4 sm:px-6 shrink-0 z-30 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 text-left flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-gray-950 tracking-tight leading-none uppercase truncate">
                {title}
              </h1>
              {/* Cloud Sync Pulse Indicator */}
              <div 
                onClick={handleSyncClick}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 border border-sky-200/80 text-sky-700 hover:bg-sky-100 rounded-full text-[9px] font-black uppercase tracking-widest leading-none cursor-pointer transition-all select-none shadow-xs"
                title="System real-time synchronized. Click to force check."
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-sky-500 ${isSyncing ? 'animate-spin' : 'animate-pulse'}`} />
                <RefreshCw size={8} className={`stroke-[3] ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">LIVE SYNCED</span>
              </div>
            </div>
            {subtitle && (
              <p className="text-xs font-semibold text-gray-500 mt-1 leading-normal truncate">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            {actions}
          </div>
        </div>
      </div>

      {/* Page Content Body */}
      <div className={customPadding ? `w-full ${customPadding}` : "flex-1 w-full p-3 sm:p-6 overflow-y-auto space-y-6"}>
        {children}
      </div>
    </div>
  );
}
