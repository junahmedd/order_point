/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import PageLayout from './PageLayout';
import { 
  Search, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Trash2, 
  Utensils,
  Lock,
  ArrowRight
} from 'lucide-react';
import { MenuItem, Order, OrderType, Category, InventoryItem } from '../types';
import { INITIAL_MENU_ITEMS } from '../data';

interface OrdersProps {
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  orders: Order[];
  onAddOrderToKitchen: (orderData: {
    type: OrderType;
    tableNo?: string;
    items: { menuItem: MenuItem; quantity: number }[];
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    landmark?: string;
    pickupTime?: string;
  }) => void;
  onShowToast: (msg: string) => void;
  settings?: any;
  onNavigateToTab?: (tab: any) => void;
}

const TABLES = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5'];

const CATEGORY_CHIPS = [
  { value: 'All' as const, label: 'All Dishes', dot: '⚪' },
  { value: 'Veg' as const, label: 'Veg', dot: '🟢' },
  { value: 'Non-Veg' as const, label: 'Non-Veg', dot: '🔴' },
  { value: 'Drinks' as const, label: 'Drinks', dot: '🔵' },
  { value: 'Desserts' as const, label: 'Desserts', dot: '🟣' },
];

// Premium Dish Card Image with fallback state
function DishCardImage({ src, name }: { src?: string; name: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F1F5F9] text-gray-400 select-none">
        <span className="text-3xl filter drop-shadow-sm animate-pulse">🍽️</span>
        <span className="text-[10px] uppercase font-[705] mt-1.5 text-gray-500 tracking-wider">No Image Available</span>
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

// Map categories to standard badge colors / dots
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

export const isDishStockAvailable = (dish: MenuItem, inventoryItems: InventoryItem[], portion: 'Half' | 'Full', requestedQty: number = 1): { available: boolean; reason?: string } => {
  let recipe = dish.recipe;
  if (!recipe || recipe.length === 0) {
    const seedItem = INITIAL_MENU_ITEMS.find(m => m.id === dish.id || m.name.toLowerCase() === dish.name.toLowerCase());
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

export default function Orders({ menuItems, inventoryItems, orders, onAddOrderToKitchen, onShowToast, settings, onNavigateToTab }: OrdersProps) {
  const currencySymbol = settings?.prefCurrency || '₹';
  
  // Safe resolution of tax settings
  const taxPercentage = settings?.gstTax?.gstRate !== undefined 
    ? settings.gstTax.gstRate 
    : 0;
    
  const taxEnabled = settings?.gstTax?.taxEnabled !== undefined 
    ? settings.gstTax.taxEnabled 
    : false;

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('Table 1');

  // Active Ticket States
  const [selectedType, setSelectedType] = useState<OrderType>('Dine-In');
  const [selectedTable, setSelectedTable] = useState<string>('Table 1');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const discountPercent = 0;

  // Cart Local State
  const [cart, setCart] = useState<Record<string, { menuItem: MenuItem; quantity: number }>>({});
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Dynamic Table Status Logic: Available (Green), Occupied (Orange), Billing (Red)
  const dynamicTables = useMemo(() => {
    if (settings?.tables && Array.isArray(settings.tables) && settings.tables.length > 0) {
      return settings.tables.map((t: any) => t.name);
    }
    return ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5'];
  }, [settings]);

  const tableStatuses = useMemo(() => {
    const statuses: Record<string, 'Available' | 'Occupied'> = {};
    dynamicTables.forEach(table => {
      const activeOrderForTable = orders.find(o => 
        o.tableNo === table && 
        !o.isPaid
      );
      if (activeOrderForTable) {
        statuses[table] = 'Occupied';
      } else {
        statuses[table] = 'Available';
      }
    });
    return statuses;
  }, [orders, dynamicTables]);

  // Is checked table seat currently locked?
  const isTableLocked = useMemo(() => {
    if (selectedType !== 'Dine-In') return false;
    return tableStatuses[selectedTable] === 'Occupied';
  }, [selectedType, selectedTable, tableStatuses]);

  // Auto-switch to the first available table when the current table becomes occupied or empty
  useEffect(() => {
    if (selectedType === 'Dine-In') {
      const isCurrentOccupied = tableStatuses[selectedTable] === 'Occupied';
      if (isCurrentOccupied || !selectedTable) {
        const firstAvailable = dynamicTables.find(t => tableStatuses[t] === 'Available');

        if (firstAvailable) {
          setSelectedTable(firstAvailable);
          setSelectedTableFilter(firstAvailable);
        } else {
          // If all tables are occupied, fall back to the first table
          setSelectedTable(dynamicTables[0] || 'Table 1');
          setSelectedTableFilter(dynamicTables[0] || 'Table 1');
        }
      }
    }
  }, [tableStatuses, selectedType, selectedTable, dynamicTables]);

  // Dynamic Statistics
  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'Completed' && o.status !== 'Delivered').length;
    const occupied = Object.values(tableStatuses).filter(s => s !== 'Available').length;
    const revenue = orders
      .filter(o => o.status === 'Completed' || o.isPaid)
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      active,
      occupied,
      revenue
    };
  }, [orders, tableStatuses]);

  // Sync Top Table Filter choice with Active Table Selector automatically for speed POS entry
  const handleTableFilterChange = (val: string) => {
    setSelectedTableFilter(val);
    setSelectedTable(val);
  };

  // Filtered Menu Cards based on horizontal controls and dynamic stock
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      // Hide if marked unavailable in menu catalogue
      const available = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
      if (available === false) return false;

      // Hide if stock is insufficient
      const stockStatus = isDishStockAvailable(item, inventoryItems, 'Full', 1);
      if (!stockStatus.available) return false;

      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, inventoryItems, selectedCategory, searchQuery]);

  // Add quantity +1 directly with visual toast hint
  const handleAddToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      onShowToast(`❌ ${item.name} is currently out of stock`);
      return;
    }
    setCart(prev => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: { menuItem: item, quantity: existing.quantity + 1 }
        };
      } else {
        return {
          ...prev,
          [item.id]: { menuItem: item, quantity: 1 }
        };
      }
    });
    onShowToast(`✓ ${item.name} Added`);
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

  const handleClearCart = () => {
    setCart({});
    onShowToast('Cleared current order template');
  };

  // Subtotal & taxes calculation with discount supports
  const cartValues = useMemo(() => {
    const itemsArray = Object.entries(cart)
      .map(([itemId, cartItem]) => {
        const itemObj = cartItem as { menuItem: MenuItem; quantity: number };
        const liveItem = menuItems.find(it => it.id === itemId);
        if (!liveItem) return null;
        return {
          menuItem: liveItem,
          quantity: itemObj.quantity
        };
      })
      .filter((item): item is { menuItem: MenuItem; quantity: number } => item !== null);

    const subtotal = itemsArray.reduce((sum: number, item) => sum + (item.menuItem.price * item.quantity), 0);
    const gstRateVal = taxEnabled ? (taxPercentage / 100) : 0;
    const taxes = Math.round(subtotal * gstRateVal);
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    const total = Math.max(0, subtotal + taxes - discountAmount);

    return {
      itemsArray,
      subtotal,
      taxes,
      discountAmount,
      total
    };
  }, [cart, menuItems, taxEnabled, taxPercentage, discountPercent]);

  // Dispatch current order ticket
  const handlePlaceOrder = () => {
    if (cartValues.itemsArray.length === 0) {
      onShowToast('Please select dishes to add to the order.');
      return;
    }

    const isPhoneValid = customerPhone.length === 10 && /^[6-9][0-9]{9}$/.test(customerPhone);
    if (!isPhoneValid) {
      if (customerPhone.length < 10) {
        onShowToast('Please enter a valid 10-digit mobile number.');
      } else {
        onShowToast('Mobile number must start with 6, 7, 8, or 9.');
      }
      return;
    }

    if (selectedType === 'Dine-In') {
      if (!selectedTable) {
        onShowToast('Please assign a table.');
        return;
      }
      if (isTableLocked) {
        onShowToast('🔒 Assigned table is locked! Please select/clear another table.');
        return;
      }
    }

    if (selectedType === 'Delivery') {
      if (!deliveryAddress.trim()) {
        onShowToast('Please enter the delivery address.');
        return;
      }
    }

    onAddOrderToKitchen({
      type: selectedType,
      tableNo: selectedType === 'Dine-In' ? selectedTable : undefined,
      items: cartValues.itemsArray,
      customerName: `Guest (${customerPhone.trim()})`,
      customerPhone: customerPhone.trim(),
      deliveryAddress: selectedType === 'Delivery' ? deliveryAddress.trim() : undefined,
      landmark: undefined,
      pickupTime: undefined
    });

    // Reset components input fields
    setCart({});
    setCustomerPhone('');
    setDeliveryAddress('');
    setIsMobileCartOpen(false);
    onShowToast('🎉 Order dispatched successfully!');
  };

  return (
    <PageLayout
      title="Orders"
      subtitle="Manage customer orders, monitor order status and process payments."
      id="orders_view"
      customPadding="p-0"
    >
      <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 p-3 sm:p-6 items-start">
        
        {/* LEFT COLUMN: Menu Browsing Area (70% space) */}
        <div className="flex-1 flex flex-col space-y-6">
          
          {/* Search & Filter Top Control Bar (Single Horizontal Row) */}
        <div className="bg-white border border-[#EDEDED] p-3 rounded-[18px] shadow-3xs flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search field */}
          <div className="relative flex-1 w-full lg:max-w-xs">
            <input
              id="order_search_items"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-[#E2E8F0] rounded-xl text-[13px] text-[#111111] focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-400 transition-all font-medium"
            />
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {CATEGORY_CHIPS.map(chip => (
              <button
                id={`btn_cat_filter_${chip.value}`}
                key={chip.value}
                onClick={() => setSelectedCategory(chip.value)}
                className={`px-3.5 h-[41px] rounded-xl text-[12px] font-bold tracking-wide transition-all duration-200 flex items-center gap-1.5 border select-none ${
                    selectedCategory === chip.value
                      ? 'bg-[#111111] text-white border-transparent shadow-xs scale-[1.02] font-extrabold'
                      : 'bg-white border-[#E2E8F0] text-gray-500 hover:text-[#111111] hover:border-gray-300 hover:bg-gray-50 hover:shadow-2xs'
                }`}
              >
                <span className="text-[10px]">{chip.dot}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid of Dishes Menu Cards */}
        {filteredMenuItems.length === 0 ? (
          <div className="bg-white border border-[#EDEDED] rounded-[24px] text-center p-16 shadow-3xs max-w-md mx-auto">
            <Utensils size={36} className="text-gray-300 mx-auto mb-3" />
            <h4 className="text-[15px] font-bold text-gray-800">No active dishes matching your filters</h4>
            <p className="text-[12px] text-gray-400 mt-1">Try adapting your search filters or Category tabs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredMenuItems.map(dish => {
              const inCartQty = cart[dish.id]?.quantity || 0;
              const badge = getCategoryBadgeDetails(dish.category);

              return (
                <div
                  id={`dish_selection_card_${dish.id}`}
                  key={dish.id}
                  onClick={() => handleAddToCart(dish)}
                  className="group flex flex-col rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden shadow-sm transition-all duration-300 hover:border-[#111111] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer select-none h-[230px] flex-shrink-0"
                >
                  {/* Food Image (reduced to 116px height) */}
                  <div className="w-full h-[116px] bg-gray-100 border-b border-[#F1F5F9] relative overflow-hidden flex items-center justify-center flex-shrink-0">
                    <DishCardImage src={dish.imageUrl} name={dish.name} />
                    
                    {/* Subtle dark gradient overlay at bottom of image for text readability */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

                    {/* Category badge positioned Top Left */}
                    <div className={`absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-black shadow-xs bg-white/95 backdrop-blur-xs ${badge.bg}`}>
                      <span>{badge.dot}</span>
                      <span className="tracking-wider">{badge.text}</span>

                    </div>

                    {/* Live item in ticket count top right */}
                    {inCartQty > 0 && (
                      <div className="absolute top-2 right-2 z-10 flex items-center bg-[#111111] text-white border border-white/20 text-[8.5px] font-[800] px-1.5 py-0.5 rounded-full shadow-md">
                        {inCartQty} Joined
                      </div>
                    )}
                  </div>

                  {/* Card Content & Hierarchy */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-bold text-[12.5px] text-[#111111] group-hover:text-black line-clamp-1 truncate font-sans tracking-tight">
                          {dish.name}
                        </h3>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-[1.25] line-clamp-2 h-[25px]">
                        {dish.description || 'Prepared fresh on-demand with select high-grade kitchen ingredients.'}
                      </p>
                    </div>

                    {/* Price display below description */}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-50 flex-shrink-0">
                      <span className="text-[16px] font-[808] text-[#111111] tracking-tight font-sans">
                        {currencySymbol}{dish.price}
                      </span>
                      <span className="text-[8.5px] font-bold text-gray-400 group-hover:text-[#111111] transition-colors flex items-center gap-0.5 uppercase tracking-wider">
                        Quick Add
                        <Plus size={8} className="stroke-[3]" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Current Order sticky operational panel (30% space) */}
      <div className={`w-full xl:w-[350px] bg-white border border-[#E2E8F0] xl:rounded-[22px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 h-fit flex flex-col space-y-5 xl:sticky xl:top-4 ${isMobileCartOpen ? 'fixed inset-0 z-50 overflow-y-auto w-full h-full rounded-none bg-white' : 'hidden xl:flex'}`}>
        
        {/* Mobile Close Button */}
        <div className="xl:hidden flex justify-between items-center pb-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(false)}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 bg-transparent border-none cursor-pointer text-xs font-black uppercase"
          >
            ← Back to Menu
          </button>
          <span className="text-xs font-bold text-slate-800">Checkout Cart</span>
        </div>
        
        {/* Cart Title & Clear Operation */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#111111] stroke-[2.5]" />
            <h2 className="text-[17px] font-[800] text-[#111111] uppercase tracking-tight">Current Order</h2>
          </div>
          {cartValues.itemsArray.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Reset Cart
            </button>
          )}
        </div>

        {/* Service Selector Tab Pills */}
        <div className="bg-gray-100 border border-[#E2E8F0] p-1 rounded-xl grid grid-cols-3 text-center">
          {(['Dine-In', 'Takeaway', 'Delivery'] as const).map(type => (
            <button
              id={`tab_srv_${type}`}
              key={type}
              onClick={() => setSelectedType(type)}
              className={`py-2 rounded-lg text-[10.5px] font-[800] tracking-wider uppercase transition-all ${
                selectedType === type
                  ? 'bg-white text-[#111111] shadow-2xs border border-gray-200'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {type === 'Dine-In' ? 'Dine In' : type}
            </button>
          ))}
        </div>

        {/* Customer Details & Table Selections (44px height inputs) */}
        <div className="space-y-3 bg-[#F8FAFC]/75 rounded-xl p-3.5 border border-[#E2E8F0]">
          
          {/* Customer Mobile Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-[#111111] uppercase tracking-wide block">Customer Mobile Number</label>
            <input
              type="tel"
              placeholder="Enter 10-Digit Mobile Number"
              value={customerPhone}
              onChange={(e) => {
                const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                setCustomerPhone(numericVal);
              }}
              className="w-full h-11 px-3 bg-white border border-[#E2E8F0] rounded-[12px] text-xs font-[500] text-[#111111] focus:outline-none focus:border-[#111111] font-mono"
              maxLength={10}
            />
            {customerPhone.length > 0 && (
              <p className={`text-[10px] font-medium ${customerPhone.length === 10 && /^[6-9]/.test(customerPhone) ? 'text-emerald-600' : 'text-rose-600'}`}>
                {customerPhone.length < 10 
                  ? "Please enter a valid 10-digit mobile number." 
                  : (!/^[6-9]/.test(customerPhone) 
                    ? "Mobile number must start with 6, 7, 8, or 9." 
                    : "✓ Valid Indian mobile number")}
              </p>
            )}
          </div>

          {/* Conditional Table Selector */}
          {selectedType === 'Dine-In' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-extrabold text-[#111111] uppercase tracking-wide block">Select Table</label>
                {tableStatuses[selectedTable] === 'Occupied' ? (
                  <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200">
                    Occupied
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                    Available
                  </span>
                )}
              </div>
              <select
                id="select_dest_table"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full h-11 px-2.5 bg-white border border-[#E2E8F0] rounded-[12px] text-xs font-bold text-[#111111] focus:outline-none focus:border-[#111111]"
              >
                {dynamicTables.map(t => {
                  const isOccupied = tableStatuses[t] === 'Occupied';
                  return (
                    <option 
                      key={t} 
                      value={t} 
                      disabled={isOccupied} 
                      className={isOccupied ? "text-gray-400 bg-gray-100" : "text-[#111111]"}
                    >
                      {t}{isOccupied ? ' (Occupied)' : ' (Available)'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Delivery Address */}
          {selectedType === 'Delivery' && (
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-[#111111] uppercase tracking-wide block">Delivery Address</label>
              <input
                type="text"
                placeholder="Enter Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#E2E8F0] rounded-[12px] text-xs placeholder-gray-400 focus:outline-none focus:border-[#111111]"
              />
            </div>
          )}
        </div>

        {/* Scrollable Cart Items rows */}
        <div className="flex-1 max-h-[220px] overflow-y-auto space-y-2.5 pr-1">
          {cartValues.itemsArray.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-2 select-none">
              <span className="text-3xl block">🍽️</span>
              <p className="text-[12px] font-bold uppercase tracking-widest text-gray-300">No Items Added</p>
              <p className="text-[11px] text-gray-400">Select dishes from the menu catalog to begin.</p>
            </div>
          ) : (
            cartValues.itemsArray.map(item => (
              <div 
                key={item.menuItem.id} 
                className="flex items-center justify-between gap-3 p-2 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-[702] text-[13px] text-gray-800 truncate block uppercase tracking-tight">{item.menuItem.name}</span>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {currencySymbol}{item.menuItem.price} each
                  </span>
                </div>
                
                {/* Compact Qty update with remove button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center border border-[#E2E8F0] rounded-lg bg-white p-0.5 shadow-2xs">
                    <button
                      onClick={() => handleUpdateQty(item.menuItem.id, -1)}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Minus size={10} className="stroke-[3.5]" />
                    </button>
                    <span className="w-5 text-center font-extrabold text-[11px] text-gray-700 font-mono">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQty(item.menuItem.id, 1)}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Plus size={10} className="stroke-[3.5]" />
                    </button>
                  </div>

                  {/* Quick Trash remove */}
                  <button
                    onClick={() => handleUpdateQty(item.menuItem.id, -item.quantity)}
                    className="p-1 text-gray-300 hover:text-rose-500 rounded-md hover:bg-rose-50 transition-all cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dynamic Billing Breakdowns */}
        <div className="border-t border-gray-100 pt-4 space-y-3 select-none text-xs text-gray-400 font-medium font-sans">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-gray-700">{currencySymbol}{cartValues.subtotal}</span>
            </div>
            
            {taxEnabled && (
              <div className="flex justify-between">
                <span>Tax ({taxPercentage}%)</span>
                <span className="font-bold text-gray-700">{currencySymbol}{cartValues.taxes}</span>
              </div>
            )}

            {/* Total Block */}
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="font-extrabold text-[#111111] text-[11px] uppercase tracking-wider">Grand Total</span>
              <span id="label_cart_total_price" className="text-[28px] font-[808] text-[#111111] tracking-[-1px] font-sans">
                {currencySymbol}{cartValues.total}
              </span>
            </div>
          </div>
        </div>

        {/* Big Large Touch Target ORDER dispatcher */}
        <button
          id="btn_send_kitchen_ticket"
          onClick={handlePlaceOrder}
          disabled={cartValues.itemsArray.length === 0 || isTableLocked || customerPhone.length !== 10 || !/^[6-9]/.test(customerPhone)}
          className="w-full h-[56px] rounded-[16px] font-bold text-[16px] bg-[#111111] hover:bg-[#222222] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white uppercase tracking-wider text-center transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.99] shadow-md hover:shadow-lg cursor-pointer"
        >
          {isTableLocked ? (
            <span className="flex items-center gap-1">
              <Lock size={15} /> 
              TABLE OCCUPIED
            </span>
          ) : (
            <span>ORDER</span>
          )}
        </button>

      </div>

      {/* Floating Sticky Cart Summary on Mobile (above bottom nav bar) */}
      {cartValues.itemsArray.length > 0 && !isMobileCartOpen && (
        <div className="xl:hidden fixed bottom-16 inset-x-0 h-16 bg-black border-t border-neutral-900 text-white px-5 flex items-center justify-between z-35 shadow-lg select-none">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none">POS Order</span>
            <span className="text-sm font-extrabold leading-none pt-1">
              {cartValues.itemsArray.reduce((acc, i) => acc + i.quantity, 0)} Items • {currencySymbol}{cartValues.total}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="h-10 px-4 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border-none cursor-pointer shadow-sm flex items-center gap-1"
          >
            <span>View Cart</span>
            <ArrowRight size={12} className="stroke-[2.5]" />
          </button>
        </div>
      )}

    </div>
  </PageLayout>
);
}
