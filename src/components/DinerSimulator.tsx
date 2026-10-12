/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  User, Phone, Utensils, Search, Minus, Plus, ShieldCheck, 
  ArrowRight, CreditCard, RotateCcw, Smartphone, FileText, Sparkles,
  Bell, CheckCircle, Download, X, Coffee, Award, Zap, HelpCircle, Receipt, Send
} from 'lucide-react';
import { MenuItem, Order, InventoryItem } from '../types';
import { auth } from '../firebase';
import { isDishStockAvailable } from './Orders';
import PaymentModal from './PaymentModal';

interface DinerSimulatorProps {
  selectedTable: string;
  setSelectedTable: (table: string) => void;
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  orders: Order[];
  onAddOrder: (order: Order) => Promise<void>;
  onPlaceSelfOrder: (customerName: string, phone: string, tableNo: string, items: { menuItem: MenuItem; quantity: number }[]) => void;
  onShowToast: (msg: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isPaymentModalOpen?: boolean;
  setIsPaymentModalOpen?: (open: boolean) => void;
  tempOrderId?: string;
  setTempOrderId?: (id: string) => void;
  tempOrderNumber?: string;
  setTempOrderNumber?: (num: string) => void;
  activeCartTotal?: number;
  setActiveCartTotal?: (total: number) => void;
  custName?: string;
  setCustName?: (name: string) => void;
  custPhone?: string;
  setCustPhone?: (phone: string) => void;
  custCart?: Record<string, { menuItem: MenuItem; quantity: number }>;
  setCustCart?: React.Dispatch<React.SetStateAction<Record<string, { menuItem: MenuItem; quantity: number }>>>;
  handleConfirmPaidScanGo?: (appLabel: string, txId?: string) => Promise<void>;
  onRaiseWaiterAlert?: (table: string, requestType: string) => void;
  isStandalone?: boolean;
}

export interface WhatsAppMsg {
  id: string;
  type: 'sent' | 'received';
  title: string;
  message: string;
  timestamp: string;
  attachments?: string[];
}

const isItemAvailableForOrdering = (item: MenuItem): boolean => {
  const available = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
  return available !== false;
};

// Map common food items to stunning Unsplash high-res foodie culinary pictures
const getDishImage = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('biryani') || n.includes('rice') || n.includes('pulao') || n.includes('fried rice')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('chicken') || n.includes('tikka') || n.includes('tandoori') || n.includes('kebab') || n.includes('butter')) {
    return 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('paneer') || n.includes('curry') || n.includes('kofta') || n.includes('dal') || n.includes('gravy') || n.includes('masala')) {
    return 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('burger') || n.includes('sandwich') || n.includes('wrap') || n.includes('street')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('samosa') || n.includes('roll') || n.includes('fry') || n.includes('starter') || n.includes('crispy') || n.includes('nugget') || n.includes('manchurian')) {
    return 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('pizza') || n.includes('garlic bread') || n.includes('pasta')) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('drink') || n.includes('mojito') || n.includes('soda') || n.includes('shake') || n.includes('juice') || n.includes('coffee') || n.includes('tea') || n.includes('water') || n.includes('mocktail')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&auto=format&fit=crop&q=80';
  }
  if (n.includes('brownie') || n.includes('gulab') || n.includes('jamun') || n.includes('sweet') || n.includes('cake') || n.includes('ice cream') || n.includes('dessert') || n.includes('kulfi') || n.includes('pudding')) {
    return 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=300&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&auto=format&fit=crop&q=80';
};

const renderMessageWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-700 hover:underline font-extrabold break-all underline"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function DinerSimulator({
  selectedTable,
  setSelectedTable,
  menuItems,
  inventoryItems,
  orders,
  onAddOrder,
  onPlaceSelfOrder,
  onShowToast,
  isOpen,
  onClose,
  isPaymentModalOpen: propIsPaymentModalOpen,
  setIsPaymentModalOpen: propSetIsPaymentModalOpen,
  tempOrderId: propTempOrderId,
  setTempOrderId: propSetTempOrderId,
  tempOrderNumber: propTempOrderNumber,
  setTempOrderNumber: propSetTempOrderNumber,
  activeCartTotal: propActiveCartTotal,
  setActiveCartTotal: propSetActiveCartTotal,
  custName: propCustName,
  setCustName: propSetCustName,
  custPhone: propCustPhone,
  setCustPhone: propSetCustPhone,
  custCart: propCustCart,
  setCustCart: propSetCustCart,
  handleConfirmPaidScanGo: propHandleConfirmPaidScanGo,
  onRaiseWaiterAlert,
  isStandalone,
}: DinerSimulatorProps) {
  // Local fallback states for standalone execution
  const [localIsPaymentModalOpen, setLocalIsPaymentModalOpen] = useState(false);
  const [localTempOrderId, setLocalTempOrderId] = useState('');
  const [localTempOrderNumber, setLocalTempOrderNumber] = useState('');
  const [localActiveCartTotal, setLocalActiveCartTotal] = useState(0);
  const [localCustName, setLocalCustName] = useState('');
  const [localCustPhone, setLocalCustPhone] = useState('');
  const [localCustCart, setLocalCustCart] = useState<Record<string, { menuItem: MenuItem; quantity: number }>>({});

  const isPaymentModalOpen = propIsPaymentModalOpen !== undefined ? propIsPaymentModalOpen : localIsPaymentModalOpen;
  const setIsPaymentModalOpen = propSetIsPaymentModalOpen !== undefined ? propSetIsPaymentModalOpen : setLocalIsPaymentModalOpen;
  const tempOrderId = propTempOrderId !== undefined ? propTempOrderId : localTempOrderId;
  const setTempOrderId = propSetTempOrderId !== undefined ? propSetTempOrderId : setLocalTempOrderId;
  const tempOrderNumber = propTempOrderNumber !== undefined ? propTempOrderNumber : localTempOrderNumber;
  const setTempOrderNumber = propSetTempOrderNumber !== undefined ? propSetTempOrderNumber : setLocalTempOrderNumber;
  const activeCartTotal = propActiveCartTotal !== undefined ? propActiveCartTotal : localActiveCartTotal;
  const setActiveCartTotal = propSetActiveCartTotal !== undefined ? propSetActiveCartTotal : setLocalActiveCartTotal;
  
  const custName = propCustName !== undefined ? propCustName : localCustName;
  const setCustName = propSetCustName !== undefined ? propSetCustName : setLocalCustName;
  const custPhone = propCustPhone !== undefined ? propCustPhone : localCustPhone;
  const setCustPhone = propSetCustPhone !== undefined ? propSetCustPhone : setLocalCustPhone;
  const custCart = propCustCart !== undefined ? propCustCart : localCustCart;
  const setCustCart = propSetCustCart !== undefined ? propSetCustCart : setLocalCustCart;
  const [customerScreen, setCustomerScreen] = useState<'welcome' | 'menu' | 'cart' | 'tracking'>('welcome');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'counter'>('upi');
  const [activeOrderTrackId, setActiveOrderTrackId] = useState<string>('');
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppMsg[]>([]);
  
  // Custom states for premium UX helpers
  const [showWaiterDrawer, setShowWaiterDrawer] = useState<boolean>(false);
  const [showBillModal, setShowBillModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [vegOnly, setVegOnly] = useState(false);

  // Return Customer Auto-detect trigger
  useEffect(() => {
    const savedName = localStorage.getItem('orderpoint_scango_name');
    const savedPhone = localStorage.getItem('orderpoint_scango_phone');
    if (savedName && !custName) {
      setCustName(savedName);
    }
    if (savedPhone && !custPhone) {
      setCustPhone(savedPhone);
    }
    if (savedName) {
      onShowToast(`👋 Returning Guest profile detected: ${savedName}. Auto-filling!`);
    }
  }, []);

  // Dynamically find order currently being tracked in live database
  const trackedOrder = useMemo(() => {
    if (!activeOrderTrackId) return null;
    return orders.find(o => o.id === activeOrderTrackId) || null;
  }, [orders, activeOrderTrackId]);

  // Track state transitions to auto-trigger simulated WhatsApp messages!
  useEffect(() => {
    if (trackedOrder && trackedOrder.isPaid) {
      const alreadySent = whatsappLogs.some(log => log.id === `confirm_${trackedOrder.id}`);
      if (!alreadySent) {
        const token = trackedOrder.orderNumber.replace(/\D/g, '') || trackedOrder.orderNumber;
        const isUpi = trackedOrder.paymentMethod !== 'CASH';
        const payMethodLabel = isUpi ? 'UPI' : 'Cash';
        const confirmMsg = isUpi 
          ? 'Your order has been sent to the kitchen.' 
          : 'Your payment has been received successfully.';

        const messageText = `Thank you for your order!

Order ID: ${trackedOrder.invoiceNumber || `INV-${trackedOrder.orderNumber}`}
Token: ${token}
Amount Paid: ₹${trackedOrder.totalAmount}
Payment Method: ${payMethodLabel}
Payment Status: PAID

${confirmMsg}

Thank you for choosing us!`;

        const newMsg: WhatsAppMsg = {
          id: `confirm_${trackedOrder.id}`,
          type: 'sent',
          title: '🍽️ OrderPoint Pro - Order Confirmed',
          message: messageText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          attachments: ['OrderPoint_Invoice_' + trackedOrder.orderNumber + '.pdf', 'Receipt.pdf']
        };
        setWhatsappLogs(prev => [newMsg, ...prev]);
        onShowToast(`📲 WhatsApp digital invoice dispatched to +91 ${custPhone}!`);
      }
    }
  }, [trackedOrder, whatsappLogs, custName, selectedTable, custPhone]);

  useEffect(() => {
    if (trackedOrder && trackedOrder.status === 'Ready') {
      const alreadySentReady = whatsappLogs.some(log => log.id === `ready_${trackedOrder.id}`);
      if (!alreadySentReady) {
        const newMsg: WhatsAppMsg = {
          id: `ready_${trackedOrder.id}`,
          type: 'sent',
          title: '🛎️ Delicacy Ready!',
          message: `Hello ${custName},\n\nYour order #${trackedOrder.orderNumber} is now ready on Table ${selectedTable.replace(/^\D+/g, '')}!\n\nOur service staff is bringing it out hot, or you can secure it directly. Enjoy your meal!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          attachments: []
        };
        setWhatsappLogs(prev => [newMsg, ...prev]);
        onShowToast(`🔔 WhatsApp 'Ready to Serve' alert transmitted to ${custPhone}!`);
      }
    }
  }, [trackedOrder, whatsappLogs, custName, custPhone]);

  useEffect(() => {
    if (trackedOrder && (trackedOrder.status === 'Delivered' || trackedOrder.status === 'Completed')) {
      const alreadySentServed = whatsappLogs.some(log => log.id === `served_${trackedOrder.id}`);
      if (!alreadySentServed) {
        const restaurantId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
        const invoiceNo = trackedOrder.invoiceNumber || `INV-${trackedOrder.orderNumber}`;
        const feedbackLink = `${window.location.origin}/?feedback=${invoiceNo}&store=${restaurantId}`;

        const messageText = `🍽️ *Thank you for dining with us!*

Hi ${custName || 'Customer'}, thank you for visiting us today! We hope you loved your meal.

*Restaurant Name:* OrderPoint Pro
*Order ID:* OP-${trackedOrder.orderNumber} (Table ${selectedTable.replace(/^\D+/g, '')})

⭐ *We value your experience!* Please take a few seconds to rate your order:
👉 ${feedbackLink}

Thank you for choosing OrderPoint Pro. We look forward to serving you again!`;

        const newMsg: WhatsAppMsg = {
          id: `served_${trackedOrder.id}`,
          type: 'sent',
          title: '✅ Order Completed - Feedback Link',
          message: messageText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          attachments: ['Official_Receipt_' + trackedOrder.orderNumber + '.pdf']
        };
        setWhatsappLogs(prev => [newMsg, ...prev]);
        onShowToast(`💚 Customer feedback survey & final bill receipt shared to whatsapp!`);
      }
    }
  }, [trackedOrder, whatsappLogs, custName, selectedTable, custPhone]);

  // Cart helper calculations
  const cartItems = useMemo(() => {
    return Object.entries(custCart).map(([itemId, cartItem]) => {
      const itemObj = cartItem as { menuItem: MenuItem; quantity: number };
      const baseId = itemId.split('-')[0];
      const liveItem = menuItems.find(it => it.id === baseId);
      if (!liveItem) return {
        menuItem: itemObj.menuItem,
        quantity: itemObj.quantity,
        productId: baseId,
        productName: itemObj.menuItem.name,
        unitPrice: itemObj.menuItem.price,
        totalPrice: itemObj.menuItem.price * itemObj.quantity
      };
      
      let reconstructedItem = itemObj.menuItem;
      let size: string | undefined = undefined;
      let unitPrice = liveItem.price;

      const variantSuffix = itemId.replace(`${baseId}-`, '');
      if (variantSuffix === 'HALF') {
        size = 'Half';
        unitPrice = liveItem.price / 2;
        reconstructedItem = {
          ...liveItem,
          id: itemId,
          name: `${liveItem.name}`,
          price: unitPrice,
          isAvailable: true
        };
      } else if (variantSuffix === 'FULL') {
        size = 'Full';
        unitPrice = liveItem.price;
        reconstructedItem = {
          ...liveItem,
          id: itemId,
          name: `${liveItem.name}`,
          price: unitPrice,
          isAvailable: true
        };
      } else {
        reconstructedItem = {
          ...liveItem,
          id: itemId,
          isAvailable: true
        };
      }

      return {
        menuItem: reconstructedItem,
        quantity: itemObj.quantity,
        productId: baseId,
        productName: liveItem.name,
        size,
        unitPrice,
        totalPrice: unitPrice * itemObj.quantity
      };
    });
  }, [custCart, menuItems]);

  const activeCartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const activeCartSubtotal = cartItems.reduce((sum, c) => sum + ((c.unitPrice || c.menuItem.price) * c.quantity), 0);
  const activeCartGst = 0; // Tax disabled by default
  const calcTotal = activeCartSubtotal > 0 ? activeCartSubtotal + 10 : 0; // ₹10 Service charge

  // Sync total up to parent component for PaymentModal
  useEffect(() => {
    setActiveCartTotal(calcTotal);
  }, [calcTotal, setActiveCartTotal]);

  const handleAddToCart = (item: MenuItem, variantName?: string) => {
    const isAvail = item.isAvailableForOrder !== undefined ? item.isAvailableForOrder : item.isAvailable;
    if (!isAvail) {
      onShowToast(`❌ ${item.name} is currently unavailable.`);
      return;
    }

    const selectedSize = variantName || 'Full';

    // Stock availability validation
    if (inventoryItems && Array.isArray(inventoryItems)) {
      const existingQtyInCart = custCart[`${item.id}-${selectedSize.toUpperCase()}`]?.quantity || 0;
      const stockCheck = isDishStockAvailable(item, inventoryItems, selectedSize as 'Half' | 'Full', existingQtyInCart + 1);
      if (!stockCheck.available) {
        onShowToast(`⚠️ ${stockCheck.reason}`);
        return;
      }
    }
    const unitPrice = selectedSize === 'Half' ? item.price / 2 : item.price;
    const virtualItem: MenuItem = {
      ...item,
      id: `${item.id}-${selectedSize.toUpperCase()}`,
      name: `${item.name}`,
      price: unitPrice,
      isAvailable: true
    };

    setCustCart(prev => {
      const existing = prev[virtualItem.id];
      return {
        ...prev,
        [virtualItem.id]: { menuItem: virtualItem, quantity: existing ? existing.quantity + 1 : 1 }
      };
    });
    onShowToast(`Added ${item.name} (${selectedSize}) to tabletop check.`);
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    if (delta > 0 && inventoryItems && Array.isArray(inventoryItems)) {
      const existing = custCart[itemId];
      if (existing) {
        const lastHyphen = itemId.lastIndexOf('-');
        if (lastHyphen !== -1) {
          const originalId = itemId.substring(0, lastHyphen);
          const sizeUpper = itemId.substring(lastHyphen + 1);
          const portion = sizeUpper.toLowerCase() === 'half' ? 'Half' : 'Full';
          const originalItem = menuItems.find(m => m.id === originalId);
          if (originalItem) {
            const stockCheck = isDishStockAvailable(originalItem, inventoryItems, portion, existing.quantity + delta);
            if (!stockCheck.available) {
              onShowToast(`⚠️ ${stockCheck.reason}`);
              return;
            }
          }
        }
      }
    }

    setCustCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const nextCart = { ...prev };
        delete nextCart[itemId];
        return nextCart;
      }
      return { ...prev, [itemId]: { ...existing, quantity: nextQty } };
    });
  };

  const handleProceedToMenu = () => {
    if (!custName.trim() || !custPhone.trim()) {
      onShowToast('⚠️ Diner Name & WhatsApp Mobile are required to continue');
      return;
    }
    const isPhoneValid = custPhone.length === 10 && /^[6-9][0-9]{9}$/.test(custPhone);
    if (!isPhoneValid) {
      if (custPhone.length < 10) {
        onShowToast('⚠️ Please enter a valid 10-digit mobile number.');
      } else {
        onShowToast('⚠️ Mobile number must start with 6, 7, 8, or 9.');
      }
      return;
    }
    
    // Save to local storage for future auto-fills
    localStorage.setItem('orderpoint_scango_name', custName.trim());
    localStorage.setItem('orderpoint_scango_phone', custPhone.trim());
    
    setCustomerScreen('menu');
    onShowToast(`Welcome, ${custName}! Browsing smart menu updated for table ${selectedTable}`);
  };

  const handlePlaceOrder = async () => {
    const itemsArray = Object.values(custCart) as { menuItem: MenuItem; quantity: number }[];
    if (itemsArray.length === 0) {
      onShowToast('⚠️ Your cart is empty. Please select food items.');
      return;
    }

    if (paymentMethod === 'upi') {
      const newId = 'scan_' + Date.now();
      const newNum = 'OP-' + Math.floor(1000 + Math.random() * 9000);
      setTempOrderId(newId);
      setTempOrderNumber(newNum);
      setIsPaymentModalOpen(true);
    } else {
      const newId = 'scan_' + Date.now();
      const newNum = 'OP-' + Math.floor(1000 + Math.random() * 9000);
      
      const subtotal = itemsArray.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
      const taxRate = 0.05;
      const serviceCharge = 10;
      const finalAmount = Math.round(subtotal + (subtotal * taxRate) + serviceCharge);
      
      const mappedItems = itemsArray.map(itemObj => ({
        menuItem: itemObj.menuItem,
        quantity: itemObj.quantity
      }));

      const newOrder: Order = {
        id: newId,
        orderNumber: newNum,
        type: 'Dine-In',
        tableNo: selectedTable,
        items: mappedItems,
        status: 'New',
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
        customerName: custName,
        customerPhone: custPhone,
        totalAmount: finalAmount,
        isPaid: false,
        isBilled: false,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        transactionId: ''
      };

      onAddOrder(newOrder).then(() => {
        setCustCart({});
        setActiveOrderTrackId(newId);
        setCustomerScreen('tracking');
        onShowToast(`🚀 Cash Order #${newNum} sent to Kitchen & Billing Desk!`);
      });
    }
  };

  // Waiter butler buzzer trigger
  const handleCallWaiterAction = (requestType: string) => {
    if (onRaiseWaiterAlert) {
      onRaiseWaiterAlert(selectedTable, requestType);
    }
    onShowToast(`🛎️ Waiter call logged! Mapped: Table ${selectedTable.replace(/^\D+/g, '')} needs ${requestType}`);
    setShowWaiterDrawer(false);
  };

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'All' ? true : 
                            (selectedCategory === 'Veg' ? (item.category === 'Veg' || item.dotColor === '#10B981') :
                             selectedCategory === 'Non-Veg' ? (item.category === 'Non-Veg' || item.dotColor === '#EF4444' || item.dotColor === '#F59E0B') :
                             item.category === selectedCategory);
                             
      const matchVegToggle = vegOnly ? (item.category === 'Veg' || item.dotColor === '#10B981') : true;

      return matchSearch && matchCategory && matchVegToggle && isItemAvailableForOrdering(item);
    });
  }, [menuItems, searchQuery, selectedCategory, vegOnly]);

  // Set local tracking id on parent checkout success
  useEffect(() => {
    const lastOrder = orders[orders.length - 1];
    if (lastOrder && lastOrder.customerPhone === custPhone && lastOrder.tableNo === selectedTable) {
      // Avoid tracking non-paid ones if checkout was UPI, or enable immediate tracking
      if (!activeOrderTrackId && (lastOrder.isPaid || lastOrder.status === 'New')) {
        setActiveOrderTrackId(lastOrder.id);
        setCustomerScreen('tracking');
      }
    }
  }, [orders, custPhone, selectedTable, activeOrderTrackId]);

  if (!isOpen) return null;

  if (isStandalone) {
    const itemsArray = Object.values(custCart) as { menuItem: MenuItem; quantity: number }[];
    const subtotal = itemsArray.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
    const taxRate = 0.05;
    const calcTotal = Math.round(subtotal + (subtotal * taxRate) + 10);

    return (
      <div className="flex-1 flex flex-col bg-slate-50 relative w-full h-full min-h-screen text-slate-800">
        {/* Header Bar */}
        <div className="bg-slate-950 text-white p-4 flex justify-between items-center shadow-md select-none shrink-0">
          <button
            onClick={() => {
              window.location.href = window.location.origin;
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-white text-[10.5px] font-black uppercase tracking-wider bg-transparent border-none cursor-pointer font-sans transition-colors"
          >
            <span>← Home</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-[#22C55E] flex items-center justify-center font-bold text-xs text-white">O</div>
            <span className="font-extrabold text-xs uppercase tracking-tight">OrderPoint Pro</span>
          </div>

          <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase leading-none font-sans">
            {selectedTable}
          </span>
        </div>

        {/* Viewport content */}
        <div className="flex-1 flex flex-col relative bg-slate-50 overflow-y-auto px-4 py-4 pb-24 w-full">
          {/* Inner Screens Switchboard */}
          
          {/* STEP 1: WELCOME SCREEN */}
          {customerScreen === 'welcome' && (
            <div className="max-w-md mx-auto w-full flex-grow flex flex-col justify-center py-8 animate-fade-in p-1 text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-md">
                <Utensils size={24} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1.5 select-none">
                <h3 className="text-base font-black text-slate-900 leading-none">Welcome to Dine-In</h3>
                <p className="text-[11px] text-slate-400 font-semibold max-w-xs mx-auto">
                  Browse our fresh delicacies and place your order directly.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4 text-left font-sans animate-slide-up">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 bg-slate-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 bg-slate-50 font-mono"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Diner Table</label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 bg-slate-50 cursor-pointer font-sans"
                  >
                    {['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    const cleanPhone = custPhone.replace(/\D/g, '');
                    if (!custName.trim() || cleanPhone.length < 10) {
                      onShowToast('⚠️ Please enter a valid name and 10-digit phone number!');
                      return;
                    }
                    localStorage.setItem('orderpoint_scango_name', custName.trim());
                    localStorage.setItem('orderpoint_scango_phone', cleanPhone);
                    setCustomerScreen('menu');
                    onShowToast(`🎉 Welcome to ${selectedTable}! Enjoy your meal!`);
                  }}
                  className="w-full h-11 bg-[#0F172A] hover:bg-black text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl cursor-pointer transition-colors border-none flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Enter Table Menu</span>
                  <ArrowRight size={12} className="stroke-[2.5]" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FOOD MENU CATALOG */}
          {customerScreen === 'menu' && (
            <div className="w-full max-w-6xl mx-auto flex-grow flex flex-col md:flex-row min-h-0 animate-fade-in text-left">
              
              {/* LEFT SIDEBAR (Desktop/Tablet) */}
              <aside className="hidden md:flex flex-col w-60 bg-white border border-slate-200 rounded-2xl p-5 shrink-0 select-none mr-6">
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2">Categories</span>
                  <nav className="space-y-1">
                    {[
                      { id: 'All', label: 'All Items', icon: '▦' },
                      { id: 'Veg', label: 'Veg', icon: '🌿' },
                      { id: 'Non-Veg', label: 'Non-Veg', icon: '🔴' },
                      { id: 'Drinks', label: 'Drinks', icon: '🥤' },
                      { id: 'Dessert', label: 'Dessert', icon: '🍰' },
                    ].map(cat => {
                      const isSel = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-3 ${
                            isSel 
                              ? 'bg-emerald-50 text-emerald-700 font-extrabold shadow-sm'
                              : 'bg-transparent text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-sm">{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Today's Special Card inside Sidebar */}
                <div className="mt-8 bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-md" />
                  <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider select-none leading-none">🔥 Today's Special</span>
                  <h5 className="font-extrabold text-[#0F172A] text-xs mt-2 select-none">Get 10% OFF</h5>
                  <p className="text-[9.5px] text-slate-500 font-semibold select-none leading-normal">On all self-service orders above ₹500 today!</p>
                  <button 
                    onClick={() => onShowToast("🎉 Coupon automatically applied on checkout!")}
                    className="w-full mt-3 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg cursor-pointer border-none shadow-5xs transition-all"
                  >
                    Order Now
                  </button>
                </div>
              </aside>

              {/* MAIN CONTENT AREA */}
              <div className="flex-grow flex flex-col min-w-0">
                
                {/* Search Bar / Header inside main area on Desktop */}
                <div className="hidden md:flex items-center justify-between gap-4 mb-6 select-none bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search for delicacies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-slate-50"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-slate-450 text-xs font-bold font-sans">
                      Active: <span className="text-slate-900 font-extrabold">{selectedTable}</span>
                    </span>
                  </div>
                </div>

                {/* Mobile Category Navigation (Horizontal scroller, hidden on Desktop) */}
                <div className="flex items-center gap-2 select-none w-full pb-1 md:hidden">
                  <button
                    onClick={() => setCustomerScreen('welcome')}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0 transition-colors font-bold text-xs"
                    title="Go back to welcome screen"
                  >
                    ←
                  </button>
                  <div className="flex gap-1.5 overflow-x-auto select-none scrollbar-none flex-1">
                    {['All', 'Veg', 'Non-Veg', 'Drinks', 'Dessert'].map(cat => {
                      const isSel = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider border cursor-pointer shrink-0 transition-all ${
                            isSel 
                              ? 'bg-emerald-600 border-emerald-600 text-white font-black shadow-xs' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Responsive grid for delicacies */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24 mt-4 md:mt-0">
                  {filteredMenuItems.length === 0 ? (
                    <div className="col-span-full text-center py-16 bg-white border border-slate-150 border-dashed rounded-2xl p-6 select-none">
                      <span className="text-xs text-slate-400 font-bold italic block">No delicacies match your filter.</span>
                      <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} className="text-[10px] font-black text-emerald-600 mt-2 hover:underline border-none bg-transparent cursor-pointer">
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    filteredMenuItems.map((item, index) => {
                      const qty = custCart[item.id]?.quantity || 0;
                      const dishImgUrl = item.imageUrl || getDishImage(item.name);
                      
                      return (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-2xl flex p-3.5 hover:border-emerald-200 hover:shadow-xs transition-all select-none relative group shadow-3xs text-left">
                          
                          {/* Top Tag or recommendation heuristics */}
                          {index % 3 === 0 && (
                            <span className="absolute top-2.5 left-2.5 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md z-10 shadow-5xs leading-none">
                              Bestseller
                            </span>
                          )}

                          {/* Left: Foodie photo */}
                          <div className="w-[85px] h-[85px] rounded-xl bg-slate-50 border border-slate-150 shrink-0 flex items-center justify-center relative overflow-hidden select-none shadow-5xs">
                            <img 
                              src={dishImgUrl} 
                              alt={item.name} 
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          {/* Right: details */}
                          <div className="flex-grow min-w-0 pl-4 flex flex-col justify-between">
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-extrabold text-slate-900 text-sm truncate leading-tight block">{item.name}</span>
                                  <div className="bg-white p-[1.5px] rounded-xs shadow-5xs border border-slate-200 flex shrink-0">
                                    <div className={`w-2.5 h-2.5 border-[1px] rounded-xs flex items-center justify-center ${
                                      item.category === 'Veg' || item.dotColor === '#10B981' ? 'border-green-600' : 'border-red-600'
                                    }`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${
                                        item.category === 'Veg' || item.dotColor === '#10B981' ? 'bg-green-600' : 'bg-red-600'
                                      }`} />
                                    </div>
                                  </div>
                                </div>

                                {/* Favorite Heart Icon */}
                                <button className="text-slate-350 hover:text-rose-500 cursor-pointer p-0 bg-transparent border-none shrink-0 flex items-center transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                </button>
                              </div>

                              <p className="text-[10px] text-slate-400 font-semibold line-clamp-1 leading-normal select-none pr-1">
                                {item.description || "Freshly cooked with premium local ingredients."}
                              </p>
                              <span className="text-xs font-black text-slate-900 block leading-none">₹{item.price}</span>
                            </div>

                            {/* Add to Cart Actions */}
                            <div className="flex justify-between items-center pt-2 select-none border-t border-slate-50 mt-1">
                              <span className="text-[8.5px] text-slate-450 uppercase font-black tracking-wider leading-none">
                                {item.isHalfFull ? 'Variants Half/Full' : 'Standard portion'}
                              </span>

                              <div className="flex items-center gap-1 select-none">
                                {item.isHalfFull ? (
                                  <div className="flex gap-1.5">
                                    {['HALF', 'FULL'].map(vSuffix => {
                                      const vId = `${item.id}-${vSuffix}`;
                                      const vQty = custCart[vId]?.quantity || 0;
                                      const vPrice = vSuffix === 'HALF' ? Math.round(item.price / 2) : item.price;
                                      return (
                                        <div key={vSuffix} className="flex flex-col items-center gap-0.5">
                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{vSuffix}: ₹{vPrice}</span>
                                          {vQty === 0 ? (
                                            <button
                                              onClick={() => {
                                                setCustCart(prev => ({
                                                  ...prev,
                                                  [vId]: { menuItem: { ...item, id: vId, price: vPrice }, quantity: 1 }
                                                }));
                                                onShowToast(`➕ Added ${item.name} (${vSuffix})!`);
                                              }}
                                              className="h-6.5 p-0.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[8px] font-black uppercase border-none cursor-pointer tracking-wider transition-colors shadow-5xs"
                                            >
                                              + Add
                                            </button>
                                          ) : (
                                            <div className="flex items-center bg-emerald-50 border border-emerald-150 rounded-lg h-6.5 select-none overflow-hidden">
                                              <button
                                                onClick={() => {
                                                  setCustCart(prev => {
                                                    const existing = prev[vId];
                                                    if (!existing) return prev;
                                                    if (existing.quantity <= 1) {
                                                      const copy = { ...prev };
                                                      delete copy[vId];
                                                      return copy;
                                                    }
                                                    return { ...prev, [vId]: { ...existing, quantity: existing.quantity - 1 } };
                                                  });
                                                }}
                                                className="w-4.5 h-full flex items-center justify-center bg-transparent border-none text-emerald-800 hover:bg-emerald-100 cursor-pointer font-black text-xs"
                                              >
                                                <Minus size={8} strokeWidth={3} />
                                              </button>
                                              <span className="px-0.5 text-[9px] font-black text-emerald-800 leading-none">{vQty}</span>
                                              <button
                                                onClick={() => {
                                                  setCustCart(prev => ({
                                                    ...prev,
                                                    [vId]: { ...prev[vId], quantity: prev[vId].quantity + 1 }
                                                  }));
                                                }}
                                                className="w-4.5 h-full flex items-center justify-center bg-transparent border-none text-emerald-800 hover:bg-emerald-100 cursor-pointer font-black text-xs"
                                              >
                                                <Plus size={8} strokeWidth={3} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  qty === 0 ? (
                                    <button
                                      onClick={() => {
                                        setCustCart(prev => ({
                                          ...prev,
                                          [item.id]: { menuItem: item, quantity: 1 }
                                        }));
                                        onShowToast(`➕ Added ${item.name} to checkout cart!`);
                                      }}
                                      className="h-7 p-0.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase border-none cursor-pointer tracking-wider flex items-center gap-0.5 shadow-5xs transition-colors"
                                    >
                                      <Plus size={10} className="stroke-[3]" />
                                      <span>Add</span>
                                    </button>
                                  ) : (
                                    <div className="flex items-center bg-emerald-50 border border-emerald-150 rounded-lg h-7 select-none overflow-hidden">
                                      <button
                                        onClick={() => {
                                          setCustCart(prev => {
                                            const existing = prev[item.id];
                                            if (!existing) return prev;
                                            if (existing.quantity <= 1) {
                                              const copy = { ...prev };
                                              delete copy[item.id];
                                              return copy;
                                            }
                                            return { ...prev, [item.id]: { ...existing, quantity: existing.quantity - 1 } };
                                          });
                                        }}
                                        className="w-6 h-full flex items-center justify-center bg-transparent border-none text-emerald-850 hover:bg-emerald-100 cursor-pointer font-black text-xs"
                                      >
                                        <Minus size={10} strokeWidth={3} />
                                      </button>
                                      <span className="px-1.5 text-[10px] font-black text-emerald-855 leading-none">{qty}</span>
                                      <button
                                        onClick={() => {
                                          setCustCart(prev => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], quantity: prev[item.id].quantity + 1 }
                                          }));
                                        }}
                                        className="w-6 h-full flex items-center justify-center bg-transparent border-none text-emerald-855 hover:bg-emerald-100 cursor-pointer font-black text-xs"
                                      >
                                        <Plus size={10} strokeWidth={3} />
                                      </button>
                                    </div>
                                  )
                                )}
                              </div>

                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Cart Summary Sticky Footer */}
                {itemsArray.length > 0 && (
                  <div className="fixed bottom-0 inset-x-0 bg-black border-t border-neutral-900 p-4 flex items-center justify-between z-40 max-w-lg mx-auto shadow-lg animate-slide-up rounded-t-3xl text-white">
                    <div className="text-left select-none pl-2">
                      <span className="text-[9px] uppercase font-black text-slate-400 block leading-none">Dine Cart ({itemsArray.length} items)</span>
                      <span className="text-[13px] font-black text-white leading-none block pt-1">₹{subtotal}</span>
                    </div>
                    <button
                      onClick={() => setCustomerScreen('cart')}
                      className="h-10.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl flex items-center gap-1 border-none cursor-pointer shadow-sm transition-all"
                    >
                      <span>View Cart &amp; Checkout</span>
                      <ArrowRight size={11} className="stroke-[2.5]" />
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* STEP 3: CART CHECKOUT DETAILS */}
          {customerScreen === 'cart' && (
            <div className="flex-1 flex flex-col space-y-4 animate-fade-in p-1 text-left">
              
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <button
                  onClick={() => setCustomerScreen('menu')}
                  className="flex items-center gap-1 text-indigo-650 hover:text-indigo-800 font-black text-[10px] uppercase bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span>← Edit Order</span>
                </button>
                <h4 className="text-xs font-black text-slate-900">Your Checkout Basket</h4>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {itemsArray.map(cartItem => (
                  <div key={cartItem.menuItem.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-none">
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs block">{cartItem.menuItem.name}</span>
                      <span className="text-[9.5px] text-slate-500 font-semibold">₹{cartItem.menuItem.price} × {cartItem.quantity}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900 font-mono">₹{cartItem.menuItem.price * cartItem.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Payment Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3.5 animate-slide-up">
                <div className="space-y-1.5">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block pl-0.5">Order Summary Details</span>
                  <div className="flex justify-between text-[9.5px] font-bold text-slate-600">
                    <span>Cart Subtotal</span>
                    <span className="font-mono">₹{subtotal}</span>
                  </div>
                  {activeCartGst > 0 && (
                    <div className="flex justify-between text-[9.5px] font-bold text-slate-600">
                      <span>Tax (5%)</span>
                      <span className="font-mono">₹{Math.round(subtotal * 0.05)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[9.5px] font-bold text-slate-600">
                    <span>Convenience Fee</span>
                    <span className="font-mono">₹10</span>
                  </div>
                  <div className="flex justify-between text-[11.5px] font-black text-slate-905 pt-1.5 border-t border-slate-100">
                    <span>Grand Total Due</span>
                    <span className="font-mono text-indigo-650">₹{calcTotal}</span>
                  </div>
                </div>

                {/* Checkout Channel selectors */}
                <div className="space-y-1.5 select-none pt-2 border-t border-slate-100">
                  <label className="text-[8px] uppercase font-black tracking-widest text-slate-400 block pl-0.5">Select payment channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('upi')}
                      className={`h-11 px-2 rounded-xl border flex flex-col justify-center items-center gap-0.5 select-none transition-all cursor-pointer relative ${
                        paymentMethod === 'upi'
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-extrabold shadow-5xs'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-1 leading-none">
                        <CreditCard size={11} className="stroke-[2]" />
                        <span className="text-[9.5px] font-black uppercase">Instant UPI</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('counter')}
                      className={`h-11 px-2 rounded-xl border flex flex-col justify-center items-center gap-0.5 select-none transition-all cursor-pointer relative ${
                        paymentMethod === 'counter'
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-extrabold shadow-5xs'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-1 leading-none">
                        <FileText size={11} className="stroke-[2]" />
                        <span className="text-[9.5px] font-black uppercase">Pay Later</span>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const newId = 'scan_' + Date.now();
                    const newNum = 'OP-' + Math.floor(1000 + Math.random() * 9000);
                    
                    if (paymentMethod === 'upi') {
                      setTempOrderId(newId);
                      setTempOrderNumber(newNum);
                      setIsPaymentModalOpen(true);
                    } else {
                      const newOrder: Order = {
                        id: newId,
                        orderNumber: newNum,
                        type: 'Dine-In',
                        tableNo: selectedTable,
                        items: itemsArray.map(itemObj => ({
                          menuItem: itemObj.menuItem,
                          quantity: itemObj.quantity
                        })),
                        status: 'New',
                        createdAt: new Date().toISOString(),
                        timestamp: Date.now(),
                        customerName: custName,
                        customerPhone: custPhone,
                        totalAmount: calcTotal,
                        isPaid: false,
                        isBilled: false,
                        paymentMethod: 'CASH',
                        paymentStatus: 'PENDING',
                        transactionId: ''
                      };

                      onAddOrder(newOrder).then(() => {
                        setCustCart({});
                        setActiveOrderTrackId(newId);
                        setCustomerScreen('tracking');
                        onShowToast(`🚀 Cash Order #${newNum} sent to Kitchen & Billing Desk!`);
                      });
                    }
                  }}
                  className="w-full h-10.5 bg-slate-950 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-sm"
                >
                  <Sparkles size={11} className="fill-white/10" />
                  <span>{paymentMethod === 'upi' ? `Pay Securely ₹${calcTotal}` : 'Place & Pay Counter'}</span>
                </button>
              </div>

            </div>
          )}

          {/* STEP 4: TRACKING ORDER STATUS */}
          {customerScreen === 'tracking' && (
            <div className="flex-1 flex flex-col space-y-4 animate-fade-in p-1 text-left">
              
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <button
                  onClick={() => setCustomerScreen('menu')}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-black text-[10px] uppercase bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span>← Back to Menu</span>
                </button>
                <h4 className="text-xs font-black text-slate-900">Order Tracker</h4>
                <button
                  onClick={() => setShowBillModal(true)}
                  className="flex items-center gap-1 bg-indigo-50 border border-indigo-150 text-indigo-700 font-black text-[9px] px-2.5 py-0.5 rounded-full cursor-pointer uppercase transition-colors"
                >
                  <Receipt size={10} />
                  <span>View Receipt</span>
                </button>
              </div>

              {/* Tracker Card */}
              <div className="bg-[#0F172A] text-white p-5 rounded-[24px] space-y-4 shadow-xl border border-white/5 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

                <div className="flex justify-between items-center pb-1 border-b border-slate-800 select-none">
                  <span className="text-[9px] uppercase font-black text-indigo-400">Order ID: {trackedOrder ? trackedOrder.orderNumber : 'OP-Initializing'}</span>
                  
                  {/* Token Number Badge */}
                  <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Token: #{trackedOrder ? (trackedOrder.orderNumber.replace(/\D/g, '') || trackedOrder.orderNumber) : '---'}
                  </span>

                  <span className="bg-indigo-650 text-white px-2.5 py-0.5 rounded text-[8px] font-bold uppercase block">
                    {trackedOrder ? trackedOrder.status : 'New'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-1 text-center select-none">
                  {['Received', 'Preparing', 'Ready', 'Served'].map((stage, idx) => {
                    const currentStageStr = trackedOrder ? trackedOrder.status : 'New';
                    const activeIndex = ['New', 'Preparing', 'Ready', 'Completed', 'Delivered'].indexOf(currentStageStr === 'Completed' || currentStageStr === 'Delivered' ? 'Delivered' : currentStageStr);
                    const isComp = idx <= (activeIndex >= 0 ? activeIndex : 0);
                    
                    return (
                      <div key={stage} className="space-y-1 flex flex-col items-center">
                        <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center font-black text-[9px] ${
                          isComp ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {isComp ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[8.5px] uppercase font-black tracking-tight ${
                          isComp ? 'text-slate-200' : 'text-slate-500'
                        }`}>{stage}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Share details or reorder */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-[20px] text-white space-y-3.5 text-center shadow-lg animate-slide-up">
                <div className="space-y-1 text-left">
                  <span className="text-[8px] uppercase tracking-wider text-indigo-355 text-indigo-305 font-black block">Live updates in real time</span>
                  <p className="text-[9.5px] text-slate-400 leading-relaxed font-semibold">
                    The kitchen has received your order and is currently cooking it. This dashboard will update live when the food is ready!
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2 select-none">
                  <button
                    onClick={() => {
                      setCustCart({});
                      setCustomerScreen('menu');
                      onShowToast(`Supplementary order track activated! Table ${selectedTable}.`);
                    }}
                    className="w-full h-9 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 border-none shadow-md"
                  >
                    <Plus size={10} className="stroke-[3]" />
                    <span>Order Additional Dishes</span>
                  </button>

                  <button
                    onClick={() => {
                      setCustCart({});
                      setCustomerScreen('welcome');
                      setActiveOrderTrackId('');
                      onShowToast('Closed dining session.');
                    }}
                    className="w-full text-center text-indigo-300 hover:text-white text-[9px] font-black uppercase py-1.5 bg-transparent border-none cursor-pointer"
                  >
                    Exit Dining Session
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* STANDALONE TAX INVOICE OVERLAY MODAL */}
        {showBillModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] animate-fade-in p-4">
            <div className="w-full max-w-md bg-white rounded-3xl max-h-[85vh] overflow-y-auto p-6 text-left shadow-2xl border border-slate-100">
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-[10px] font-black tracking-widest text-[#0F172A] uppercase flex items-center gap-1">
                  <Receipt size={14} className="text-indigo-600" />
                  <span>DINE-IN TAX INVOICE</span>
                </span>
                <button 
                  onClick={() => setShowBillModal(false)}
                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-950 flex items-center justify-center border-none cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              {/* INVOICE BILL BODY */}
              <div className="pt-4 space-y-4 font-sans text-xs">
                <div className="text-center pb-2.5 border-b border-slate-100 border-dashed">
                  <h4 className="font-extrabold text-[#0F172A] text-sm uppercase tracking-tight">OrderPoint Bistro</h4>
                  <p className="text-[8.5px] text-slate-400 font-medium leading-relaxed">
                    Fine Dining Sector, 4th Block, West Hub<br />
                    Reg No: OP-98214A
                  </p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-y-1.5 text-[9.5px] font-semibold text-slate-600">
                  <div><span className="text-slate-400">Order ID:</span> {trackedOrder ? trackedOrder.id : 'N/A'}</div>
                  <div className="text-right"><span className="text-slate-400">Token Number:</span> {trackedOrder ? (trackedOrder.orderNumber.replace(/\D/g, '') || trackedOrder.orderNumber) : 'N/A'}</div>
                  <div><span className="text-slate-400">Customer Name:</span> {trackedOrder?.customerName || custName || 'Guest'}</div>
                  <div className="text-right"><span className="text-slate-400">Phone Number:</span> +91 {trackedOrder?.customerPhone || custPhone}</div>
                  <div><span className="text-slate-400">Order Date/Time:</span> {trackedOrder ? new Date(trackedOrder.timestamp).toLocaleString() : new Date().toLocaleString()}</div>
                  <div className="text-right"><span className="text-slate-400">Table Number:</span> {selectedTable}</div>
                  <div><span className="text-slate-400">Payment Method:</span> {trackedOrder?.paymentMethod || 'N/A'}</div>
                  <div className="text-right">
                    <span className="text-slate-400">Payment Status:</span> <span className={`font-black ${trackedOrder?.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {trackedOrder?.isPaid ? 'PAID' : 'PAYMENT PENDING'}
                    </span>
                  </div>
                </div>

                {/* Items Summary list */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between font-black text-[9.5px] uppercase text-slate-400 border-b border-slate-50 pb-1 select-none">
                    <span>Delicacy Checked List</span>
                    <span>Total Amount</span>
                  </div>
                  {trackedOrder?.items?.map((logItem, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10.5px] font-semibold text-slate-755 py-1">
                      <div>
                        <span>{logItem.menuItem.name}</span>
                        <span className="text-[9px] text-slate-400 font-normal block">Qty: {logItem.quantity} × ₹{logItem.menuItem.price}</span>
                      </div>
                      <span className="font-mono text-slate-900 font-extrabold">₹{logItem.menuItem.price * logItem.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Net totals block */}
                <div className="pt-2 border-t border-slate-100 border-dashed space-y-1 text-right select-none font-sans text-[9.5px] font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal Net Due:</span>
                    <span className="font-mono">₹{trackedOrder ? trackedOrder.totalAmount - 10 : activeCartSubtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Convenience Settle:</span>
                    <span className="font-mono">₹10</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-slate-900 pt-1.5 border-t border-slate-100">
                    <span className="text-slate-800">Grand Net Settle Due:</span>
                    <span className="font-mono text-indigo-650 text-sm">₹{trackedOrder ? trackedOrder.totalAmount : calcTotal}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Standalone payment app mock popup */}
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirmPaid={async (appLabel, transactionId) => {
            const itemsArray = Object.entries(custCart).map(([itemId, cartItem]) => {
              const itemObj = cartItem as { menuItem: MenuItem; quantity: number };
              const baseId = itemId.split('-')[0];
              const liveItem = menuItems.find(it => it.id === baseId);
              
              let reconstructedItem = itemObj.menuItem;
              let size: string | undefined = undefined;
              let unitPrice = liveItem ? liveItem.price : itemObj.menuItem.price;

              const variantSuffix = itemId.replace(`${baseId}-`, '');
              if (variantSuffix === 'HALF') {
                size = 'Half';
                unitPrice = liveItem ? (liveItem.price / 2) : (itemObj.menuItem.price / 2);
                reconstructedItem = {
                  ...itemObj.menuItem,
                  id: itemId,
                  price: unitPrice,
                  isAvailable: true
                };
              } else if (variantSuffix === 'FULL') {
                size = 'Full';
                unitPrice = liveItem ? liveItem.price : itemObj.menuItem.price;
                reconstructedItem = {
                  ...itemObj.menuItem,
                  id: itemId,
                  price: unitPrice,
                  isAvailable: true
                };
              }

              return {
                menuItem: reconstructedItem,
                quantity: itemObj.quantity,
                productId: baseId,
                productName: liveItem ? liveItem.name : itemObj.menuItem.name,
                size,
                unitPrice,
                totalPrice: unitPrice * itemObj.quantity
              };
            });

            const matchId = tempOrderId || ('scan_' + Date.now());
            const matchNum = tempOrderNumber || ('OP-' + Math.floor(1000 + Math.random() * 9000));

            const newOrder: Order = {
              id: matchId,
              orderNumber: matchNum,
              type: 'Dine-In',
              tableNo: selectedTable,
              items: itemsArray,
              status: 'New',
              createdAt: new Date().toISOString(),
              timestamp: Date.now(),
              customerName: custName,
              customerPhone: custPhone,
              totalAmount: calcTotal,
              isPaid: true,
              isBilled: true,
              paymentMethod: 'UPI',
              paymentStatus: 'PAID',
              transactionId: transactionId || ''
            };

            await onAddOrder(newOrder);

            // Open WhatsApp Invoice directly to registered phone number!
            const cleanPhone = custPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
              const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
              const restName = "OrderPoint Bistro";
              const token = newOrder.orderNumber.replace(/\D/g, '') || newOrder.orderNumber;
              const restaurantId = localStorage.getItem('orderpoint_user_id') || auth.currentUser?.uid || 'default_restaurant';
              const feedbackLink = `${window.location.origin}/?feedback=${newOrder.orderNumber}&store=${restaurantId}`;
              const invoiceLink = `${window.location.origin}/?invoice=inv_${newOrder.id}&store=${restaurantId}`;
              
              const message = `Thank you for ordering from
*${restName}*

Order: #${newOrder.orderNumber}
Token: ${token}

Amount Paid: ₹${newOrder.totalAmount.toFixed(2)}
Payment Method: UPI
Payment Status: PAID

Your order has been sent to the kitchen.

⭐ Rate your experience:
${feedbackLink}

📄 Digital Invoice:
${invoiceLink}

Thank you!`;

              const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
              window.open(waUrl, '_blank');
            }

            // Reset cart & transition
            setCustCart({});
            setIsPaymentModalOpen(false);
            setActiveOrderTrackId(matchId);
            setCustomerScreen('tracking');
            onShowToast(`🚀 Payment confirmed! Order #${matchNum} dispatched straight to chef display!`);
          }}
          orderId={tempOrderId}
          orderNumber={tempOrderNumber}
          tableNo={selectedTable}
          customerName={custName}
          amount={calcTotal}
          paymentApp="UPI"
          onShowToast={onShowToast}
        />

      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[140] p-3 sm:p-4 overflow-y-auto animate-fade-in select-none font-sans cursor-pointer"
    >
      {/* High-visibility fixed close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed top-4 right-4 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-full shadow-2xl cursor-pointer transition-all z-[150] border-none flex items-center gap-1.5 text-xs font-black"
        title="Close mobile simulation"
      >
        <X size={14} className="stroke-[2.5]" />
        <span>Close Simulator</span>
      </button>
      
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl flex flex-col lg:flex-row items-center justify-center gap-5 select-none lg:p-1 shrink-0 scale-[0.88] xs:scale-90 sm:scale-95 md:scale-[0.98] lg:scale-[0.85] xl:scale-[0.92] 2xl:scale-100 origin-center my-auto cursor-default"
      >
        
        {/* Close floating button */}
        <button
          onClick={onClose}
          className="absolute -top-12 lg:-top-10 right-2 bg-slate-900 border border-white/10 hover:bg-black hover:border-white/20 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-2xl cursor-pointer transition-all z-50 text-[14px] font-black border-none"
          title="Close mobile simulation"
        >
          <X size={15} />
        </button>

        {/* A: THE STUNNING CELL PHONE EMULATOR */}
        <div className="flex flex-col items-center select-none">
          {/* Quick Table Switcher inside Emulator backdrop */}
          <div className="flex flex-wrap items-center justify-center gap-1 mb-2 bg-slate-900/80 p-1.5 px-3 rounded-xl border border-white/15 max-w-[325px]">
            <span className="text-[9px] font-black uppercase text-slate-400 mr-[4px]">Diner Table:</span>
            {['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06'].map(tNum => (
              <button
                key={tNum}
                onClick={() => {
                  setSelectedTable(tNum);
                  setCustomerScreen('welcome');
                  onShowToast(`Simulating scan of ${tNum}. Custom settings mapped.`);
                }}
                className={`px-2 py-0.5 rounded-lg text-[9px] font-black border cursor-pointer transition-all ${
                  selectedTable === tNum
                    ? 'bg-indigo-600 border-indigo-600 text-white font-black shadow-xs'
                    : 'bg-white/10 border-white/5 text-slate-300 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                {tNum.replace('Table ', '')}
              </button>
            ))}
          </div>

          {/* SMARTPHONE WRAPPER */}
          <div className="w-[325px] h-[605px] border-[10px] border-[#1D1E22] rounded-[40px] shadow-2xl relative overflow-hidden bg-white flex flex-col shrink-0">
            
            {/* PHONE SPEAKER/NOTCH MOCK */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-4 w-24 bg-[#1D1E22] rounded-b-2xl z-50 flex items-center justify-center">
              <div className="h-1 w-8 bg-gray-700 rounded-full" />
            </div>

            {/* STATUS BAR */}
            <div className="h-[24px] bg-slate-950 text-white text-[8px] px-5 flex justify-between items-center z-40 shrink-0 select-none font-bold">
              <span>18:16</span>
              <div className="flex items-center gap-1 font-bold">
                <span>5G</span>
                <span className="w-3.5 h-2 bg-white rounded-xs relative">
                  <span className="absolute top-[1px] right-0.5 bottom-[1px] left-0.5 bg-slate-950 rounded-xs" />
                </span>
              </div>
            </div>

            {/* BROWSER ADDRESS BAR */}
            <div className="mx-2.5 my-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-gray-400 text-[10px] shrink-0 font-medium z-10 select-none">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-green-600 text-[9px]">🔒</span>
                <span className="font-extrabold text-slate-800 text-[9px] truncate">
                  orderpointpro.in/scan/{selectedTable.toLowerCase().replace(/\s+/g, '-')}
                </span>
              </div>
              <button 
                onClick={() => {
                  setCustomerScreen('welcome');
                  onShowToast('Simulating brand welcome scan...');
                }}
                className="hover:text-indigo-600 text-gray-400 p-0.5 bg-transparent border-none cursor-pointer flex items-center"
                title="Refresh and navigate back to tablescan welcome page"
              >
                <RotateCcw size={10} />
              </button>
            </div>

            {/* SCREEN VIEWPORT CONTAINER */}
            <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50 relative scrollbar-none">
              
              {/* VIEWS SWITCHBOARD ROUTER */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                                {customerScreen === 'welcome' && (
                  <div className="flex-1 w-full flex flex-col justify-center space-y-4 py-1 animate-fade-in text-center p-1">
                    <div className="space-y-1">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto border border-indigo-100 flex-shrink-0">
                        <Utensils size={20} className="stroke-[2.5]" />
                      </div>
                      <span className="text-[8px] text-indigo-600 font-black uppercase tracking-widest block pt-0.5">Scan Confirmed</span>
                      <h1 className="text-lg font-black text-slate-950 tracking-tight leading-none">
                        OrderPoint Digital Dine
                      </h1>
                      <p className="text-[9.5px] text-slate-400 font-medium px-1 leading-relaxed">
                        Register checkout details to explore our live dishes and order! No app download needed.
                      </p>
                    </div>

                    <div className="bg-white border border-slate-150 rounded-xl p-3 shadow-xs text-left space-y-2.5">
                      <div className="space-y-0.5 focus-within:text-indigo-600">
                        <label className="text-[8.5px] uppercase font-black tracking-wider text-slate-400 block">Diner Full Name *</label>
                        <div className="relative">
                          <User className="absolute left-3 top-2 text-slate-400" size={13} />
                          <input
                            type="text"
                            value={custName}
                            onChange={(e) => setCustName(e.target.value)}
                            placeholder="Name: Mohammed Zaid"
                            className="w-full h-8 pl-8 pr-3.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 placeholder-slate-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[8.5px] uppercase font-black tracking-wider text-slate-400 block">WhatsApp Mobile Number *</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2 text-slate-400" size={13} />
                          <input
                            type="tel"
                            value={custPhone}
                            onChange={(e) => {
                              const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                              setCustPhone(numericVal);
                            }}
                            maxLength={10}
                            placeholder="WhatsApp Contact: 9876543210"
                            className="w-full h-8 pl-8 pr-3.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 placeholder-slate-400 font-mono"
                          />
                        </div>
                        {custPhone.length > 0 && (
                          <p className={`text-[8px] font-bold mt-0.5 ${custPhone.length === 10 && /^[6-9]/.test(custPhone) ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {custPhone.length < 10 
                              ? "Please enter a valid 10-digit mobile number." 
                              : (!/^[6-9]/.test(custPhone) 
                                ? "Mobile number must start with 6, 7, 8, or 9." 
                                : "✓ Valid WhatsApp mobile number")}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={handleProceedToMenu}
                        disabled={!custName.trim() || custPhone.length !== 10 || !/^[6-9]/.test(custPhone)}
                        className={`w-full h-8.5 text-[9.5px] font-black tracking-wider uppercase shadow-xs transition-all flex items-center justify-center gap-1.5 border-none rounded-lg ${
                          custName.trim() && custPhone.length === 10 && /^[6-9]/.test(custPhone)
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:scale-[1.01]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>Explore Digital Menu</span>
                        <ArrowRight size={11} className="stroke-[2.5]" />
                      </button>
                      
                      <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[8.5px] font-bold text-emerald-600 justify-center font-sans">
                        <ShieldCheck size={11.5} className="stroke-[2.5]" />
                        <span>Direct sync with {selectedTable}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3 — LIVE MENU */}
                {customerScreen === 'menu' && (
                  <div className="flex-1 flex flex-col space-y-3 animate-fade-in relative p-1 min-h-0 text-left">
                    
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 select-none">
                      <div>
                        <span className="text-[8px] uppercase tracking-widest font-black text-indigo-600">Tabletop digital Menu</span>
                        <h4 className="text-sm font-black text-slate-950 leading-none mt-0.5">Explore Our Specialties</h4>
                      </div>
                      
                      {/* CALL WAITER BELL BUTTON */}
                      <button
                        onClick={() => setShowWaiterDrawer(true)}
                        className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 p-1 px-2.5 rounded-full text-[9px] font-black uppercase cursor-pointer"
                        title="Buzzer call steward assistance"
                      >
                        <Bell size={10} className="text-amber-650 animate-bounce" />
                        <span>Call Waiter</span>
                      </button>
                    </div>

                    <div className="relative select-none">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search favorites (Biryani, Burger...)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 placeholder-slate-400 font-semibold"
                      />
                    </div>

                    {/* CATEGORY SELECTOR */}
                    <div className="flex flex-col gap-2 bg-white p-2 border border-slate-150 rounded-xl select-none shrink-0">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                        {['All', 'Veg', 'Non-Veg', 'Drinks', 'Desserts', 'Starters', 'Main Course'].map(cat => {
                          const isSel = selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-tight whitespace-nowrap border transition-all cursor-pointer ${
                                isSel 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-350'
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[9px] font-black text-slate-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-600 inline-block border border-white" />
                          Vegetarian Food Filter
                        </span>
                        <button
                          onClick={() => setVegOnly(!vegOnly)}
                          className={`w-7 h-4 rounded-full transition-colors relative flex items-center ${
                            vegOnly ? 'bg-green-650' : 'bg-slate-200'
                          } border-none cursor-pointer p-0`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${
                            vegOnly ? 'translate-x-3' : 'translate-x-[2px]'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* DISHES LIST */}
                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[225px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-200">
                      {filteredMenuItems.length === 0 ? (
                        <div className="text-center py-10 bg-white border border-slate-150 border-dashed rounded-xl p-4">
                          <span className="text-[10px] text-slate-400 font-bold italic block">No delicacies match filter.</span>
                          <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setVegOnly(false); }} className="text-[9px] font-black text-indigo-600 mt-2 hover:underline border-none bg-transparent cursor-pointer">
                            Clear Filters
                          </button>
                        </div>
                      ) : (
                        filteredMenuItems.map((item, index) => {
                          const qty = custCart[item.id]?.quantity || 0;
                          const dishImgUrl = item.imageUrl || getDishImage(item.name);
                          
                          // Custom best seller / chef recommended tag heuristics
                          const isPopular = index % 3 === 0 || item.price > 220;
                          const isRecommended = index % 4 === 1;

                          return (
                            <div key={item.id} className="bg-white border border-slate-155 rounded-2xl flex p-2.5 hover:border-indigo-200 transition-all select-none relative group">
                              {/* Left side: Premium Image Card */}
                              <div className="w-[75px] h-[75px] rounded-xl bg-slate-50 border border-slate-150 shrink-0 flex items-center justify-center relative overflow-hidden select-none child-loading shadow-5xs">
                                <img 
                                  src={dishImgUrl} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).onerror = null;
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      const fb = parent.querySelector('.fallback-placeholder-sim');
                                      if (fb) fb.classList.remove('hidden');
                                    }
                                  }}
                                />
                                <div className="fallback-placeholder-sim absolute inset-0 bg-slate-50 flex flex-col items-center justify-center text-center p-1 hidden">
                                  <Utensils size={14} className="text-slate-400 mb-0.5" />
                                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-wide">No Image</span>
                                </div>
                                
                                {/* Veg/Non-Veg indicator */}
                                <div className="absolute top-1 left-1 bg-white p-[2px] rounded-xs shadow-md border border-slate-200">
                                  <div className={`w-2.5 h-2.5 border-[1.5px] rounded-xs flex items-center justify-center ${
                                    item.category === 'Veg' || item.dotColor === '#10B981' ? 'border-green-600' : 'border-red-600'
                                  }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                      item.category === 'Veg' || item.dotColor === '#10B981' ? 'bg-green-600' : 'bg-red-600'
                                    }`} />
                                  </div>
                                </div>
                              </div>

                              {/* Right side: Detailed Description */}
                              <div className="flex-1 pl-3 min-w-0 flex flex-col justify-between">
                                <div className="space-y-0.5 text-left">
                                  <div className="flex items-start justify-between gap-1">
                                    <h4 className="text-[11.5px] font-bold text-slate-900 truncate leading-tight flex items-center gap-1.5">
                                      <span>{item.name}</span>
                                    </h4>
                                    <span className="text-[11px] font-black text-slate-950 font-mono">
                                      ₹{(item.price / 2).toFixed(0)}-₹{item.price}
                                    </span>
                                  </div>
                                  <p className="text-[9.5px] text-slate-400 font-medium line-clamp-2 leading-relaxed">{item.description}</p>
                                  
                                  {/* Dynamic badges */}
                                  <div className="flex flex-wrap gap-1 pt-0.5 select-none">
                                    {isPopular && (
                                      <span className="text-[7.5px] font-black bg-amber-50 border border-amber-200 text-amber-700 px-1.5 rounded flex items-center gap-0.5 uppercase tracking-wide">
                                        <Award size={8} />
                                        <span>Best Seller</span>
                                      </span>
                                    )}
                                    {isRecommended && (
                                      <span className="text-[7.5px] font-black bg-indigo-50 border border-indigo-150 text-indigo-700 px-1.5 rounded flex items-center gap-0.5 uppercase tracking-wide">
                                        <Zap size={8} />
                                        <span>Chef Pick</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="w-full mt-2 select-none" onClick={(e) => e.stopPropagation()}>
                                   {(() => {
                                     const qty = custCart[`${item.id}-FULL`]?.quantity || 0;
                                     const status = isDishStockAvailable(item, inventoryItems, 'Full', qty + 1);

                                     if (qty > 0) {
                                       return (
                                         <div className="flex items-center justify-between bg-green-600 text-white rounded-lg p-1 shadow-sm h-8">
                                           <button 
                                             onClick={() => handleUpdateQty(`${item.id}-FULL`, -1)} 
                                             className="w-6 h-6 bg-green-700 hover:bg-green-800 text-white rounded flex items-center justify-center font-bold text-xs select-none cursor-pointer border-none"
                                           >
                                             <Minus size={10} className="stroke-[3]" />
                                           </button>
                                           <span className="text-[11px] font-black font-mono w-6 text-center">{qty}</span>
                                           <button 
                                             onClick={() => handleUpdateQty(`${item.id}-FULL`, 1)} 
                                             className="w-6 h-6 bg-green-700 hover:bg-green-800 text-white rounded flex items-center justify-center font-bold text-xs select-none cursor-pointer border-none"
                                           >
                                             <Plus size={10} className="stroke-[3]" />
                                           </button>
                                         </div>
                                       );
                                     }

                                     return (
                                       <button
                                         onClick={() => {
                                           if (!status.available) {
                                             onShowToast(`⚠️ ${status.reason}`);
                                             return;
                                           }
                                           handleAddToCart(item, 'Full');
                                         }}
                                         disabled={!status.available}
                                         className={`w-full h-8 rounded-lg flex items-center justify-center gap-1 text-[10px] font-black uppercase transition-all select-none cursor-pointer border-none text-white ${
                                           status.available 
                                             ? 'bg-[#16A34A] hover:bg-[#15803D]' 
                                             : 'bg-rose-500 hover:bg-rose-600 opacity-60 cursor-not-allowed'
                                         }`}
                                       >
                                         {status.available && <Plus size={10} className="stroke-[3] shrink-0" />}
                                         <span>{status.available ? `ADD ₹${item.price}` : 'SOLD OUT'}</span>
                                       </button>
                                     );
                                   })()}
                                 </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* CART SUMMARY STICKY FLOATING WIDGET */}
                    <div className="pt-2 border-t border-slate-250 select-none">
                      {activeCartCount > 0 ? (
                        <button
                          onClick={() => setCustomerScreen('cart')}
                          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md p-1 px-3 flex items-center justify-between transition-all cursor-pointer border-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="bg-indigo-800 text-white text-[9.5px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                              {activeCartCount}
                            </span>
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-indigo-100">Review check &amp; pay</span>
                          </div>
                          <div className="flex items-center gap-1 font-black text-xs font-mono">
                            <span>₹{calcTotal}</span>
                            <ArrowRight size={12} className="stroke-[3] ml-0.5" />
                          </div>
                        </button>
                      ) : (
                        <div className="bg-slate-100 rounded-xl p-2 text-center text-[9px] text-slate-500 font-extrabold border border-slate-200/50">
                          🛒 Choose delicious items from live menu above
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* STEP 4 — CART VIEW */}
                {customerScreen === 'cart' && (
                  <div className="flex-1 flex flex-col space-y-3 animate-fade-in p-1 text-left">
                    
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 select-none">
                      <button onClick={() => setCustomerScreen('menu')} className="text-slate-500 hover:text-indigo-600 text-[10px] font-black uppercase flex items-center gap-0.5 border-none bg-transparent cursor-pointer">
                        ← Back Menu
                      </button>
                      <h4 className="text-xs font-black text-slate-900">Your Dine Basket</h4>
                      <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full">{selectedTable}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[195px] pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 text-left">
                      {cartItems.map(item => (
                        <div key={item.menuItem.id} className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-5xs select-none">
                          <div className="text-left flex-1 min-w-0">
                            <h4 className="text-[11px] font-black text-slate-950 leading-tight truncate max-w-[170px]">{item.productName || item.menuItem.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.size && (
                                <span className="inline-block text-[8px] font-black uppercase bg-indigo-50 border border-solid border-indigo-100 text-indigo-700 px-1 rounded">
                                  {item.size}
                                </span>
                              )}
                              <span className="text-[9.5px] font-semibold text-indigo-600 font-mono">₹{item.unitPrice || item.menuItem.price} each</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                              <button onClick={() => handleUpdateQty(item.menuItem.id, -1)} className="w-5 h-5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center font-bold text-xs select-none cursor-pointer border-none">
                                <Minus size={9} className="stroke-[3]" />
                              </button>
                              <span className="text-[10px] font-extrabold font-mono text-slate-800 w-4.5 text-center">{item.quantity}</span>
                              <button onClick={() => handleUpdateQty(item.menuItem.id, 1)} className="w-5 h-5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded flex items-center justify-center font-bold text-xs select-none cursor-pointer border-none">
                                <Plus size={9} className="stroke-[3]" />
                              </button>
                            </div>
                            <span className="text-[10.5px] font-black font-mono text-slate-850 w-11 text-right">
                              ₹{(item.unitPrice || item.menuItem.price) * item.quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* SUMMARY CHECKS TABLE */}
                    <div className="bg-white border border-slate-150 rounded-xl p-3 space-y-1 select-none text-left">
                      <div className="flex justify-between text-[9.5px] font-bold text-slate-500 pb-0.5 border-b border-slate-100 mb-1">
                        <span className="font-sans uppercase tracking-widest text-[8.5px]">Receipt Breakdown</span>
                        <span>{selectedTable}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px] font-bold text-slate-600">
                        <span>Items Subtotal</span>
                        <span className="font-mono">₹{activeCartSubtotal}</span>
                      </div>
                      {activeCartGst > 0 && (
                        <div className="flex justify-between text-[9.5px] font-bold text-slate-600">
                          <span>Tax (5%)</span>
                          <span className="font-mono">₹{activeCartGst}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[9.5px] font-bold text-slate-600">
                        <span>Convenience Fee</span>
                        <span className="font-mono">₹10</span>
                      </div>
                      <div className="flex justify-between text-[11.5px] font-black text-slate-900 pt-1.5 border-t border-slate-100">
                        <span>Grand Total Due</span>
                        <span className="font-mono text-indigo-600">₹{calcTotal}</span>
                      </div>
                    </div>

                    {/* CHANNELS */}
                    <div className="space-y-1 text-left select-none">
                      <label className="text-[8px] uppercase font-black tracking-widest text-slate-400 block pl-0.5">Select checkout channel</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPaymentMethod('upi')}
                          className={`h-11 px-2 rounded-xl border flex flex-col justify-center items-center gap-0.5 select-none transition-all cursor-pointer relative ${
                            paymentMethod === 'upi'
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-extrabold shadow-5xs'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-1 leading-none">
                            <CreditCard size={11} className="stroke-[2]" />
                            <span className="text-[9.5px] font-black uppercase">Instant UPI</span>
                          </div>
                          <span className="text-[8px] font-medium text-slate-400">Prepay at Table</span>
                        </button>

                        <button
                          onClick={() => setPaymentMethod('counter')}
                          className={`h-11 px-2 rounded-xl border flex flex-col justify-center items-center gap-0.5 select-none transition-all cursor-pointer relative ${
                            paymentMethod === 'counter'
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-extrabold shadow-5xs'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-1 leading-none">
                            <FileText size={11} className="stroke-[2]" />
                            <span className="text-[9.5px] font-black uppercase">Pay Later</span>
                          </div>
                          <span className="text-[8px] font-medium text-slate-400">Desk-Settle Check</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      className="w-full h-10 bg-slate-950 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-sm"
                    >
                      <Sparkles size={11} className="fill-white/10" />
                      <span>{paymentMethod === 'upi' ? `Pay Securely ₹${calcTotal}` : 'Place & Pay Counter'}</span>
                    </button>

                  </div>
                )}

                {/* STEP 6 & STEP 9 — TIMELINE */}
                {customerScreen === 'tracking' && (
                  <div className="flex-1 flex flex-col space-y-3 animate-fade-in p-1 text-left">
                    
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 select-none">
                      <h4 className="text-xs font-black text-slate-900">Live Dinner Tracker</h4>
                      
                      <button
                        onClick={() => setShowBillModal(true)}
                        className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-150 text-indigo-700 font-black text-[9px] px-2 py-0.5 rounded-full cursor-pointer uppercase"
                      >
                        <Receipt size={10} />
                        <span>View Digital Invoice</span>
                      </button>
                    </div>

                    {/* PREP TIMELINE CARD */}
                    <div className="bg-[#0F172A] text-white p-4 rounded-2xl flex flex-col gap-3 select-none text-left relative overflow-hidden shadow-xl border border-white/5">
                      <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

                      <div className="flex justify-between items-center pb-0.5 border-b border-slate-800">
                        <span className="text-[9px] uppercase font-black text-indigo-400">Kitchen Network Connected</span>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                          <span>MAPPED</span>
                        </div>
                      </div>

                      <div className="space-y-0.5 select-none pt-0.5">
                        <span className="text-[9.5px] text-slate-400 font-bold block leading-none">
                          Kitchen Order: {trackedOrder ? trackedOrder.orderNumber : 'OP-Initializing'}
                        </span>
                        <h3 className="text-xs font-black text-white mt-1 leading-none flex items-center gap-1.5">
                          <span>Status:</span>
                          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[8.5px] font-bold uppercase inline-block">
                            {trackedOrder ? trackedOrder.status : 'New'}
                          </span>
                        </h3>
                      </div>

                      {/* Timeline progress bar */}
                      <div className="grid grid-cols-4 gap-1 pt-2 relative select-none">
                        {['Received', 'Preparing', 'Ready', 'Served'].map((stage, idx) => {
                          const stages = ['New', 'Preparing', 'Ready', 'Completed', 'Delivered'];
                          const currentStageStr = trackedOrder ? trackedOrder.status : 'New';
                          const statusTranslationMap: Record<string, string> = {
                            'New': 'New',
                            'Preparing': 'Preparing',
                            'Ready': 'Ready',
                            'Completed': 'Delivered',
                            'Delivered': 'Delivered'
                          };
                          
                          const activeIndex = ['New', 'Preparing', 'Ready', 'Delivered'].indexOf(statusTranslationMap[currentStageStr] || 'New');
                          const isComp = idx <= activeIndex;
                          
                          return (
                            <div key={stage} className="space-y-1 flex flex-col items-center">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[8px] transition-all ${
                                isComp 
                                  ? 'bg-indigo-500 text-white font-black scale-105 shadow-sm shadow-indigo-400/50' 
                                  : 'bg-slate-800 text-slate-500'
                              }`}>
                                {isComp ? '✓' : idx + 1}
                              </div>
                              <span className={`text-[8.5px] uppercase font-black tracking-tight ${
                                isComp ? 'text-slate-200' : 'text-slate-500'
                              }`}>{stage}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl select-none text-left text-white space-y-3 shadow-lg">
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-wider text-indigo-300 font-black block">Live Simulation Tip</span>
                        <h4 className="text-[10px] font-black text-white leading-none">Kitchen updates are 100% Real Time!</h4>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed font-semibold">
                          Open <b className="text-white">"Kitchen"</b> tab in another device or window, advance order <b className="text-white">#{trackedOrder ? trackedOrder.orderNumber : 'OP-XXXX'}</b> status and watch this viewport change instantly!
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 space-y-2 select-none">
                        {/* REORDER / ADD MORE FOOD IN DINE-IN SYSTEM */}
                        <button
                          onClick={() => {
                            setCustCart({});
                            setCustomerScreen('menu');
                            onShowToast(`🔥 Reorder mode! Adding supplementary culinary checklist to Table ${selectedTable.replace(/^\D+/g, '')}. Previous order tracks simultaneously!`);
                          }}
                          className="w-full h-8.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 border-none font-sans shadow-md"
                        >
                          <Plus size={10} className="stroke-[3]" />
                          <span>Reorder Additional Dishes</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setCustCart({});
                            setCustomerScreen('welcome');
                            setActiveOrderTrackId('');
                            onShowToast('Session closed. Simulated next tabletop scan.');
                          }}
                          className="w-full text-center text-indigo-300 hover:text-white text-[9px] font-black uppercase py-0.5 bg-transparent border-none cursor-pointer"
                        >
                          Exit Dining Session
                        </button>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* LIVE BUTLER CALL DRAWER PANEL */}
            {showWaiterDrawer && (
              <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-[32px] border-t border-slate-200 shadow-2xl z-50 p-5 animate-slide-up text-left">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 select-none">
                  <div className="flex items-center gap-1.5 text-amber-750">
                    <Bell size={15} className="text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Butler Call Assistant ({selectedTable})
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowWaiterDrawer(false)}
                    className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center border-none cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>

                <div className="space-y-2.5 pt-3">
                  <p className="text-[9.5px] text-slate-400 font-semibold leading-relaxed">
                    Select a service requirement below. A buzzer will immediately alert our desk staff to attend tabletop!
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    {[
                      { icon: '💧', label: 'Bottle of Water' },
                      { icon: '🍽️', label: 'Extra Plates' },
                      { icon: '🧾', label: 'Bill Assistance' },
                      { icon: '🙋‍♂️', label: 'Service Help' },
                    ].map(srv => (
                      <button
                        key={srv.label}
                        onClick={() => handleCallWaiterAction(srv.label)}
                        className="bg-slate-5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl font-bold flex items-center gap-2 text-[10px] cursor-pointer transition-colors"
                      >
                        <span className="text-sm">{srv.icon}</span>
                        <span className="text-slate-800 font-black">{srv.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DIGITAL RECEIPT INVOICE MODAL BACKDROP (FOR PHONE SIM) */}
            {showBillModal && (
              <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-xs flex items-end z-50 animate-fade-in">
                <div className="w-full bg-white rounded-t-[32px] max-h-[92%] overflow-y-auto p-5 select-none text-left">
                  
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="text-[10px] font-black tracking-widest text-[#0F172A] uppercase flex items-center gap-1">
                      <Receipt size={14} className="text-indigo-600" />
                      <span>DINE-IN TAX INVOICE</span>
                    </span>
                    <button 
                      onClick={() => setShowBillModal(false)}
                      className="w-6 h-6 rounded-full bg-slate-150 hover:bg-slate-200 text-slate-500 hover:text-slate-950 flex items-center justify-center border-none cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* INVOICE BILL BODY */}
                  <div className="pt-4 space-y-4 font-sans text-xs">
                    
                    {/* Brand Banner */}
                    <div className="text-center pb-2.5 border-b border-slate-100 border-dashed">
                      <h4 className="font-extrabold text-[#0F172A] text-sm uppercase tracking-tight">
                        OrderPoint Bistro
                      </h4>
                      <p className="text-[8.5px] text-slate-400 font-medium leading-relaxed">
                        Fine Dining Sector, 4th Block, West Hub<br />
                        Reg No: OP-98214A
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-y-1.5 text-[9.5px] font-semibold text-slate-600">
                      <div>
                        <span className="text-slate-400">Order ID:</span> {trackedOrder ? trackedOrder.id : 'N/A'}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">Token Number:</span> {trackedOrder ? (trackedOrder.orderNumber.replace(/\D/g, '') || trackedOrder.orderNumber) : 'N/A'}
                      </div>
                      <div>
                        <span className="text-slate-400">Customer Name:</span> {trackedOrder?.customerName || custName || 'Guest'}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">Phone Number:</span> +91 {trackedOrder?.customerPhone || custPhone}
                      </div>
                      <div>
                        <span className="text-slate-400">Order Date/Time:</span> {trackedOrder ? new Date(trackedOrder.timestamp).toLocaleString() : new Date().toLocaleString()}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">Table Number:</span> {selectedTable}
                      </div>
                      <div>
                        <span className="text-slate-400">Payment Method:</span> {trackedOrder?.paymentMethod || 'N/A'}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">Payment Status:</span> <span className={`font-black ${trackedOrder?.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {trackedOrder?.isPaid ? 'PAID' : 'PAYMENT PENDING'}
                        </span>
                      </div>
                      {trackedOrder?.paymentAt && (
                        <div className="col-span-2 pt-0.5">
                          <span className="text-slate-400">Payment Date/Time:</span> {new Date(trackedOrder.paymentAt).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Items Lists */}
                    <div className="pt-2 border-t border-slate-200">
                      <table className="w-full text-[9.5px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[8px]">
                            <th className="text-left py-1 text-slate-400">Delicacy Description</th>
                            <th className="text-center py-1">Qty</th>
                            <th className="text-right py-1">Price</th>
                            <th className="text-right py-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(trackedOrder ? trackedOrder.items : cartItems).map((line, ix) => (
                            <tr key={ix} className="border-b border-slate-50">
                              <td className="py-1.5 font-bold text-slate-800">{line.menuItem.name}</td>
                              <td className="text-center font-bold text-slate-500">{line.quantity}</td>
                              <td className="text-right font-mono">₹{line.menuItem.price}</td>
                              <td className="text-right font-mono font-bold">₹{line.menuItem.price * line.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals Check */}
                    <div className="bg-slate-50 p-2.5 rounded-xl space-y-1 font-semibold text-[9.5px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Dishes Subtotal:</span>
                        <span className="font-mono">
                          ₹{trackedOrder ? Math.round(trackedOrder.totalAmount - 10) : activeCartSubtotal}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Convenience Surcharge:</span>
                        <span className="font-mono">₹10</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-black text-slate-900 border-t border-slate-200 pt-1.5">
                        <span>Rounding Total Bill Value:</span>
                        <span className="font-mono font-black text-indigo-750">
                          ₹{trackedOrder ? trackedOrder.totalAmount : calcTotal}
                        </span>
                      </div>
                    </div>

                    <div className="relative text-center select-none py-1.5">
                      <div className={`border rounded-xl inline-block px-5 py-1.5 font-sans font-black tracking-widest text-[9.5px] uppercase mx-auto select-none rotate-[-2deg] shadow-3xs border-dashed ${
                        trackedOrder?.isPaid 
                          ? 'border-emerald-200/55 text-emerald-700 bg-emerald-50' 
                          : 'border-amber-200/55 text-amber-700 bg-amber-50 animate-pulse'
                      }`}>
                        {trackedOrder?.isPaid 
                          ? `✓ ${trackedOrder.paymentMethod === 'CASH' ? 'CASH' : 'UPI'} PAID` 
                          : `${trackedOrder?.paymentMethod === 'CASH' ? '🟠 CASH PAYMENT PENDING' : 'PAY ON SETTLEMENT'}`}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 select-none pt-1">
                      <button 
                        onClick={() => {
                          onShowToast('📥 Invoice receipt PDF compiled & saved!');
                        }}
                        className="h-8 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 cursor-pointer border-none"
                      >
                        <Download size={10} />
                        <span>Download PDF</span>
                      </button>
                      <button 
                        onClick={() => {
                          onShowToast('🖨️ Directing receipt to table-top thermal slip printer...');
                        }}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 cursor-pointer border-none"
                      >
                        <FileText size={10} />
                        <span>Print Receipt</span>
                      </button>
                    </div>
                    {trackedOrder?.isPaid && (
                      <button 
                        onClick={() => {
                          const cleanPhone = custPhone.replace(/\D/g, '');
                          if (cleanPhone.length >= 10) {
                            const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                            const orderNum = trackedOrder ? trackedOrder.orderNumber : 'OP-XXXX';
                            const invoiceNo = trackedOrder?.invoiceNumber || `INV-${orderNum}-TEMP`;
                            const token = orderNum.replace(/\D/g, '') || orderNum;
                            const amount = trackedOrder ? trackedOrder.totalAmount : activeCartTotal;
                            const payMethodLabel = trackedOrder?.paymentMethod === 'CASH' ? 'Cash' : 'UPI';
                            
                            const message = `Thank you for your order!

Order ID: ${invoiceNo}
Token: ${token}
Amount Paid: ₹${amount}
Payment Method: ${payMethodLabel}
Payment Status: PAID

${payMethodLabel === 'Cash' ? 'Your payment has been received successfully.' : 'Your order has been sent to the kitchen.'}

Thank you for choosing us!`;
                            
                            const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                            window.open(waUrl, '_blank');
                            onShowToast('📲 Receipt shared on WhatsApp!');
                          } else {
                            onShowToast('⚠️ Please enter a 10-digit phone number first!');
                          }
                        }}
                        className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 cursor-pointer border-none mt-2 transition-colors"
                      >
                        <Send size={10} />
                        <span>Share Receipt on WhatsApp</span>
                      </button>
                    )}

                  </div>

                </div>
              </div>
            )}

          </div>
        </div>

        {/* B: SIMULATED WHATSAPP RECEIVER BAR */}
        <div className="hidden lg:flex flex-col bg-[#0F172A] border border-white/10 p-4 rounded-[32px] w-[325px] h-[605px] shadow-xl justify-between shrink-0 select-none">
          
          <div className="space-y-4 select-none flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <span className="text-[9.5px] font-black text-slate-300 uppercase tracking-widest font-sans">
                  WhatsApp Alerts Node (+91 {custPhone})
                </span>
              </div>
              <Phone size={13} className="text-slate-400 stroke-2" />
            </div>

            <div className="text-[10px] text-slate-400 leading-normal bg-slate-900/65 p-3 rounded-2xl border border-white/5 text-left font-medium">
              Simulates live notification dispatch transmitted automatically to the customer’s WhatsApp containing official receipt copies, invoices, and table food alerts in real-time.
            </div>

            <div className="overflow-y-auto pr-1 flex-1 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
              {whatsappLogs.length === 0 ? (
                <div className="text-center py-16 bg-slate-905 bg-slate-900/40 border border-slate-850 rounded-2xl my-auto select-none">
                  <span className="text-3xl block filter saturate-50 pb-1.5">💬</span>
                  <span className="text-[10.5px] text-slate-400 font-extrabold block">No broadcasts logged yet.</span>
                  <p className="text-[9px] text-slate-500 px-4 mt-2 leading-relaxed font-semibold">
                    Simulate your guest details and click 'Checkout' or UPI Prepay inside the virtual phone on the left to trigger automatic message dispatches!
                  </p>
                </div>
              ) : (
                whatsappLogs.map(log => (
                  <div key={log.id} className="bg-[#DCF8C6]/90 border border-[#b2dca9] text-[#1E3A1A] p-3.5 rounded-2xl text-left text-xs space-y-2.5 shadow-md relative group animate-fade-in">
                    <div className="flex justify-between items-center border-b border-[#c2e8b9] pb-1 select-none">
                      <span className="font-extrabold uppercase text-[8.5px] text-green-800 tracking-wider">
                        {log.title}
                      </span>
                      <span className="text-[8px] text-green-700 font-mono font-bold">{log.timestamp}</span>
                    </div>

                    <div className="whitespace-pre-wrap leading-relaxed text-[10px] text-slate-850 font-medium font-sans">
                      {renderMessageWithLinks(log.message)}
                    </div>

                    {log.attachments && log.attachments.length > 0 && (
                      <div className="pt-2 border-t border-[#c5e6bc] space-y-1">
                        <span className="text-[8px] uppercase tracking-wider text-green-800 font-black block">
                          Included Auto-Attachments:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {log.attachments.map((file, i) => (
                            <span key={i} className="bg-white border border-green-200/55 p-1 px-1.5 rounded-md text-[8.5px] font-black text-slate-700 flex items-center gap-1 shadow-5xs">
                              <FileText size={9} className="text-red-600" />
                              <span className="truncate max-w-[120px]">{file}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 justify-end text-[8.5px] font-bold text-green-750 select-none text-green-700">
                      <span>✓ ✓ Sent via Cloud Relay API</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-800 text-center select-none font-black text-[9px] uppercase text-slate-500 tracking-wider leading-none">
            OrderPoint Pro Broadcast Server Node
          </div>

        </div>

      </div>
    </div>
  );
}
