/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import PageLayout from './PageLayout';
import { 
  Search, Plus, Minus, ShoppingBag, Trash2, Utensils, Lock, ArrowRight,
  Clock, CheckCircle2, AlertCircle, XCircle, Flame, ChefHat, CreditCard,
  QrCode, User, Phone, Filter, RefreshCw, FileText, Volume2, Printer,
  Check, ChevronDown, ChevronRight, Layers, Eye, ShieldCheck, Sparkles,
  ArrowUpRight, DollarSign, Calendar
} from 'lucide-react';
import { MenuItem, Order, OrderType, Category, InventoryItem } from '../types';
import { INITIAL_MENU_ITEMS } from '../data';
import { soundAlert } from '../lib/soundAlert';

export interface OrdersProps {
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  orders: Order[];
  selfOrders?: any[];
  onAddOrderToKitchen: (orderData: {
    type: OrderType;
    tableNo?: string;
    items: { menuItem: MenuItem; quantity: number }[];
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    landmark?: string;
    pickupTime?: string;
    orderToken?: string;
    orderSource?: string;
  }) => void;
  onUpdateOrder?: (orderId: string, updates: Partial<Order>) => Promise<void>;
  onMarkOrderPaid?: (orderId: string, method: string, details?: any) => Promise<void>;
  onShowToast: (msg: string) => void;
  settings?: any;
  onNavigateToTab?: (tab: any) => void;
  userRole?: string | null;
}

const CATEGORY_CHIPS = [
  { value: 'All' as const, label: 'All Dishes', dot: '⚪' },
  { value: 'Veg' as const, label: 'Veg', dot: '🟢' },
  { value: 'Non-Veg' as const, label: 'Non-Veg', dot: '🔴' },
  { value: 'Drinks' as const, label: 'Drinks', dot: '🔵' },
  { value: 'Desserts' as const, label: 'Desserts', dot: '🟣' },
];

// Helper: Dish availability based on recipe stock
export const isDishStockAvailable = (
  dish: MenuItem, 
  inventoryItems: InventoryItem[], 
  portion: 'Half' | 'Full', 
  requestedQty: number = 1
): { available: boolean; reason?: string } => {
  let recipe = dish.recipe;
  if (!recipe || recipe.length === 0) {
    const seedItem = INITIAL_MENU_ITEMS.find(
      m => m.id === dish.id || m.name.toLowerCase() === dish.name.toLowerCase()
    );
    if (seedItem && seedItem.recipe) {
      recipe = seedItem.recipe;
    }
  }

  if (!recipe || recipe.length === 0) return { available: true };

  for (const rec of recipe) {
    const invItem = inventoryItems.find(i => i.id === rec.inventoryItemId);
    if (!invItem) {
      return { available: false, reason: `Missing ${rec.inventoryItemId}` };
    }
    const multiplier = portion === 'Half' ? 0.5 : 1.0;
    const requiredAmount = rec.amount * multiplier * requestedQty;
    if (invItem.quantity < requiredAmount) {
      return { available: false, reason: `Low ${invItem.name} (${invItem.quantity}${invItem.unit} left)` };
    }
  }

  return { available: true };
};

// Premium Dish Card Image
function DishCardImage({ src, name }: { src?: string; name: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F1F5F9] text-gray-400 select-none">
        <span className="text-3xl filter drop-shadow-sm animate-pulse">🍽️</span>
        <span className="text-[10px] uppercase font-[705] mt-1.5 text-gray-500 tracking-wider">No Image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-106"
      referrerPolicy="no-referrer"
    />
  );
}

