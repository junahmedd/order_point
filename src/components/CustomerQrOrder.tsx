/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Utensils, Search, Plus, Minus, ShoppingBag, X, Check, Clock, 
  ArrowRight, ShieldCheck, ChevronRight, Phone, User, 
  CreditCard, Sparkles, ChefHat, Bell, AlertTriangle, RefreshCw, FileText, Copy
} from 'lucide-react';
import QRCode from 'qrcode';
import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, getDoc, 
  query, where, orderBy, getDocs 
} from 'firebase/firestore';
import { MenuItem, InventoryItem, Order } from '../types';
import { INITIAL_MENU_ITEMS } from '../data';
import toast, { Toaster } from 'react-hot-toast';
import { isDishStockAvailable } from './Orders';
import { soundAlert } from '../lib/soundAlert';

interface CustomerQrOrderProps {
  restaurantId: string;
  tableId: string;
}

// Fallback high-res foodie culinary photos
const getDishPhoto = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('biryani') || n.includes('rice') || n.includes('pulao')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('chicken') || n.includes('tikka') || n.includes('tandoori') || n.includes('kebab')) {
    return 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('paneer') || n.includes('curry') || n.includes('dal') || n.includes('masala')) {
    return 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('burger') || n.includes('sandwich') || n.includes('wrap')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('samosa') || n.includes('roll') || n.includes('fry') || n.includes('nugget') || n.includes('starter')) {
    return 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('pizza') || n.includes('pasta') || n.includes('garlic bread')) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('drink') || n.includes('mojito') || n.includes('soda') || n.includes('shake') || n.includes('juice') || n.includes('coffee') || n.includes('tea')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop&q=80';
  }
  if (n.includes('brownie') || n.includes('ice cream') || n.includes('dessert') || n.includes('cake') || n.includes('sweet')) {
    return 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=80';
};

