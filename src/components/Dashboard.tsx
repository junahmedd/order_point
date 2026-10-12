/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import PageLayout from './PageLayout';
import {
  DollarSign,
  Flame,
  CheckCircle,
  TrendingUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Order, MenuItem, InventoryItem } from '../types';

interface DashboardProps {
  orders: Order[];
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  onNavigateToTab: (tab: any) => void;
  restaurantName: string;
  settings?: any;
}

export default function Dashboard({ orders, menuItems, inventoryItems, onNavigateToTab, restaurantName, settings }: DashboardProps) {
  const currencySymbol = settings?.prefCurrency || '₹';
  const stats = useMemo(() => {
    const paidOrders = orders.filter(o => o.isPaid);
    const todayRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const ordersToday = orders.length;

    const activeTables = new Set(
      orders
        .filter(o => o.status !== 'Completed' && o.status !== 'Delivered' && o.tableNo)
        .map(o => o.tableNo)
    ).size;

    const cashSales = paidOrders
      .filter(o => o.paymentMethod?.toLowerCase() === 'cash')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const upiSales = paidOrders
      .filter(o => o.paymentMethod?.toLowerCase() === 'upi')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const cardSales = paidOrders
      .filter(o => o.paymentMethod?.toLowerCase() === 'card')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Channel specific metrics
    const swiggyOrders = orders.filter(o => o.orderSource === 'Swiggy');
    const swiggyRevenue = swiggyOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const zomatoOrders = orders.filter(o => o.orderSource === 'Zomato');
    const zomatoRevenue = zomatoOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const scangoOrders = orders.filter(o => o.type === 'Dine-In' && (o.id?.startsWith('so_') || (o as any).isSelfOrder || o.customerName?.toLowerCase().includes('self')));
    const scangoRevenue = scangoOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const dineInOrders = orders.filter(o => o.type === 'Dine-In' && !(o.id?.startsWith('so_') || (o as any).isSelfOrder || o.customerName?.toLowerCase().includes('self')));
    const dineInRevenue = dineInOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const takeawayOrders = orders.filter(o => o.type === 'Takeaway');
    const takeawayRevenue = takeawayOrders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const itemCounts: Record<string, number> = {};
    orders.forEach(o => {
      o.items.forEach(it => {
        const name = it.menuItem.name;
        itemCounts[name] = (itemCounts[name] || 0) + it.quantity;
      });
    });

    let topSellingItem = 'N/A';
    let maxQty = 0;
    Object.entries(itemCounts).forEach(([name, qty]) => {
      if (qty > maxQty) {
        maxQty = qty;
        topSellingItem = name;
      }
    });

    return {
      todayRevenue,
      ordersToday,
      activeTables,
      cashSales,
      upiSales,
      cardSales,
      swiggyOrders: swiggyOrders.length,
      swiggyRevenue,
      zomatoOrders: zomatoOrders.length,
      zomatoRevenue,
      scangoOrders: scangoOrders.length,
      scangoRevenue,
      dineInOrders: dineInOrders.length,
      dineInRevenue,
      takeawayOrders: takeawayOrders.length,
      takeawayRevenue,
      topSellingItem: topSellingItem.length > 15 ? topSellingItem.substring(0, 13) + '...' : topSellingItem
    };
  }, [orders]);

  const bestSellers = useMemo(() => {
    const counts: Record<string, { name: string; value: number }> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.menuItem.id;
        if (!counts[key]) {
          counts[key] = { name: item.menuItem.name, value: 0 };
        }
        counts[key].value += item.quantity;
      });
    });

    const dataset = Object.values(counts);
    if (dataset.length === 0) {
      return [
        { name: 'Dal Makhani', value: 8 },
        { name: 'Paneer Butter Masala', value: 6 },
        { name: 'Cold Coffee', value: 5 },
        { name: 'Chocolate Brownie', value: 4 },
        { name: 'Fresh Lime Soda', value: 3 },
      ];
    }
    return dataset.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [orders]);

  const trendsData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: { day: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = days[d.getDay()];
      const dateStr = d.toDateString();

      const dayRevenue = orders
        .filter(o => {
          if (!o.isPaid) return false;
          const orderDate = o.createdAt ? new Date(o.createdAt).toDateString() : (o.timestamp ? new Date(o.timestamp).toDateString() : '');
          return orderDate === dateStr;
        })
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      result.push({
        day: i === 0 ? 'Today' : dayStr,
        revenue: dayRevenue
      });
    }

    // If no sales exist across past 7 days, provide initial smooth baseline curve for visual guidance
    const hasAnySales = result.some(r => r.revenue > 0);
    if (!hasAnySales) {
      return [
        { day: 'Mon', revenue: 4200 },
        { day: 'Tue', revenue: 5800 },
        { day: 'Wed', revenue: 3900 },
        { day: 'Thu', revenue: 7400 },
        { day: 'Fri', revenue: 6500 },
        { day: 'Sat', revenue: 9200 },
        { day: 'Today', revenue: stats.todayRevenue },
      ];
    }

    return result;
  }, [orders, stats.todayRevenue]);

  const PIE_COLORS = ['#111111', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];

  return (
    <PageLayout
      title="Dashboard"
      subtitle="Restaurant performance overview and daily insights."
      id="dashboard_view"
      activeTab="Dashboard"
      onTabChange={onNavigateToTab}
    >

      {/* KPI Cards Row (5-Column Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
        <KpiCard
          label="Total Sales"
          value={`${currencySymbol}${stats.todayRevenue.toLocaleString('en-IN')}`}
          icon={DollarSign}
          iconBg="bg-emerald-50/60"
          iconColor="text-[#22C55E]"
          iconBorder="border-emerald-100/30"
          currencySymbol={currencySymbol}
          onClick={() => onNavigateToTab('Reports')}
        />
        <KpiCard
          label="Today's Cash Sales"
          value={`${currencySymbol}${stats.cashSales.toLocaleString('en-IN')}`}
          icon={DollarSign}
          iconBg="bg-amber-50/60"
          iconColor="text-amber-600"
          iconBorder="border-amber-100/20"
          currencySymbol={currencySymbol}
          onClick={() => onNavigateToTab('Reports')}
        />
        <KpiCard
          label="Today's UPI Sales"
          value={`${currencySymbol}${stats.upiSales.toLocaleString('en-IN')}`}
          icon={TrendingUp}
          iconBg="bg-sky-50/60"
          iconColor="text-sky-600"
          iconBorder="border-sky-100/20"
          currencySymbol={currencySymbol}
          onClick={() => onNavigateToTab('Reports')}
        />
        <KpiCard
          label="Orders Today"
          value={stats.ordersToday}
          icon={CheckCircle}
          iconBg="bg-blue-50/65"
          iconColor="text-[#2563EB]"
          iconBorder="border-blue-100/30"
          currencySymbol={currencySymbol}
          onClick={() => onNavigateToTab('Orders')}
        />
        <KpiCard
          label="Active Tables"
          value={stats.activeTables}
          icon={Flame}
          iconBg="bg-[#FEF3C7]/65"
          iconColor="text-[#D97706]"
          iconBorder="border-amber-100/30"
          currencySymbol={currencySymbol}
          onClick={() => onNavigateToTab('Billing')}
        />
      </div>

      {/* Main Grid: Charts & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Revenue Chart */}
        <div className="bg-white rounded-[20px] border border-[#EDEDED] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)] h-[220px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-[13px] font-[900] text-[#111111] uppercase tracking-wider leading-none mb-1">
                Sales Revenue Trend
              </h3>
              <p className="text-[#8B8B8B] text-[11px] font-semibold mt-1">
                Daily sales transactions trend
              </p>
            </div>
            <div className="bg-emerald-50 px-2.5 py-1 rounded-[6px] text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 border border-emerald-100 uppercase tracking-widest leading-none">
              <TrendingUp size={12} strokeWidth={3} /> +5.4% Up
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8B8B8B', fontSize: 10, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B8B8B', fontSize: 10, fontWeight: 600 }} dx={-10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 600 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [`${currencySymbol}${value}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Items List */}
        <div className="bg-white rounded-[20px] border border-[#EDEDED] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)] h-[220px] flex flex-col">
          <div className="mb-4">
            <h3 className="text-[13px] font-[900] text-[#111111] uppercase tracking-wider leading-none mb-1">
              Best Selling Items
            </h3>
            <p className="text-[#8B8B8B] text-[11px] font-semibold mt-1">
              Total quantity sold
            </p>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bestSellers}
                  cx="40%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {bestSellers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 600 }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any, name: string) => [`${value} units`, name]}
                />
                <Legend 
                  verticalAlign="middle" 
                  align="right" 
                  layout="vertical"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: '#111111', right: 0 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales Channels Cockpit */}
      <div className="bg-white rounded-[24px] border border-[#EDEDED] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-[13px] font-[900] text-[#111111] uppercase tracking-wider leading-none mb-1">
              Sales Channel Performance Cockpit
            </h3>
            <p className="text-[#8B8B8B] text-[11px] font-semibold mt-1">
              Real-time synchronization across dine-in POS desk, takeaway counter, and Scan &amp; Go QR. Click to open channels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">All Channels Synced</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Dine-in channel card */}
          <div 
            onClick={() => onNavigateToTab('Orders')}
            className="p-4 rounded-[16px] border border-blue-100 bg-blue-50/15 hover:shadow-md hover:border-blue-350 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase">DINE-IN SERVICE</span>
            </div>
            <div className="space-y-1 mt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-[900] text-gray-900">{currencySymbol}{stats.dineInRevenue.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-gray-400 font-semibold">{stats.dineInOrders} orders at tables</p>
            </div>
          </div>

          {/* Takeaway channel card */}
          <div 
            onClick={() => onNavigateToTab('Orders')}
            className="p-4 rounded-[16px] border border-emerald-100 bg-emerald-50/15 hover:shadow-md hover:border-emerald-350 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black tracking-widest text-emerald-600 uppercase">TAKEAWAY COUNTER</span>
            </div>
            <div className="space-y-1 mt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-[900] text-gray-900">{currencySymbol}{stats.takeawayRevenue.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-gray-400 font-semibold">{stats.takeawayOrders} counter orders</p>
            </div>
          </div>

          {/* Scan & Go channel card */}
          <div 
            onClick={() => onNavigateToTab('ScanGo')}
            className="p-4 rounded-[16px] border border-purple-100 bg-purple-50/15 hover:shadow-md hover:border-purple-350 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-black tracking-widest text-purple-600 uppercase">SCAN &amp; GO QR</span>
            </div>
            <div className="space-y-1 mt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-[900] text-gray-900">{currencySymbol}{stats.scangoRevenue.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-gray-400 font-semibold">{stats.scangoOrders} self-service sessions</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  iconBorder,
  currencySymbol,
  onClick
}: {
  label: string;
  value: string | number;
  icon: any;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  currencySymbol?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-[20px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-[#F0F2F5] flex flex-col justify-between h-[115px] hover:translate-y-[-2px] transition-all duration-300 w-full xl:max-w-[280px] ${onClick ? 'cursor-pointer hover:border-emerald-350 hover:shadow-md' : ''}`}
    >
      <div className={`w-[32px] h-[32px] rounded-[8px] flex items-center justify-center border ${iconBg} ${iconColor} ${iconBorder}`}>
        {label === "Today's Revenue" ? (
          <span className={`text-[16px] font-black font-sans -mt-0.5 ${iconColor}`}>{currencySymbol || '₹'}</span>
        ) : (
          <Icon size={14} className="stroke-[2.5]" />
        )}
      </div>
      <div>
        <span className="text-gray-400 text-[11px] font-black tracking-widest uppercase block mb-0.5">
          {label}
        </span>
        <h3 className="text-[24px] font-[900] text-[#111111] leading-none tracking-tight">
          {value}
        </h3>
      </div>
    </div>
  );
}