// Category badge details
const getCategoryBadgeDetails = (category: string) => {
  const cleanCat = category.trim().toLowerCase();
  if (cleanCat === 'veg') {
    return { dot: '🟢', text: 'VEG', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (cleanCat === 'non-veg' || cleanCat === 'nonveg') {
    return { dot: '🔴', text: 'NON-VEG', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (cleanCat === 'drinks' || cleanCat === 'beverages') {
    return { dot: '🔵', text: 'DRINKS', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (cleanCat === 'desserts' || cleanCat === 'dessert') {
    return { dot: '🟣', text: 'DESSERTS', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
  return { dot: '⚪', text: category.toUpperCase(), bg: 'bg-gray-50 text-gray-700 border-gray-200' };
};

// Format Timestamp Helper
const formatDateTime = (timestamp: number | string | undefined): { dateStr: string; timeStr: string; relative: string } => {
  if (!timestamp) return { dateStr: 'Today', timeStr: '--:--', relative: 'just now' };
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(d.getTime())) return { dateStr: 'Today', timeStr: '--:--', relative: 'just now' };

  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  let relative = 'just now';
  if (diffMins >= 60) {
    const hours = Math.floor(diffMins / 60);
    relative = `${hours}h ago`;
  } else if (diffMins > 0) {
    relative = `${diffMins}m ago`;
  }

  return { dateStr, timeStr, relative };
};

// Active order check rule:
// Order remains active UNTIL status becomes 'Completed' or 'Cancelled'
// Never remove an order just because payment is successful.
export const isOrderActive = (order: Order): boolean => {
  const status = (order.status || (order as any).orderStatus || '').toString().toLowerCase();
  return status !== 'completed' && status !== 'cancelled' && status !== 'delivered';
};

export default function Orders({
  menuItems,
  inventoryItems,
  orders,
  selfOrders = [],
  onAddOrderToKitchen,
  onUpdateOrder,
  onMarkOrderPaid,
  onShowToast,
  settings,
  onNavigateToTab,
  userRole
}: OrdersProps) {
  const currencySymbol = settings?.prefCurrency || '₹';

  // Master View Switch: 'active_orders' | 'new_order' | 'order_history'
  const [activeView, setActiveView] = useState<'active_orders' | 'new_order' | 'order_history'>('active_orders');

  // Search & Filters for Active Orders
  const [activeSearch, setActiveSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  // Modal / Detail state for single order action
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSettlingPayment, setIsSettlingPayment] = useState<string | null>(null);

  // POS Order Entry States
  const taxPercentage = settings?.gstTax?.gstRate !== undefined ? settings.gstTax.gstRate : 0;
  const taxEnabled = settings?.gstTax?.taxEnabled !== undefined ? settings.gstTax.taxEnabled : false;
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCategory, setPosCategory] = useState<Category | 'All'>('All');
  const [selectedType, setSelectedType] = useState<OrderType>('Dine-In');
  const [selectedTable, setSelectedTable] = useState<string>('Table 1');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [cart, setCart] = useState<Record<string, { menuItem: MenuItem; quantity: number }>>({});
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Sound chime tracking for incoming orders
  const prevActiveCountRef = useRef<number>(0);

  // 1. DEDUPLICATE ORDERS BY ORDER.ID TO PREVENT DUPLICATES
  const deduplicatedOrders = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach(ord => {
      if (ord && ord.id) {
        map.set(ord.id, ord);
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [orders]);

  // 2. UNIFIED ACTIVE ORDERS LIST (Combining POS, Waiter, and QR orders)
  const allActiveOrders = useMemo(() => {
    const map = new Map<string, Order>();

    // Add active orders from primary orders collection
    deduplicatedOrders.filter(isOrderActive).forEach(ord => {
      map.set(ord.id, ord);
    });

    // Also include any incoming self-orders from selfOrders collection not yet in orders
    (selfOrders || []).forEach(so => {
      if (so && so.id && !map.has(so.id)) {
        const syntheticOrder: Order = {
          id: so.id,
          orderNumber: (so as any).orderNumber || so.id.slice(-4),
          orderToken: (so as any).orderToken || (so as any).token || 'A001',
          type: 'Dine-In',
          tableNo: so.tableNo || so.tableNumber || 'Table 01',
          items: so.items || so.itemsCart || [],
          status: 'New',
          orderStatus: 'Pending Confirmation',
          kitchenStatus: 'Pending',
          billingStatus: (so as any).isPaid ? 'Paid' : 'Pending',
          paymentStatus: (so as any).paymentStatus || ((so as any).isPaid ? 'Paid' : 'Pending'),
          isPaid: !!(so as any).isPaid,
          isBilled: false,
          totalAmount: so.total || 0,
          customerName: so.customerName || 'QR Diner',
          customerPhone: so.customerPhone || '',
          orderSource: 'Scan & Go QR',
          createdAt: so.joinedAt || new Date().toISOString(),
          timestamp: Date.now()
        };
        map.set(so.id, syntheticOrder);
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [deduplicatedOrders, selfOrders]);

  // Sound chime when active order count increases
  useEffect(() => {
    if (prevActiveCountRef.current > 0 && allActiveOrders.length > prevActiveCountRef.current) {
      soundAlert.playNewOrderBell();
      onShowToast('🔔 New Active Order Received!');
    }
    prevActiveCountRef.current = allActiveOrders.length;
  }, [allActiveOrders.length, onShowToast]);

  // 3. ORDER HISTORY (COMPLETED & CANCELLED ORDERS)
  const orderHistory = useMemo(() => {
    return deduplicatedOrders.filter(ord => !isOrderActive(ord));
  }, [deduplicatedOrders]);

  // 4. FILTERED ACTIVE ORDERS BASED ON USER SEARCH & CONTROLS
  const filteredActiveOrders = useMemo(() => {
    return allActiveOrders.filter(order => {
      // Search matching (Order ID, Token, Customer Name, Phone, Table)
      if (activeSearch.trim()) {
        const query = activeSearch.toLowerCase().trim();
        const matchesName = (order.customerName || '').toLowerCase().includes(query);
        const matchesPhone = (order.customerPhone || '').includes(query);
        const matchesOrderId = (order.orderNumber || '').toLowerCase().includes(query) || order.id.toLowerCase().includes(query);
        const matchesToken = ((order as any).orderToken || '').toLowerCase().includes(query);
        const matchesTable = (order.tableNo || '').toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesOrderId && !matchesToken && !matchesTable) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        const currentStatus = (order.status || (order as any).orderStatus || '').toLowerCase();
        if (statusFilter === 'PENDING' && !['new', 'pending', 'pending confirmation'].includes(currentStatus)) return false;
        if (statusFilter === 'CONFIRMED' && !['confirmed', 'accepted'].includes(currentStatus)) return false;
        if (statusFilter === 'PREPARING' && currentStatus !== 'preparing') return false;
        if (statusFilter === 'READY' && currentStatus !== 'ready') return false;
        if (statusFilter === 'SERVED' && currentStatus !== 'served') return false;
      }

      // Channel / Order Source filter
      if (channelFilter !== 'ALL') {
        const source = (order.orderSource || order.type || '').toLowerCase();
        if (channelFilter === 'QR' && !source.includes('qr') && !source.includes('scan')) return false;
        if (channelFilter === 'POS' && !source.includes('pos') && source.includes('qr')) return false;
        if (channelFilter === 'WAITER' && !source.includes('waiter')) return false;
        if (channelFilter === 'ONLINE' && !source.includes('swiggy') && !source.includes('zomato') && !source.includes('online')) return false;
      }

      // Payment Status filter
      if (paymentFilter !== 'ALL') {
        const isPaid = order.isPaid || order.paymentStatus === 'Paid' || order.paymentStatus === 'PAID';
        if (paymentFilter === 'PAID' && !isPaid) return false;
        if (paymentFilter === 'PENDING' && isPaid) return false;
      }

      return true;
    });
  }, [allActiveOrders, activeSearch, statusFilter, channelFilter, paymentFilter]);

  // Dynamic table occupancy based on active orders
  const dynamicTables = useMemo(() => {
    if (settings?.tables && Array.isArray(settings.tables) && settings.tables.length > 0) {
      return settings.tables.map((t: any) => t.name);
    }
    return ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Table 7', 'Table 8'];
  }, [settings]);

  const tableStatuses = useMemo(() => {
    const statuses: Record<string, 'Available' | 'Occupied'> = {};
    dynamicTables.forEach(table => {
      const activeForTable = allActiveOrders.find(o => o.tableNo === table);
      statuses[table] = activeForTable ? 'Occupied' : 'Available';
    });
    return statuses;
  }, [allActiveOrders, dynamicTables]);

  const isTableLocked = useMemo(() => {
    if (selectedType !== 'Dine-In') return false;
    return tableStatuses[selectedTable] === 'Occupied';
  }, [selectedType, selectedTable, tableStatuses]);

  // Role Permissions Checks
  const roleNorm = (userRole || 'RestaurantOwner').toLowerCase();
  const isOwnerOrAdmin = roleNorm.includes('owner') || roleNorm.includes('admin') || roleNorm === 'manager';
  const isCashier = roleNorm === 'cashier';
  const isWaiter = roleNorm === 'waiter';

  // Handle Order Status Transitions in real-time
  const handleUpdateOrderStatus = async (
    orderId: string, 
    newStatus: 'Pending Confirmation' | 'Confirmed' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled'
  ) => {
    if (!onUpdateOrder) {
      onShowToast('Database updater is unavailable');
      return;
    }

    // Role verification
    if (isWaiter && !['Confirmed', 'Served'].includes(newStatus)) {
      onShowToast('Waiters can only mark orders as Confirmed or Served.');
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const updates: Partial<Order> = {
        status: (newStatus === 'Pending Confirmation' ? 'New' : newStatus) as any,
        orderStatus: newStatus,
      };

      if (newStatus === 'Preparing') {
        updates.kitchenStatus = 'Preparing';
        updates.startedAt = Date.now();
      } else if (newStatus === 'Ready') {
        updates.kitchenStatus = 'Prepared';
        updates.preparedAt = Date.now();
      } else if (newStatus === 'Served') {
        updates.kitchenStatus = 'Served';
        updates.servedAt = Date.now();
      } else if (newStatus === 'Completed') {
        updates.billingStatus = 'Paid';
      }

      await onUpdateOrder(orderId, updates);
      onShowToast(`Order updated to ${newStatus}`);
      if (selectedOrderForDetail?.id === orderId) {
        setSelectedOrderForDetail(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('Failed to update order status:', err);
      onShowToast('Error updating status in database.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Payment Status updates in real-time
  const handleUpdatePaymentStatus = async (
    orderId: string, 
    paymentStatus: 'Paid' | 'Pending' | 'Failed' | 'Cancelled' | 'Refunded', 
    paymentMethod: string = 'Cash'
  ) => {
    if (!onUpdateOrder) return;

    if (isWaiter) {
      onShowToast('Waiters cannot modify payment transactions.');
      return;
    }

    try {
      const isPaid = paymentStatus === 'Paid';
      const updates: Partial<Order> = {
        isPaid,
        paymentStatus,
        paymentMethod: isPaid ? paymentMethod : (paymentStatus === 'Pending' ? 'Pay at Counter' : paymentMethod),
        paymentTimestamp: isPaid ? Date.now() : undefined,
      };

      await onUpdateOrder(orderId, updates);
      onShowToast(`Payment status set to ${paymentStatus}`);
      setIsSettlingPayment(null);
      if (selectedOrderForDetail?.id === orderId) {
        setSelectedOrderForDetail(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('Payment update error:', err);
      onShowToast('Error updating payment status.');
    }
  };

  // POS Cart Management
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const available = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
      if (available === false) return false;

      const stockStatus = isDishStockAvailable(item, inventoryItems, 'Full', 1);
      if (!stockStatus.available) return false;

      const matchesSearch = item.name.toLowerCase().includes(posSearchQuery.toLowerCase()) ||
                            item.description.toLowerCase().includes(posSearchQuery.toLowerCase());
      const matchesCategory = posCategory === 'All' || item.category === posCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, inventoryItems, posCategory, posSearchQuery]);

  const handleAddToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      onShowToast(`❌ ${item.name} is out of stock`);
      return;
    }
    setCart(prev => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: { menuItem: item, quantity: (existing ? existing.quantity : 0) + 1 }
      };
    });
    onShowToast(`✓ Added ${item.name}`);
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const nextCart = { ...prev };
        delete nextCart[itemId];
        return nextCart;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: nextQty }
      };
    });
  };

  const cartValues = useMemo(() => {
    const itemsArray = Object.entries(cart)
      .map(([itemId, cartItem]) => {
        const itemObj = cartItem as { menuItem: MenuItem; quantity: number };
        const liveItem = menuItems.find(it => it.id === itemId);
        if (!liveItem) return null;
        return { menuItem: liveItem, quantity: itemObj.quantity };
      })
      .filter((item): item is { menuItem: MenuItem; quantity: number } => item !== null);

    const subtotal = itemsArray.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
    const gstRateVal = taxEnabled ? (taxPercentage / 100) : 0;
    const taxes = Math.round(subtotal * gstRateVal);
    const total = Math.max(0, subtotal + taxes);

    return { itemsArray, subtotal, taxes, total };
  }, [cart, menuItems, taxEnabled, taxPercentage]);

  const handlePlacePosOrder = () => {
    if (cartValues.itemsArray.length === 0) return;
    if (isTableLocked) {
      onShowToast('Selected table is already occupied!');
      return;
    }

    const orderToken = 'A' + ((allActiveOrders.length % 999) + 1).toString().padStart(3, '0');

    onAddOrderToKitchen({
      type: selectedType,
      tableNo: selectedType === 'Dine-In' ? selectedTable : undefined,
      items: cartValues.itemsArray,
      customerName: customerNameInput.trim() || 'Walk-in Diner',
      customerPhone: customerPhone.trim(),
      deliveryAddress: selectedType === 'Delivery' ? deliveryAddress : undefined,
      orderToken,
      orderSource: 'POS Desk'
    });

    setCart({});
    setCustomerPhone('');
    setCustomerNameInput('');
    setDeliveryAddress('');
    setIsMobileCartOpen(false);
    onShowToast(`Order placed with TOKEN #${orderToken}`);
    setActiveView('active_orders');
  };

  // Helper for Order Status Pill Styling
  const getOrderStatusPill = (statusStr: string | undefined) => {
    const s = (statusStr || 'Pending Confirmation').toLowerCase();
    if (s.includes('ready')) {
      return { bg: 'bg-teal-50 text-teal-700 border-teal-200', label: 'Ready', dot: 'bg-teal-500' };
    }
    if (s.includes('prep')) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Preparing', dot: 'bg-amber-500' };
    }
    if (s.includes('served')) {
      return { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Served', dot: 'bg-purple-500' };
    }
    if (s.includes('confirm') || s === 'accepted') {
      return { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Confirmed', dot: 'bg-blue-500' };
    }
    if (s.includes('complete')) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Completed', dot: 'bg-emerald-500' };
    }
    if (s.includes('cancel')) {
      return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Cancelled', dot: 'bg-rose-500' };
    }
    return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Pending Confirmation', dot: 'bg-slate-400' };
  };

  // Helper for Payment Status Pill Styling
  const getPaymentStatusPill = (order: Order) => {
    const isPaid = order.isPaid || order.paymentStatus === 'Paid' || order.paymentStatus === 'PAID';
    if (isPaid) {
      const method = order.paymentMethod || 'Paid';
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        label: `PAID (${method})`,
        isPaid: true
      };
    }
    const status = (order.paymentStatus || 'Pending').toUpperCase();
    if (status === 'FAILED') {
      return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'FAILED', isPaid: false };
    }
    if (status === 'REFUNDED') {
      return { bg: 'bg-slate-100 text-slate-600 border-slate-300', label: 'REFUNDED', isPaid: false };
    }
    if (status === 'CANCELLED') {
      return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'CANCELLED', isPaid: false };
    }
    return {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: order.paymentMethod === 'Pay at Counter' ? 'PENDING (Counter)' : 'PENDING',
      isPaid: false
    };
  };

  return (
    <PageLayout
      title="Orders"
      subtitle="Real-time multi-channel active orders, table status, and POS billing."
      id="orders_master_view"
    >
      <div className="space-y-6 pt-2">
        
        {/* TOP NAVIGATION TABS */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('active_orders')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                activeView === 'active_orders'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <Clock size={15} />
              <span>Active Orders</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeView === 'active_orders' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {allActiveOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveView('new_order')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                activeView === 'new_order'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <Plus size={15} />
              <span>+ New Order (POS)</span>
            </button>

            <button
              onClick={() => setActiveView('order_history')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                activeView === 'order_history'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <FileText size={15} />
              <span>Order History</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-black">
                {orderHistory.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span>Live Firestore Sync</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: ACTIVE ORDERS DASHBOARD (PRIMARY REQUIRED VIEW)        */}
        {/* ============================================================== */}
        {activeView === 'active_orders' && (
          <div className="space-y-5">
            
            {/* KPI STATS ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Active Orders
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {allActiveOrders.length}
                </span>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 block mb-1">
                  In Kitchen
                </span>
                <span className="text-2xl font-black text-amber-600 font-mono">
                  {allActiveOrders.filter(o => (o.status || '').toLowerCase() === 'preparing').length}
                </span>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-600 block mb-1">
                  Ready to Serve
                </span>
                <span className="text-2xl font-black text-teal-600 font-mono">
                  {allActiveOrders.filter(o => (o.status || '').toLowerCase() === 'ready').length}
                </span>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Active Volume
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {currencySymbol}{allActiveOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)}
                </span>
              </div>
            </div>

            {/* FILTER CONTROLS BAR */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Order ID, Token (A027), Customer Name, Phone, or Table..."
                    value={activeSearch}
                    onChange={(e) => setActiveSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {activeSearch && (
                    <button
                      onClick={() => setActiveSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>

                {/* Filter selects */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Status Dropdown */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Order Statuses</option>
                    <option value="PENDING">Pending Confirmation</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="PREPARING">Preparing</option>
                    <option value="READY">Ready</option>
                    <option value="SERVED">Served</option>
                  </select>

                  {/* Channel Dropdown */}
                  <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Sources</option>
                    <option value="POS">POS Desk</option>
                    <option value="QR">Scan &amp; Go QR</option>
                    <option value="WAITER">Waiter</option>
                    <option value="ONLINE">Online Delivery</option>
                  </select>

                  {/* Payment Dropdown */}
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Payments</option>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending Payment</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ACTIVE ORDERS LIST */}
            {filteredActiveOrders.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-16 text-center shadow-xs space-y-3">
                <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <CheckCircle2 size={28} className="text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800">
                    No active orders found
                  </h3>
                  <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                    {activeSearch || statusFilter !== 'ALL' || channelFilter !== 'ALL' || paymentFilter !== 'ALL'
                      ? 'No active orders match your search filters. Try clearing filters.'
                      : 'Every order from POS, Scan & Go QR, and Waiters will appear here automatically in real time.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveView('new_order')}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  + Place New POS Order
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredActiveOrders.map(order => {
                  const statusPill = getOrderStatusPill(order.status || (order as any).orderStatus);
                  const paymentPill = getPaymentStatusPill(order);
                  const dateTime = formatDateTime(order.timestamp || order.createdAt);
                  const token = (order as any).orderToken || order.orderNumber || 'A001';
                  const source = order.orderSource || (order.id.startsWith('so_') ? 'Scan & Go QR' : 'POS Desk');
                  const isPaid = paymentPill.isPaid;

                  return (
                    <div
                      key={order.id}
                      className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4 transition-all relative overflow-hidden"
                    >
                      {/* Top Accent Strip */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                        isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />

                      <div className="space-y-3 pt-1">
                        {/* HEADER: ORDER TOKEN & ID + DATE & TIME */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              {/* Prominent Order Token Badge */}
                              <span className="text-xs font-black bg-blue-600 text-white px-2.5 py-0.5 rounded-md font-mono tracking-wide shadow-2xs">
                                TOKEN #{token}
                              </span>
                              {/* Order ID */}
                              <span className="text-[11px] font-black text-slate-500">
                                #OP-{order.orderNumber}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold block">
                              {dateTime.dateStr}, {dateTime.timeStr} • <span className="text-slate-600 font-extrabold">{dateTime.relative}</span>
                            </span>
                          </div>

                          {/* Total Amount */}
                          <div className="text-right">
                            <span className="text-base font-black text-slate-900 font-mono block leading-none">
                              {currencySymbol}{order.totalAmount || 0}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                              {order.items?.length || 0} items
                            </span>
                          </div>
                        </div>

                        {/* CUSTOMER & TABLE ROW */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 font-black text-slate-800 truncate">
                              <User size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{order.customerName || 'Walk-in Diner'}</span>
                            </div>
                            {order.customerPhone && (
                              <span className="text-[10px] text-slate-400 font-mono block pl-4">
                                {order.customerPhone}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase leading-none block">
                              {order.tableNo ? (order.tableNo.toLowerCase().startsWith('table') ? order.tableNo : `Table ${order.tableNo}`) : order.type}
                            </span>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide block mt-0.5">
                              {source}
                            </span>
                          </div>
                        </div>

                        {/* STATUS ROW: ORDER STATUS & PAYMENT STATUS PILLS */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          {/* Order Fulfillment Status */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black border uppercase tracking-wider ${statusPill.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`} />
                            <span>{statusPill.label}</span>
                          </div>

                          {/* Payment Status Pill */}
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black border uppercase tracking-wider ${paymentPill.bg}`}>
                            {paymentPill.isPaid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            <span>{paymentPill.label}</span>
                          </div>
                        </div>

                        {/* ITEMS BREAKDOWN */}
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                            {order.items?.map((it, idx) => (
                              <span 
                                key={idx} 
                                className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-800 px-2 py-0.5 rounded"
                              >
                                {it.quantity}× {it.menuItem.name} {it.size ? `(${it.size})` : ''}
                              </span>
                            ))}
                          </div>
                          {(order as any).notes && (
                            <p className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 italic">
                              Note: {(order as any).notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* BOTTOM ACTIONS BAR: STATUS TRANSITION & PAYMENT SETTLEMENT */}
                      <div className="pt-3 border-t border-slate-200/80 space-y-2">
                        {/* Quick Status Advancement */}
                        <div className="flex items-center gap-1.5">
                          {/* Advance Status Workflow button */}
                          {(order.status === 'New' || (order as any).orderStatus === 'Pending Confirmation') && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Confirmed')}
                              disabled={isUpdatingStatus}
                              className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 size={12} />
                              <span>Confirm Order</span>
                            </button>
                          )}

                          {((order.status === 'Accepted' || (order as any).orderStatus === 'Confirmed') && order.status !== 'Preparing') && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Preparing')}
                              disabled={isUpdatingStatus}
                              className="flex-1 h-8 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <Flame size={12} />
                              <span>Start Cooking</span>
                            </button>
                          )}

                          {(order.status === 'Preparing') && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Ready')}
                              disabled={isUpdatingStatus}
                              className="flex-1 h-8 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 size={12} />
                              <span>Mark Ready</span>
                            </button>
                          )}

                          {(order.status === 'Ready') && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Served')}
                              disabled={isUpdatingStatus}
                              className="flex-1 h-8 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <Utensils size={12} />
                              <span>Serve Food</span>
                            </button>
                          )}

                          {(order.status === 'Served') && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Completed')}
                              disabled={isUpdatingStatus}
                              className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 size={12} />
                              <span>Complete Order</span>
                            </button>
                          )}

                          {/* Quick Payment Settlement button if unpaid */}
                          {!isPaid && (
                            <button
                              onClick={() => setIsSettlingPayment(isSettlingPayment === order.id ? null : order.id)}
                              className="h-8 px-3 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1"
                              title="Collect Payment"
                            >
                              <CreditCard size={12} />
                              <span>Collect</span>
                            </button>
                          )}

                          {/* Cancel Order (Authorized roles only) */}
                          {isOwnerOrAdmin && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Cancel order #OP-${order.orderNumber}?`)) {
                                  handleUpdateOrderStatus(order.id, 'Cancelled');
                                }
                              }}
                              className="h-8 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Cancel Order"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>

                        {/* Inline Payment Settlement Drawer if toggled */}
                        {isSettlingPayment === order.id && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 animate-in fade-in duration-200">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                              Select Payment Method:
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                onClick={() => handleUpdatePaymentStatus(order.id, 'Paid', 'Cash')}
                                className="h-7 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-800 text-[10px] font-black rounded-lg transition-colors"
                              >
                                Cash
                              </button>
                              <button
                                onClick={() => handleUpdatePaymentStatus(order.id, 'Paid', 'UPI')}
                                className="h-7 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-800 text-[10px] font-black rounded-lg transition-colors"
                              >
                                UPI / GPay
                              </button>
                              <button
                                onClick={() => handleUpdatePaymentStatus(order.id, 'Paid', 'Card')}
                                className="h-7 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 text-slate-800 text-[10px] font-black rounded-lg transition-colors"
                              >
                                Card
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: NEW ORDER POS TERMINAL (DISH GRID & CART)               */}
        {/* ============================================================== */}
        {activeView === 'new_order' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: FOOD CATALOG */}
            <div className="xl:col-span-8 space-y-5">
              
              {/* Back to Active Orders button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveView('active_orders')}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowRight size={13} className="rotate-180" />
                  <span>Back to Active Orders ({allActiveOrders.length})</span>
                </button>
              </div>

              {/* SEARCH & CATEGORY CHIPS */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search dish by name or description..."
                    value={posSearchQuery}
                    onChange={(e) => setPosSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {CATEGORY_CHIPS.map(chip => (
                    <button
                      key={chip.value}
                      onClick={() => setPosCategory(chip.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 border ${
                        posCategory === chip.value
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <span>{chip.dot} {chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DISH CARDS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {filteredMenuItems.map(dish => (
                  <div
                    key={dish.id}
                    onClick={() => handleAddToCart(dish)}
                    className="bg-white border border-slate-200/90 hover:border-slate-400 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 transition-all cursor-pointer shadow-xs group"
                  >
                    <div className="space-y-2">
                      <div className="w-full h-28 rounded-xl overflow-hidden relative bg-slate-100">
                        <DishCardImage src={dish.image} name={dish.name} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {dish.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {dish.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {currencySymbol}{dish.price}
                      </span>
                      <button
                        type="button"
                        className="w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-transform active:scale-90"
                      >
                        <Plus size={14} className="stroke-[3]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: POS CART SIDEBAR */}
            <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-[28px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-blue-600 stroke-[2.5]" />
                  <h3 className="font-black text-sm uppercase tracking-tight text-slate-900">
                    POS Cart
                  </h3>
                </div>
                {cartValues.itemsArray.length > 0 && (
                  <button
                    onClick={() => setCart({})}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Order Service Type Tabs */}
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 text-center">
                {(['Dine-In', 'Takeaway', 'Delivery'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      selectedType === type
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Table & Customer Inputs */}
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                {selectedType === 'Dine-In' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">
                      Select Table
                    </label>
                    <select
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      {dynamicTables.map(t => {
                        const occupied = tableStatuses[t] === 'Occupied';
                        return (
                          <option key={t} value={t} disabled={occupied}>
                            {t} {occupied ? '(Occupied)' : '(Available)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Guest / Diner Name"
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">
                    Customer Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {selectedType === 'Delivery' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">
                      Delivery Address
                    </label>
                    <input
                      type="text"
                      placeholder="Flat, building, area..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cartValues.itemsArray.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400 font-bold italic">
                    Cart is empty. Tap dishes to add.
                  </p>
                ) : (
                  cartValues.itemsArray.map(item => (
                    <div key={item.menuItem.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl">
                      <div className="min-w-0 pr-2">
                        <span className="font-extrabold text-slate-800 block truncate">
                          {item.menuItem.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {currencySymbol}{item.menuItem.price} × {item.quantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleUpdateQty(item.menuItem.id, -1)}
                          className="w-6 h-6 bg-white border border-slate-200 text-slate-700 rounded flex items-center justify-center font-bold"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center font-mono font-bold">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(item.menuItem.id, 1)}
                          className="w-6 h-6 bg-white border border-slate-200 text-slate-700 rounded flex items-center justify-center font-bold"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Subtotal</span>
                  <span className="font-mono">{currencySymbol}{cartValues.subtotal}</span>
                </div>
                {taxEnabled && (
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Tax ({taxPercentage}%)</span>
                    <span className="font-mono">{currencySymbol}{cartValues.taxes}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total</span>
                  <span className="font-mono">{currencySymbol}{cartValues.total}</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handlePlacePosOrder}
                disabled={cartValues.itemsArray.length === 0 || isTableLocked}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none shadow-md"
              >
                {isTableLocked ? 'Table Occupied' : 'Confirm & Send to Kitchen'}
              </button>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: ORDER HISTORY (COMPLETED & CANCELLED)                  */}
        {/* ============================================================== */}
        {activeView === 'order_history' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">
                  Order History &amp; Archived Records
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Permanent log of all completed and cancelled orders with full audit trail.
                </p>
              </div>
              <span className="text-xs font-black bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-mono">
                {orderHistory.length} total records
              </span>
            </div>

            {orderHistory.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-16 text-center shadow-xs">
                <p className="text-xs text-slate-400 font-bold italic">
                  No completed or cancelled orders yet.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Order Token &amp; ID</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Channel &amp; Table</th>
                        <th className="py-3 px-4">Order Status</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderHistory.map(ord => {
                        const statusPill = getOrderStatusPill(ord.status || (ord as any).orderStatus);
                        const paymentPill = getPaymentStatusPill(ord);
                        const dt = formatDateTime(ord.timestamp || ord.createdAt);
                        const token = (ord as any).orderToken || ord.orderNumber || 'A001';

                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono">
                              <span className="font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded mr-1.5">
                                #{token}
                              </span>
                              <span className="text-slate-500">
                                #OP-{ord.orderNumber}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-extrabold text-slate-800">
                              {ord.customerName || 'Walk-in Diner'}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {dt.dateStr}, {dt.timeStr}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-700">
                                {ord.tableNo || ord.type}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-bold">
                                {ord.orderSource || 'POS'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusPill.bg}`}>
                                {statusPill.label}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${paymentPill.bg}`}>
                                {paymentPill.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                              {currencySymbol}{ord.totalAmount || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </PageLayout>
  );
}