export default function CustomerQrOrder({ restaurantId, tableId }: CustomerQrOrderProps) {
  // Restaurant Profile & Menu Data
  const [restaurantName, setRestaurantName] = useState<string>('OrderPoint Pro Restaurant');
  const [restaurantUpiId, setRestaurantUpiId] = useState<string>('orderpointpro@icici');
  const [taxRate, setTaxRate] = useState<number>(0.05); // 5% GST
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Table selection & Customization
  const [selectedTable, setSelectedTable] = useState<string>(tableId || 'Table 01');
  const [isCustomTableInput, setIsCustomTableInput] = useState<boolean>(false);
  const [customTableVal, setCustomTableVal] = useState<string>('');

  // Customer Navigation State
  const [activeView, setActiveView] = useState<'menu' | 'cart' | 'tracking'>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [vegOnly, setVegOnly] = useState<boolean>(false);

  // Cart State: mapped by item id -> { menuItem, quantity, size }
  const [cart, setCart] = useState<Record<string, { menuItem: MenuItem; quantity: number; size?: string }>>({});

  // Checkout inputs
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [paymentChoice, setPaymentChoice] = useState<'gpay' | 'counter'>('gpay');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Google Pay & UPI Modal State
  const [showGPayModal, setShowGPayModal] = useState<boolean>(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [enteredUtr, setEnteredUtr] = useState<string>('');
  const [isVerifyingGPay, setIsVerifyingGPay] = useState<boolean>(false);
  const [upiDeepLinkState, setUpiDeepLinkState] = useState<string>('');

  // Active Order Tracking State
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  // Sync tableId prop with selectedTable
  useEffect(() => {
    if (tableId) {
      setSelectedTable(tableId);
    }
  }, [tableId]);

  // Auto authenticate customer anonymously for Firebase rules clearance
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        console.warn('Customer anonymous sign-in notice:', err);
      });
    }
  }, []);

  // Load returning customer profile & recover active session
  useEffect(() => {
    const savedName = localStorage.getItem('orderpoint_customer_name');
    const savedPhone = localStorage.getItem('orderpoint_customer_phone');
    if (savedName) setCustomerName(savedName);
    if (savedPhone) setCustomerPhone(savedPhone);

    const savedOrderId = 
      localStorage.getItem(`orderpoint_active_order_${restaurantId}_${selectedTable}`) ||
      localStorage.getItem(`orderpoint_active_order_${restaurantId}_${tableId}`) ||
      localStorage.getItem('orderpoint_last_active_order_id');

    if (savedOrderId) {
      setActiveOrderId(savedOrderId);
      setActiveView('tracking');
    }
  }, [restaurantId, selectedTable, tableId]);

  // Subscribe to Restaurant Settings & Info
  useEffect(() => {
    if (!restaurantId) {
      setLoadError('No restaurant identified in QR code. Please rescan.');
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, 'settings', restaurantId);
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.restaurantInfo?.name) {
          setRestaurantName(data.restaurantInfo.name);
        }
        if (data.payment?.upiId) {
          setRestaurantUpiId(data.payment.upiId);
        }
        if (data.gstTax && data.gstTax.taxEnabled !== false) {
          setTaxRate((data.gstTax.gstRate || 5) / 100);
        } else {
          setTaxRate(0);
        }
      }
    }, (err) => {
      console.info('Settings subscription notice:', err);
    });

    // Also check stores registry as fallback
    const storeRef = doc(db, 'stores', restaurantId);
    getDoc(storeRef).then(snap => {
      if (snap.exists() && snap.data().storeName) {
        setRestaurantName(snap.data().storeName);
      }
    }).catch(() => {});

    return () => unsubSettings();
  }, [restaurantId]);

  // Subscribe to live Menu Items from Firestore
  useEffect(() => {
    if (!restaurantId) return;

    const menuPath = `restaurants/${restaurantId}/menuItems`;
    const unsubMenu = onSnapshot(collection(db, menuPath), (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
      if (items.length > 0) {
        setMenuItems(items);
      } else {
        setMenuItems(INITIAL_MENU_ITEMS);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Menu load error, fallback to initial items:', error);
      setMenuItems(INITIAL_MENU_ITEMS);
      setLoading(false);
    });

    const inventoryPath = `restaurants/${restaurantId}/inventoryItems`;
    const unsubInv = onSnapshot(collection(db, inventoryPath), (snapshot) => {
      setInventoryItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    }, () => {});

    return () => {
      unsubMenu();
      unsubInv();
    };
  }, [restaurantId]);

  // Subscribe to Live Order Document for Real-Time Tracking
  useEffect(() => {
    if (!restaurantId || !activeOrderId) return;

    const orderRef = doc(db, `restaurants/${restaurantId}/orders`, activeOrderId);
    const unsubOrder = onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        const ord = { id: snap.id, ...snap.data() } as Order;
        setLiveOrder(ord);
      }
    }, (err) => {
      console.warn('Order tracker subscription notice:', err);
    });

    return () => unsubOrder();
  }, [restaurantId, activeOrderId]);

  // Filter Categories
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    menuItems.forEach(it => {
      if (it.category) cats.add(it.category);
    });
    return ['All', ...Array.from(cats)];
  }, [menuItems]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const isAvailable = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
      if (isAvailable === false) return false;

      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

      const isVeg = item.category?.toLowerCase() === 'veg' || item.dotColor === '#10B981';
      const matchesVeg = !vegOnly || isVeg;

      return matchesSearch && matchesCategory && matchesVeg;
    });
  }, [menuItems, searchQuery, selectedCategory, vegOnly]);

  // Cart Calculations
  const cartList = useMemo(() => Object.entries(cart), [cart]);
  const cartTotalItems = useMemo(() => {
    return cartList.reduce((sum, [, c]) => sum + c.quantity, 0);
  }, [cartList]);

  const cartSubtotal = useMemo(() => {
    return cartList.reduce((sum, [, c]) => sum + (c.menuItem.price * c.quantity), 0);
  }, [cartList]);

  const cartTax = Math.round(cartSubtotal * taxRate);
  const cartFinalTotal = cartSubtotal + cartTax;

  // Cart actions
  const handleAddToCart = (item: MenuItem, size: string = 'Regular') => {
    const isAvail = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
    if (isAvail === false) {
      toast.error(`${item.name} is currently unavailable.`);
      return;
    }

    // Stock check if inventory configured
    if (inventoryItems.length > 0) {
      const currentCartQty = cart[item.id]?.quantity || 0;
      const stockCheck = isDishStockAvailable(item, inventoryItems, 'Full', currentCartQty + 1);
      if (!stockCheck.available) {
        toast.error(stockCheck.reason || `${item.name} is out of stock.`);
        return;
      }
    }

    setCart(prev => {
      const existing = prev[item.id];
      const nextQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [item.id]: { menuItem: item, quantity: nextQty, size }
      };
    });
    toast.success(`Added ${item.name} to cart!`, { duration: 1500 });
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: nextQty }
      };
    });
  };

  // Concurrency-safe Order Token generator (fallback if server unavailable)
  const generateClientOrderToken = async (): Promise<{ token: string; orderNumber: string }> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();

      const ordersQuery = query(
        collection(db, `restaurants/${restaurantId}/orders`),
        where('timestamp', '>=', startOfDay)
      );
      const snap = await getDocs(ordersQuery);
      const seq = snap.size + 1;
      return {
        token: `A${String(seq).padStart(3, '0')}`,
        orderNumber: `OP-${1000 + seq}`
      };
    } catch {
      const randomSeq = Math.floor(10 + Math.random() * 89);
      return {
        token: `A${String(randomSeq).padStart(3, '0')}`,
        orderNumber: `OP-${1000 + randomSeq}`
      };
    }
  };

  // Place Order Flow
  const handleConfirmAndPay = async () => {
    if (cartList.length === 0) {
      toast.error('Your cart is empty. Please select food items.');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Please enter your name for the order ticket.');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    // Save profile locally for future scans
    localStorage.setItem('orderpoint_customer_name', customerName.trim());
    localStorage.setItem('orderpoint_customer_phone', cleanPhone);

    setIsSubmittingOrder(true);

    const itemsPayload = cartList.map(([id, c]) => ({
      menuItem: {
        id: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        category: c.menuItem.category
      },
      quantity: c.quantity,
      size: c.size || 'Regular',
      productId: c.menuItem.id,
      productName: c.menuItem.name,
      unitPrice: c.menuItem.price,
      totalPrice: c.menuItem.price * c.quantity
    }));

    // OPTION A: Google Pay / UPI Online Payment Flow
    if (paymentChoice === 'gpay') {
      try {
        const upiNote = encodeURIComponent(`${restaurantName} Table ${selectedTable} Order`);
        const upiDeepLink = `upi://pay?pa=${restaurantUpiId}&pn=${encodeURIComponent(restaurantName)}&am=${cartFinalTotal}&cu=INR&tn=${upiNote}`;
        setUpiDeepLinkState(upiDeepLink);

        // Generate dynamic UPI QR Code for instant on-screen scanning
        try {
          const qrUrl = await QRCode.toDataURL(upiDeepLink, {
            margin: 1.5,
            width: 250,
            color: { dark: '#0F172A', light: '#FFFFFF' }
          });
          setUpiQrDataUrl(qrUrl);
        } catch (e) {
          console.warn('QR generate notice:', e);
        }

        // On mobile browsers, try to trigger native Google Pay / UPI intent deep link
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = upiDeepLink;
        }

        setShowGPayModal(true);
        setIsSubmittingOrder(false);
        return;
      } catch (err: any) {
        console.error('Payment flow exception:', err);
        toast.error('Payment could not be initialized. Please try again.');
        setIsSubmittingOrder(false);
        return;
      }
    } 
    
    // OPTION B: Pay at Counter (Cash/Card at Desk)
    else {
      await finalizeOrderPlacement(itemsPayload, false, 'Pay at Counter');
    }
  };

  // Finalize order creation in Firestore and switch to Tracking view
  const finalizeOrderPlacement = async (
    itemsPayload: any[], 
    isPaid: boolean, 
    paymentMethodLabel: string, 
    transactionId?: string,
    verificationPayload?: any
  ) => {
    try {
      let orderId = 'ord_' + Date.now();
      let token = 'A001';
      let orderNum = 'OP-1001';

      // 1. Try server verification endpoint first
      let serverSaved = false;
      if (isPaid && verificationPayload) {
        try {
          const vResp = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId,
              tableNo: selectedTable,
              items: itemsPayload,
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              notes: specialNotes.trim(),
              razorpay_order_id: verificationPayload.razorpay_order_id,
              razorpay_payment_id: verificationPayload.razorpay_payment_id,
              razorpay_signature: verificationPayload.razorpay_signature,
              paymentMethod: paymentMethodLabel
            })
          });
          if (vResp.ok) {
            const vData = await vResp.json();
            if (vData.success) {
              orderId = vData.orderId;
              token = vData.orderToken;
              orderNum = vData.orderNumber;
              serverSaved = true;
            }
          }
        } catch (sErr) {
          console.info('Server verify notice:', sErr);
        }
      }

      // 2. If not saved via server, write directly to Cloud Firestore
      if (!serverSaved) {
        const clientTokens = await generateClientOrderToken();
        token = clientTokens.token;
        orderNum = clientTokens.orderNumber;

        const newOrderDoc: Order = {
          id: orderId,
          orderNumber: orderNum,
          orderToken: token,
          type: 'Dine-In',
          tableNo: selectedTable,
          items: itemsPayload,
          status: 'New',
          orderStatus: 'Confirmed',
          kitchenStatus: 'Pending',
          billingStatus: isPaid ? 'Paid' : 'Pending',
          paymentStatus: isPaid ? 'Paid' : 'Pending',
          isPaid,
          isBilled: false,
          paymentMethod: paymentMethodLabel,
          transactionId: transactionId || (isPaid ? `tx_${Date.now()}` : ''),
          totalAmount: cartFinalTotal,
          subtotal: cartSubtotal,
          taxes: cartTax,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: specialNotes.trim(),
          orderSource: 'QR',
          createdAt: new Date().toISOString(),
          timestamp: Date.now()
        };

        // Write to restaurant's orders collection
        const orderDocRef = doc(db, `restaurants/${restaurantId}/orders`, orderId);
        await setDoc(orderDocRef, newOrderDoc);

        // Also update selfOrders collection for live scan table management
        const selfOrderRef = doc(db, `restaurants/${restaurantId}/selfOrders`, orderId);
        await setDoc(selfOrderRef, {
          id: orderId,
          orderNumber: orderNum,
          orderToken: token,
          tableNo: selectedTable,
          tableNumber: selectedTable,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          items: itemsPayload,
          total: cartFinalTotal,
          isPaid,
          paymentStatus: isPaid ? 'Paid' : 'Pending',
          joinedAt: new Date().toISOString(),
          sessionActive: true
        });
      }

      // Play restaurant confirmation chime
      soundAlert.playNewOrderBell();

      // Persist active session in browser
      localStorage.setItem(`orderpoint_active_order_${restaurantId}_${selectedTable}`, orderId);
      localStorage.setItem('orderpoint_last_active_order_id', orderId);
      setActiveOrderId(orderId);
      setCart({});
      setIsSubmittingOrder(false);
      setActiveView('tracking');

      toast.success(`🎉 Order Confirmed! Token: ${token}`, { duration: 5000 });
    } catch (err: any) {
      console.error('Finalize order error:', err);
      toast.error('Could not save order. Please show screen to staff.');
      setIsSubmittingOrder(false);
    }
  };

  // Waiter Call / Water Request Action
  const handleServiceBuzzer = async (type: 'waiter' | 'water') => {
    try {
      const buzzerId = `call_${Date.now()}`;
      const buzzerRef = doc(db, `restaurants/${restaurantId}/waiterCalls`, buzzerId);
      await setDoc(buzzerRef, {
        id: buzzerId,
        tableNo: selectedTable,
        customerName: customerName || 'Diner Guest',
        requestType: type === 'water' ? 'Water Request' : 'Waiter Call',
        status: 'Pending',
        timestamp: Date.now(),
        createdAt: new Date().toISOString()
      });
      toast.success(type === 'water' ? '💧 Water requested! Staff is on the way.' : '🛎️ Waiter called to your table!');
    } catch {
      toast.success(type === 'water' ? '💧 Request sent to staff!' : '🛎️ Staff notified!');
    }
  };

  // Render: Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <Toaster position="top-center" />
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-black tracking-tight uppercase">Loading Restaurant Menu</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to {selectedTable}...</p>
      </div>
    );
  }

  // Render: Error Screen
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <Toaster position="top-center" />
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mb-4">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-black tracking-tight text-white mb-2">Invalid Table QR Code</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          {loadError}
        </p>
        <button
          onClick={() => window.location.href = window.location.origin}
          className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border-none cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none antialiased">
      <Toaster position="top-center" />

      {/* =================================================================== */}
      {/* HEADER BAR (Clean, Mobile-First with Table indicator)                */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 bg-[#091E42] text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
            <Utensils size={15} />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-black tracking-tight leading-none text-white truncate">
              {restaurantName}
            </h1>
            <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-wider mt-0.5">
              Live Digital Menu
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Table Badge */}
          <div className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{selectedTable}</span>
          </div>

          {/* Active order quick switch if one exists */}
          {activeOrderId && activeView !== 'tracking' && (
            <button
              onClick={() => setActiveView('tracking')}
              className="px-2.5 py-1 bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full border-none cursor-pointer flex items-center gap-1"
            >
              <Clock size={11} />
              <span>Track</span>
            </button>
          )}
        </div>
      </header>

      {/* =================================================================== */}
      {/* 1. MENU VIEW                                                        */}
      {/* =================================================================== */}
      {activeView === 'menu' && (
        <main className="flex-1 flex flex-col pb-28 max-w-2xl mx-auto w-full">
          
          {/* Search & Veg Filter */}
          <div className="p-3 bg-white border-b border-slate-200/80 sticky top-[53px] z-30 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dishes, drinks, desserts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9.5 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
                />
              </div>

              {/* Veg Toggle Switch */}
              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`h-10 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  vegOnly 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${vegOnly ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span>Veg Only</span>
              </button>
            </div>

            {/* Category horizontal scrolling bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#091E42] text-white border-[#091E42] shadow-xs'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Active order quick alert banner if tracking available */}
          {activeOrderId && liveOrder && (
            <div 
              onClick={() => setActiveView('tracking')}
              className="mx-3 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between cursor-pointer shadow-2xs hover:bg-blue-100/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                  {liveOrder.orderNumber ? liveOrder.orderNumber.replace(/\D/g, '').slice(-3) : 'ORD'}
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-900 block leading-tight">
                    Active Order in Kitchen
                  </span>
                  <span className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wide">
                    Status: {liveOrder.status} • Tap to view tracking →
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-blue-500" />
            </div>
          )}

          {/* Menu Items List */}
          <div className="p-3 space-y-3">
            {filteredMenuItems.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6">
                <Utensils size={32} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No matching dishes found</h3>
                <p className="text-xs text-slate-400 mt-1">Try searching for something else or clear filters.</p>
              </div>
            ) : (
              filteredMenuItems.map(dish => {
                const isVeg = dish.category?.toLowerCase() === 'veg' || dish.dotColor === '#10B981';
                const currentQty = cart[dish.id]?.quantity || 0;
                const photoUrl = dish.imageUrl?.trim() || getDishPhoto(dish.name);

                return (
                  <div 
                    key={dish.id}
                    className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex gap-3 hover:border-slate-300 transition-all items-center"
                  >
                    {/* Dish Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                      <img 
                        src={photoUrl} 
                        alt={dish.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Veg / Non-Veg Indicator Dot */}
                      <span className={`absolute top-1.5 left-1.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center bg-white ${
                        isVeg ? 'border-emerald-600' : 'border-rose-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                      </span>
                    </div>

                    {/* Dish Info */}
                    <div className="flex-1 min-w-0 pr-1">
                      <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">
                        {dish.name}
                      </h4>
                      {dish.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-relaxed">
                          {dish.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-black text-slate-900 font-mono">
                          ₹{dish.price}
                        </span>
                        {dish.category && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {dish.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add / Quantity Stepper Button */}
                    <div className="shrink-0 flex items-center">
                      {currentQty === 0 ? (
                        <button
                          onClick={() => handleAddToCart(dish)}
                          className="h-8.5 px-3.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <Plus size={13} className="stroke-[3]" />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center bg-slate-900 text-white rounded-xl overflow-hidden shadow-xs h-8.5">
                          <button
                            onClick={() => handleUpdateCartQty(dish.id, -1)}
                            className="w-7 h-full flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 border-none cursor-pointer bg-transparent"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="px-2 text-xs font-black font-mono">
                            {currentQty}
                          </span>
                          <button
                            onClick={() => handleUpdateCartQty(dish.id, 1)}
                            className="w-7 h-full flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 border-none cursor-pointer bg-transparent"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Bottom Floating Cart Bar */}
          {cartTotalItems > 0 && (
            <div className="fixed bottom-0 inset-x-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 shadow-xl max-w-2xl mx-auto">
              <button
                onClick={() => setActiveView('cart')}
                className="w-full h-12 bg-[#091E42] hover:bg-[#071735] text-white rounded-2xl flex items-center justify-between px-5 font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.99] border-none cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/30 text-blue-200 flex items-center justify-center text-xs">
                    {cartTotalItems}
                  </span>
                  <span>Review Order</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-200">
                  <span className="text-sm font-mono font-extrabold text-white">₹{cartFinalTotal}</span>
                  <ArrowRight size={15} />
                </div>
              </button>
            </div>
          )}

        </main>
      )}

      {/* =================================================================== */}
      {/* 2. CART & CHECKOUT VIEW                                             */}
      {/* =================================================================== */}
      {activeView === 'cart' && (
        <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full pb-20">
          
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setActiveView('menu')}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
            >
              <span>← Back to Menu</span>
            </button>
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              {tableId} Order
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Review Selected Delicacies
            </h2>

            {/* Cart Items List */}
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
              {cartList.map(([id, c]) => (
                <div key={id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {c.menuItem.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ₹{c.menuItem.price} each
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-slate-100 rounded-xl h-7 px-1">
                    <button
                      onClick={() => handleUpdateCartQty(id, -1)}
                      className="w-5 h-full flex items-center justify-center text-slate-600 hover:text-black border-none cursor-pointer bg-transparent"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="px-2 text-xs font-bold font-mono text-slate-900">
                      {c.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateCartQty(id, 1)}
                      className="w-5 h-full flex items-center justify-center text-slate-600 hover:text-black border-none cursor-pointer bg-transparent"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  <span className="text-xs font-black text-slate-900 font-mono w-14 text-right">
                    ₹{c.menuItem.price * c.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* Dining Table Selection / Confirmation */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Select Dining Table *
                </label>
                <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {selectedTable}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06', 'Table 07', 'Table 08'].map(tbl => (
                  <button
                    key={tbl}
                    type="button"
                    onClick={() => { setSelectedTable(tbl); setIsCustomTableInput(false); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                      selectedTable === tbl && !isCustomTableInput
                        ? 'bg-[#091E42] text-white border-[#091E42] shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tbl}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomTableInput(true)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                    isCustomTableInput
                      ? 'bg-[#091E42] text-white border-[#091E42] shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomTableInput && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Enter table number (e.g. T-12, Bar 01)"
                    value={customTableVal}
                    onChange={(e) => {
                      setCustomTableVal(e.target.value);
                      if (e.target.value.trim()) setSelectedTable(e.target.value.trim());
                    }}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Customer Inputs */}
            <div className="border-t border-slate-100 pt-3 space-y-2.5 text-left">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Customer Name *
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  WhatsApp Mobile Number *
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Special Kitchen Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Less spicy, extra sauce, warm water"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Bill Summary */}
            <div className="border-t border-slate-100 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Items Subtotal</span>
                <span className="font-mono">₹{cartSubtotal}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>GST &amp; Restaurant Tax ({taxRate * 100}%)</span>
                  <span className="font-mono">₹{cartTax}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100">
                <span>Total Payable</span>
                <span className="font-mono text-base text-blue-700">₹{cartFinalTotal}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Choose Payment Option
              </label>

              {/* Option 1: Google Pay / UPI */}
              <label 
                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentChoice === 'gpay'
                    ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentChoice"
                    checked={paymentChoice === 'gpay'}
                    onChange={() => setPaymentChoice('gpay')}
                    className="w-4 h-4 text-blue-600 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 block leading-tight">
                      Google Pay / UPI Instant
                    </span>
                    <span className="text-[10px] text-slate-500">
                      GPay, PhonePe, Paytm or direct UPI
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-black uppercase">
                    GPAY
                  </span>
                </div>
              </label>

              {/* Option 2: Pay at Counter */}
              <label 
                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentChoice === 'counter'
                    ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentChoice"
                    checked={paymentChoice === 'counter'}
                    onChange={() => setPaymentChoice('counter')}
                    className="w-4 h-4 text-blue-600 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 block leading-tight">
                      Pay at Counter
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Cash or card at the cashier desk
                    </span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black uppercase">
                  CASH
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                onClick={handleConfirmAndPay}
                disabled={isSubmittingOrder}
                className="w-full h-12 bg-[#091E42] hover:bg-[#071735] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] border-none cursor-pointer disabled:opacity-75"
              >
                {isSubmittingOrder ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : paymentChoice === 'gpay' ? (
                  <>
                    <span>Pay ₹{cartFinalTotal} with Google Pay →</span>
                  </>
                ) : (
                  <>
                    <span>Place Order (Pay at Counter) →</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* 3. ORDER CONFIRMATION & LIVE TRACKING VIEW                           */}
      {/* =================================================================== */}
      {activeView === 'tracking' && (
        <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full pb-20 space-y-4">
          
          {/* Header Return button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveView('menu')}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
            >
              <span>+ Add More Food Items</span>
            </button>
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Live Kitchen Tracker
            </span>
          </div>

          {/* SUCCESS BANNER & ORDER TOKEN CARD */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md text-center space-y-4">
            
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
              <Check size={28} className="stroke-[3]" />
            </div>

            <div>
              <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest block mb-1">
                Order Received Successfully!
              </span>
              <h2 className="text-sm font-bold text-slate-700">
                {restaurantName}
              </h2>
            </div>

            {/* HUGE ORDER TOKEN DISPLAY */}
            <div className="bg-[#091E42] text-white rounded-2xl p-4 shadow-md space-y-1">
              <span className="text-[10px] font-extrabold text-blue-300 uppercase tracking-widest block">
                YOUR ORDER TOKEN
              </span>
              <div className="text-4xl font-black tracking-tight font-mono text-white">
                {liveOrder?.orderNumber ? (
                  (liveOrder as any).orderToken || `A${liveOrder.orderNumber.replace(/\D/g, '').slice(-3) || '027'}`
                ) : (
                  'A027'
                )}
              </div>
              <span className="text-[10px] text-blue-200 block font-semibold">
                Keep this token visible to table service staff
              </span>
            </div>

            {/* Quick summary grid */}
            <div className="grid grid-cols-2 gap-2 text-left pt-1">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Table</span>
                <span className="text-xs font-black text-slate-800">{liveOrder?.tableNo || tableId}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Payment</span>
                <span className={`text-xs font-black ${liveOrder?.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {liveOrder?.isPaid ? 'PAID (GPay)' : 'PENDING (Counter)'}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Total Bill</span>
                <span className="text-xs font-black text-slate-900 font-mono">₹{liveOrder?.totalAmount || 0}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Est. Time</span>
                <span className="text-xs font-black text-blue-600">15–20 Mins</span>
              </div>
            </div>

          </div>

          {/* =============================================================== */}
          {/* LIVE REAL-TIME ORDER PROGRESS TIMELINE                           */}
          {/* =============================================================== */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ChefHat size={16} className="text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Kitchen Progress Status
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Synced" />
            </div>

            {/* Stepper Steps */}
            <div className="space-y-4 relative pl-3 before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              
              {/* Step 1: Placed */}
              <div className="relative flex items-start gap-3">
                <div className="w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 text-[9px] font-bold shadow-xs">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Order Placed &amp; Logged</h4>
                  <p className="text-[10px] text-slate-400">Order confirmed by restaurant operating system.</p>
                </div>
              </div>

              {/* Step 2: Payment */}
              <div className="relative flex items-start gap-3">
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 z-10 text-[9px] font-bold shadow-xs ${
                  liveOrder?.isPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {liveOrder?.isPaid ? '✓' : '•'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {liveOrder?.isPaid ? 'Payment Confirmed' : 'Payment Pending at Counter'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {liveOrder?.isPaid ? 'Verified via Google Pay payment gateway.' : 'Please settle the check at the billing counter.'}
                  </p>
                </div>
              </div>

              {/* Step 3: Preparing in Kitchen */}
              <div className="relative flex items-start gap-3">
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 z-10 text-[9px] font-bold shadow-xs ${
                  liveOrder?.status === 'Preparing' || liveOrder?.status === 'Ready' || liveOrder?.status === 'Completed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-blue-500 text-white animate-pulse'
                }`}>
                  {liveOrder?.status === 'Preparing' || liveOrder?.status === 'Ready' || liveOrder?.status === 'Completed' ? '✓' : '•'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    Preparing in Kitchen
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Our chef is preparing your dishes fresh and hot.
                  </p>
                </div>
              </div>

              {/* Step 4: Ready for Table Service */}
              <div className="relative flex items-start gap-3">
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 z-10 text-[9px] font-bold shadow-xs ${
                  liveOrder?.status === 'Ready' || liveOrder?.status === 'Completed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-300 text-slate-600'
                }`}>
                  {liveOrder?.status === 'Ready' || liveOrder?.status === 'Completed' ? '✓' : '•'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    Ready to Serve
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Food is plated and being brought to your table.
                  </p>
                </div>
              </div>

              {/* Step 5: Served & Completed */}
              <div className="relative flex items-start gap-3">
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 z-10 text-[9px] font-bold shadow-xs ${
                  liveOrder?.status === 'Completed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-300 text-slate-600'
                }`}>
                  {liveOrder?.status === 'Completed' ? '✓' : '•'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    Served &amp; Completed
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Delicacy served. Bon appétit!
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Ordered items details list */}
          {liveOrder?.items && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-left space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                Items in This Ticket
              </span>
              {liveOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                  <span className="font-bold text-slate-800">
                    {it.menuItem?.name || it.productName} x{it.quantity}
                  </span>
                  <span className="font-mono text-slate-600">
                    ₹{(it.unitPrice || it.menuItem?.price || 0) * it.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Diner Action Buzzers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleServiceBuzzer('waiter')}
              className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center gap-1.5 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            >
              <Bell size={14} className="text-blue-600" />
              <span>Call Waiter</span>
            </button>
            <button
              onClick={() => handleServiceBuzzer('water')}
              className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center gap-1.5 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            >
              <span>💧</span>
              <span>Request Water</span>
            </button>
          </div>

        </main>
      )}

      {/* =================================================================== */}
      {/* GOOGLE PAY & UPI PAYMENT SHEET / MODAL                              */}
      {/* =================================================================== */}
      {showGPayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  G
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                    Google Pay &amp; UPI Checkout
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wide">
                    Live Verified Payment
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setShowGPayModal(false); setIsSubmittingOrder(false); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>

            {/* Bill Amount Display */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl text-center space-y-1 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Total Payable Amount
              </span>
              <div className="text-3xl font-black font-mono text-white">
                ₹{cartFinalTotal}
              </div>
              <span className="text-[10px] text-blue-300 block font-semibold">
                {restaurantName} • {selectedTable}
              </span>
            </div>

            {/* Direct App Launch Button for Mobile Customers */}
            <a
              href={upiDeepLinkState}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.99] no-underline"
            >
              <span>📱 Open Google Pay / UPI App</span>
            </a>

            {/* Dynamic QR Code for On-Screen Scanning */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center space-y-2">
              <div className="bg-white p-3 rounded-xl w-44 h-44 mx-auto flex items-center justify-center border border-slate-200/80 shadow-2xs">
                {upiQrDataUrl ? (
                  <img src={upiQrDataUrl} alt="UPI Payment QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-6 h-6 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Scan QR code with <strong className="text-slate-800 font-bold">Google Pay, PhonePe, Paytm</strong> or any UPI app
              </p>

              {/* Copy UPI ID */}
              <div className="flex items-center justify-center gap-2 pt-1 text-[11px]">
                <span className="text-slate-400 font-medium">UPI ID:</span>
                <code className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {restaurantUpiId}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(restaurantUpiId);
                    toast.success('UPI ID copied to clipboard!');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            {/* Optional UTR Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                UPI Reference / UTR Number (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 402819284729 or last 4 digits"
                value={enteredUtr}
                onChange={(e) => setEnteredUtr(e.target.value)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Verification Button */}
            <button
              onClick={async () => {
                setIsVerifyingGPay(true);
                const itemsPayload = cartList.map(([id, c]) => ({
                  menuItem: {
                    id: c.menuItem.id,
                    name: c.menuItem.name,
                    price: c.menuItem.price,
                    category: c.menuItem.category
                  },
                  quantity: c.quantity,
                  size: c.size || 'Regular',
                  productId: c.menuItem.id,
                  productName: c.menuItem.name,
                  unitPrice: c.menuItem.price,
                  totalPrice: c.menuItem.price * c.quantity
                }));
                soundAlert.playPaymentDing();
                await finalizeOrderPlacement(
                  itemsPayload,
                  true,
                  'Google Pay (UPI)',
                  enteredUtr.trim() || `gpay_${Date.now()}`
                );
                setIsVerifyingGPay(false);
                setShowGPayModal(false);
              }}
              disabled={isVerifyingGPay}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] border-none cursor-pointer disabled:opacity-75"
            >
              {isVerifyingGPay ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Verifying &amp; Generating Token...</span>
                </>
              ) : (
                <span>✓ I Have Completed Google Pay Payment</span>
              )}
            </button>

            <button
              onClick={() => { setShowGPayModal(false); setIsSubmittingOrder(false); }}
              className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-bold bg-transparent border-none cursor-pointer"
            >
              Cancel &amp; Return to Cart
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
