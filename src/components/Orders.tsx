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
  ArrowRight,
  ArrowLeft
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

  // Dynamic Table Status Logic: Available (Green), Occupied (Orange)
  const dynamicTables = useMemo(() => {
    if (settings?.tables && Array.isArray(settings.tables) && settings.tables.length > 0) {
      return settings.tables.map((t: any) => t.name);
    }
    return ['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06', 'Table 07', 'Table 08'];
  }, [settings]);

  const normalizeTbl = (t?: string) => {
    if (!t) return '';
    return t.toLowerCase().replace(/\s+/g, '').replace(/^table0?/, 'table');
  };

  const tableStatuses = useMemo(() => {
    const statuses: Record<string, 'Available' | 'Occupied'> = {};
    dynamicTables.forEach(table => {
      const targetNorm = normalizeTbl(table);
      const activeOrderForTable = orders.find(o => {
        if (!o.tableNo) return false;
        if (o.status === 'Completed' || o.status === 'Delivered' || o.status === 'Cancelled') return false;
        return normalizeTbl(o.tableNo) === targetNorm;
      });
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
      pillVariant="green"
    >
      <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 p-3 sm:p-6 items-start">
        
        {/* LEFT COLUMN: Menu Browsing Area (70% space) */}
        <div className="flex-1 flex flex-col space-y-6">
          
          {/* Category Filter Pills (Reduced pill size, search bar removed) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_CHIPS.map(chip => (
              <button
                id={`btn_cat_filter_${chip.value}`}
                key={chip.value}
                onClick={() => setSelectedCategory(chip.value)}
                className={`px-3 h-8 rounded-full text-xs font-bold tracking-wide transition-all duration-150 flex items-center gap-1.5 border select-none cursor-pointer ${
                  selectedCategory === chip.value
                    ? 'bg-[#111111] text-white border-[#111111] shadow-xs font-black'
                    : 'bg-white border-gray-200 text-gray-600 hover:text-[#111111] hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <span className="text-[9px]">{chip.dot}</span>
                <span>{chip.label}</span>
              </button>
            ))}
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
                  onClick={() => { if (inCartQty === 0) { handleAddToCart(dish); } }}
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
                        {inCartQty} in cart
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

                    {/* Price & Quantity Stepper / Add button */}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-50 flex-shrink-0">
                      <span className="text-[15px] font-black text-gray-950 tracking-tight font-sans">
                        {currencySymbol}{dish.price}
                      </span>
                      {inCartQty > 0 ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 inline-flex items-center gap-1.5 bg-gray-950 text-white rounded-full px-2 shadow-xs border border-gray-900"
                        >
                          <button
                            type="button"
                            id={`btn_qty_minus_${dish.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQty(dish.id, -1);
                            }}
                            className="w-5 h-5 flex items-center justify-center text-white/90 hover:text-white rounded-full hover:bg-white/20 active:scale-90 transition-all cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus size={11} className="stroke-[3]" />
                          </button>
                          <span className="min-w-[14px] text-center font-black text-xs text-white select-none">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            id={`btn_qty_plus_${dish.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQty(dish.id, 1);
                            }}
                            className="w-5 h-5 flex items-center justify-center text-white/90 hover:text-white rounded-full hover:bg-white/20 active:scale-90 transition-all cursor-pointer"
                            title="Increase quantity"
                          >
                            <Plus size={11} className="stroke-[3]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          id={`btn_add_dish_${dish.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(dish);
                          }}
                          className="h-7 px-3 rounded-full bg-gray-950 hover:bg-black text-white text-[11px] font-bold tracking-wider flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                        >
                          <span>ADD</span>
                          <Plus size={10} className="stroke-[3]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Current Order operational panel */}
      <div className={`w-full xl:w-[350px] bg-white border border-gray-200 xl:rounded-[22px] shadow-sm p-4 sm:p-5 h-fit flex flex-col space-y-4 xl:sticky xl:top-4 ${isMobileCartOpen ? 'fixed inset-0 z-50 overflow-y-auto w-full h-full rounded-none bg-white pb-24' : 'hidden xl:flex'}`}>
        
        {/* Top Header with small back button for mobile */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(false)}
              className="xl:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors border-none cursor-pointer active:scale-95"
              title="Back to Order"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-gray-950 stroke-[2.5]" />
              <h2 className="text-base font-extrabold text-gray-950 uppercase tracking-tight">Current Order</h2>
            </div>
          </div>
          {cartValues.itemsArray.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-1"
            >
              <Trash2 size={13} />
              <span>Reset Cart</span>
            </button>
          )}
        </div>

        {/* Service Selector: Dine In vs Takeaway (Delivery removed) */}
        <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 text-center select-none">
          {(['Dine-In', 'Takeaway'] as const).map(type => (
            <button
              id={`tab_srv_${type}`}
              key={type}
              onClick={() => setSelectedType(type)}
              className={`py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all cursor-pointer ${
                selectedType === type
                  ? 'bg-white text-gray-950 shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {type === 'Dine-In' ? 'Dine In' : type}
            </button>
          ))}
        </div>

        {/* Customer Details & Table Selections */}
        <div className="space-y-3 bg-gray-50/80 rounded-2xl p-3.5 border border-gray-100">
          {/* Customer Mobile Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider block">Customer Mobile Number</label>
            <input
              type="tel"
              placeholder="Enter 10-Digit Mobile Number"
              value={customerPhone}
              onChange={(e) => {
                const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                setCustomerPhone(numericVal);
              }}
              className="w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/10 focus:border-gray-950 font-mono transition-all"
              maxLength={10}
            />
            {customerPhone.length > 0 && (
              <p className={`text-[10px] font-semibold ${customerPhone.length === 10 && /^[6-9]/.test(customerPhone) ? 'text-emerald-600' : 'text-rose-500'}`}>
                {customerPhone.length < 10 
                  ? "Enter 10-digit mobile number" 
                  : (!/^[6-9]/.test(customerPhone) 
                    ? "Must start with 6, 7, 8, or 9" 
                    : "✓ Valid Mobile Number")}
              </p>
            )}
          </div>

          {/* Conditional Table Selector */}
          {selectedType === 'Dine-In' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider block">Select Table</label>
                {tableStatuses[selectedTable] === 'Occupied' ? (
                  <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-rose-200">
                    Occupied
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                    Available
                  </span>
                )}
              </div>
              <select
                id="select_dest_table"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/10 focus:border-gray-950 transition-all cursor-pointer"
              >
                {dynamicTables.map(t => {
                  const isOccupied = tableStatuses[t] === 'Occupied';
                  return (
                    <option 
                      key={t} 
                      value={t} 
                      disabled={isOccupied} 
                      className={isOccupied ? "text-gray-400 bg-gray-100" : "text-gray-900"}
                    >
                      {t}{isOccupied ? ' (Occupied)' : ' (Available)'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Scrollable Cart Items rows */}
        <div className="flex-1 max-h-[240px] overflow-y-auto space-y-2 pr-1">
          {cartValues.itemsArray.length === 0 ? (
            <div className="py-10 text-center text-gray-400 space-y-2 select-none">
              <Utensils size={30} className="mx-auto text-gray-300 stroke-[1.5]" />
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">No Items Added</p>
              <p className="text-[11px] text-gray-400">Select dishes from the menu to start order.</p>
            </div>
          ) : (
            cartValues.itemsArray.map(item => (
              <div 
                key={item.menuItem.id} 
                className="flex items-center justify-between gap-3 p-2.5 border border-gray-100 rounded-xl bg-gray-50/60 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-gray-900 truncate block">{item.menuItem.name}</span>
                  <span className="text-[11px] text-gray-500 font-semibold">
                    {currencySymbol}{item.menuItem.price} each
                  </span>
                </div>
                
                {/* Stepper with [ - qty + ] */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center border border-gray-200 rounded-lg bg-white p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.menuItem.id, -1)}
                      className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Minus size={11} className="stroke-[3]" />
                    </button>
                    <span className="w-5 text-center font-black text-xs text-gray-800">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.menuItem.id, 1)}
                      className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-black rounded hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Plus size={11} className="stroke-[3]" />
                    </button>
                  </div>

                  {/* Quick Trash remove */}
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(item.menuItem.id, -item.quantity)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all cursor-pointer"
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
        <div className="border-t border-gray-100 pt-3 space-y-2 select-none text-xs text-gray-500 font-medium font-sans">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-bold text-gray-800">{currencySymbol}{cartValues.subtotal}</span>
          </div>
          
          {taxEnabled && (
            <div className="flex justify-between">
              <span>Tax ({taxPercentage}%)</span>
              <span className="font-bold text-gray-800">{currencySymbol}{cartValues.taxes}</span>
            </div>
          )}

          {/* Total Block */}
          <div className="border-t border-gray-100 pt-2.5 flex justify-between items-baseline">
            <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wider">Grand Total</span>
            <span id="label_cart_total_price" className="text-2xl font-black text-gray-950 tracking-tight">
              {currencySymbol}{cartValues.total}
            </span>
          </div>
        </div>

        {/* ORDER Dispatcher Button */}
        <button
          id="btn_send_kitchen_ticket"
          onClick={handlePlaceOrder}
          disabled={cartValues.itemsArray.length === 0 || (selectedType === 'Dine-In' && (isTableLocked || !selectedTable)) || customerPhone.length !== 10 || !/^[6-9]/.test(customerPhone)}
          className="w-full h-12 rounded-xl font-bold text-sm bg-gray-950 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white uppercase tracking-wider text-center transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.99] shadow-sm hover:shadow-md cursor-pointer"
        >
          {isTableLocked && selectedType === 'Dine-In' ? (
            <span className="flex items-center gap-1.5">
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
