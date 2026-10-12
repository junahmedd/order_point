import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AlertTriangle, LayoutDashboard, ShoppingCart, ChefHat, Receipt, Layers } from 'lucide-react';
import Sidebar, { SidebarTab } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Orders from './components/Orders';
import Kitchen from './components/Kitchen';
import Billing from './components/Billing';
import MenuCatalog from './components/MenuCatalog';
import Inventory from './components/Inventory';
import Staff from './components/Staff';
import Customers from './components/Customers';
import Reports from './components/Reports';
import ScanGo from './components/ScanGo';
import SettingsView from './components/Settings';
import SuperAdmin from './components/SuperAdmin';
import toast from 'react-hot-toast';
import Login from './components/Login';
import CustomerFeedbackPage from './components/CustomerFeedbackPage';
import LiveInvoiceViewer from './components/LiveInvoiceViewer';
import FeedbackDashboard from './components/FeedbackDashboard';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, doc, query, where, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Store, ArrowRight, RefreshCw } from 'lucide-react';
import DinerSimulator from './components/DinerSimulator';
import { calculateStoreId } from './components/Login';

import { useLiveAppData } from './hooks/useLiveAppData';
import { useSettings } from './hooks/useSettings';
import { Order, MenuItem, InventoryItem, StaffMember, Customer } from './types';
import { INITIAL_MENU_ITEMS } from './data';

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('Dashboard');
  const [settingsSection, setSettingsSection] = useState<'profile' | 'billing' | 'payment' | 'tables' | 'qr' | 'system'>('profile');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [feedbackInvoice, setFeedbackInvoice] = useState<string | null>(null);
  const [feedbackStoreId, setFeedbackStoreId] = useState<string | null>(null);
  const [invoiceIdParam, setInvoiceIdParam] = useState<string | null>(null);
  const [invoiceStoreId, setInvoiceStoreId] = useState<string | null>(null);

  const [isScanMode, setIsScanMode] = useState<boolean>(false);
  const [scanTable, setScanTable] = useState<string>('Table 05');

  const [userStores, setUserStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [isCreatingNewStore, setIsCreatingNewStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');

  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      setUserStores([]);
      setShowStoreSelector(false);
      return;
    }

    const fetchStores = async () => {
      setStoresLoading(true);
      try {
        const emailClean = currentUser.email!.toLowerCase().trim();
        const q = query(collection(db, 'stores'), where('ownerEmail', '==', emailClean));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => doc.data());
        setUserStores(list);

        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.exists() ? userDocSnap.data() : null;
        const activeId = userData?.restaurantId;

        if (list.length === 0) {
          const defaultName = userData?.restaurantName || userData?.businessName || 'My Bistro';
          const defaultStoreId = calculateStoreId(emailClean, defaultName);

          await setDoc(doc(db, 'stores', defaultStoreId), {
            storeId: defaultStoreId,
            ownerEmail: emailClean,
            ownerId: currentUser.uid,
            storeName: defaultName,
            storeNameNormalized: defaultName.trim().toLowerCase(),
            createdAt: Date.now()
          });

          const settingsDocRef = doc(db, 'settings', defaultStoreId);
          const settingsSnap = await getDoc(settingsDocRef);
          if (!settingsSnap.exists()) {
            const oldSettingsRef = doc(db, 'settings', currentUser.uid);
            const oldSnap = await getDoc(oldSettingsRef);
            if (oldSnap.exists()) {
              await setDoc(settingsDocRef, oldSnap.data());
            } else {
              await setDoc(settingsDocRef, {
                restaurantInfo: {
                  name: defaultName,
                  owner: userData?.fullName || 'Owner',
                  phone: userData?.phone || '',
                  email: emailClean,
                  address: '',
                  regNumber: ''
                },
                branding: { logoUrl: '', faviconUrl: '' },
                gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
                payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
                whatsapp: { number: '', businessName: defaultName, autoSendBills: false },
                qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
                notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
                security: { adminName: userData?.fullName || 'Owner', twoFactor: false, sessionTimeout: '30m' },
                preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
            }
          }

          await updateDoc(userDocRef, { restaurantId: defaultStoreId }).catch(() => {});
          setUserStores([{ storeId: defaultStoreId, storeName: defaultName }]);
          setShowStoreSelector(false);
        } else if (list.length === 1) {
          if (activeId !== list[0].storeId) {
            await updateDoc(userDocRef, { restaurantId: list[0].storeId }).catch(() => {});
          }
          setShowStoreSelector(false);
        } else {
          const activeExists = list.some(s => s.storeId === activeId);
          const sessionSelected = sessionStorage.getItem('orderpoint_session_store_selected') === 'true';
          if (!activeId || !activeExists || !sessionSelected) {
            setShowStoreSelector(true);
          } else {
            setShowStoreSelector(false);
          }
        }
      } catch (err) {
        console.error('Error loading stores:', err);
      } finally {
        setStoresLoading(false);
      }
    };

    fetchStores();
  }, [currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fbInv = params.get('feedback');
    const fbStore = params.get('store');
    if (fbInv && fbStore) {
      setFeedbackInvoice(fbInv);
      setFeedbackStoreId(fbStore);
    }

    const invId = params.get('invoice');
    const invStore = params.get('store');
    if (invId && invStore) {
      setInvoiceIdParam(invId);
      setInvoiceStoreId(invStore);
    }

    const isScan = params.get('scan') === 'true';
    const table = params.get('table');
    if (isScan) {
      setIsScanMode(true);
      if (table) {
        setScanTable(table);
      }
    }
  }, []);

  const handleLoginSuccess = React.useCallback((user: FirebaseUser) => {
    setCurrentUser(user);
  }, []);

  // PWA & Network Status States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [appIsStandalone, setAppIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setAppIsStandalone(!!isStandaloneMode);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🌐 Connection restored! Back online.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('📶 Connection lost. Operating in offline shell mode.', { duration: 5000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('orderpoint_pwa_dismissed');
      if (!dismissed && !isStandaloneMode) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    setShowInstallPrompt(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Installation outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

  const handleDismissPwaPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('orderpoint_pwa_dismissed', 'true');
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const {
    loading: dbLoading,
    restaurantId,
    userRole,
    orders, addOrder, updateOrder,
    menuItems, addMenuItem, updateMenuItem, deleteMenuItem,
    inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem,
    staffMembers, addStaffMember, updateStaffMember,
    customers, addCustomer, updateCustomer, deleteCustomer,
    selfOrders, addSelfOrder, deleteSelfOrder,
    addBillingRecord, addPaymentRecord, addInvoiceRecord,
    stockTransactions, addStockTransaction
  } = useLiveAppData();

  const { data: settingsData, loading: settingsLoading } = useSettings();

  const loading = dbLoading || settingsLoading;

  const handleShowToast = (msg: string) => {
    toast.success(msg);
  };

  const handleMarkOrderPaid = async (
    orderId: string,
    paymentMethod: string,
    details?: { 
      discount?: number; 
      invoiceNo?: string; 
      customerPhone?: string; 
      customerName?: string; 
      customerEmail?: string; 
      pdfDataUri?: string;
      transactionId?: string;
    }
  ) => {
    // Find active order first
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const discount = details?.discount || 0;
    const finalPhone = details?.customerPhone || order.customerPhone || '';
    const finalName = details?.customerName || order.customerName || 'Walk-in Customer';
    const finalEmail = details?.customerEmail || '';

    // Generate Invoice Number if not passed
    let invoiceNo = details?.invoiceNo;
    if (!invoiceNo) {
      let hash = 0;
      for (let i = 0; i < order.id.length; i++) {
        hash = (hash * 31 + order.id.charCodeAt(i)) & 0xffff;
      }
      const suffix = (hash % 1000).toString().padStart(3, '0');
      invoiceNo = `INV-${order.orderNumber}-${suffix}`;
    }

    const formattedMethod = paymentMethod.toUpperCase();

    // 1. Mark order paid and billed in the live database with all customer details and pdf
    await updateOrder(orderId, { 
      isPaid: true, 
      isBilled: true, 
      status: 'Completed',
      paymentMethod: formattedMethod,
      payment_method: formattedMethod,
      invoiceNumber: invoiceNo,
      customerPhone: finalPhone,
      customerName: finalName,
      customerEmail: finalEmail,
      pdfDataUri: details?.pdfDataUri || '',
      paymentStatus: 'PAID',
      payment_status: 'PAID',
      transaction_type: 'offline',
      transactionId: details?.transactionId || '',
      paymentAt: new Date().toISOString(),
      paymentTimestamp: Date.now(),
      confirmedBy: auth.currentUser?.displayName || 'Admin'
    });

    // 2. Automatically find and synchronize or record customer metrics
    if (finalPhone && finalName) {
      const phoneClean = finalPhone.trim();
      const nameClean = finalName.trim();
      
      const existingCust = customers.find(c => c.phone.trim() === phoneClean);
      if (existingCust) {
        await updateCustomer(existingCust.id, {
          visits: existingCust.visits + 1,
          totalSpend: existingCust.totalSpend + Math.max(0, (order.totalAmount || 0) - discount),
          lastVisit: new Date().toISOString()
        });
      } else {
        await addCustomer({
          id: 'c_' + Date.now(),
          name: nameClean,
          phone: phoneClean,
          visits: 1,
          totalSpend: Math.max(0, (order.totalAmount || 0) - discount),
          lastVisit: new Date().toISOString()
        });
      }
    }

    // 3. Generate Tax Settings
    const gstPercentage = settingsData?.gstTax?.gstRate !== undefined ? settingsData.gstTax.gstRate : 5;
    const taxEnabled = settingsData?.gstTax?.taxEnabled !== undefined ? settingsData.gstTax.taxEnabled : true;
    const gstRate = taxEnabled ? (gstPercentage / 100) : 0;

    const totalAmount = order.totalAmount;
    const subtotal = Math.round(totalAmount / (1 + gstRate));
    const gst = totalAmount - subtotal;

    // 4. Save billing record
    const billingId = 'bill_' + order.id;
    await addBillingRecord({
      id: billingId,
      orderId: order.id,
      invoiceNo,
      subtotal,
      gst,
      discount,
      total: Math.max(0, totalAmount - discount),
      timestamp: Date.now()
    });

    // 5. Save payment transaction
    const paymentId = 'pay_' + order.id;
    await addPaymentRecord({
      id: paymentId,
      orderId: order.id,
      amount: Math.max(0, totalAmount - discount),
      method: paymentMethod,
      status: 'Confirmed',
      timestamp: Date.now()
    });

    // 6. Save invoice metadata for future retrieval
    const invoiceId = 'inv_' + order.id;
    await addInvoiceRecord({
      id: invoiceId,
      orderId: order.id,
      invoiceNo,
      customerName: finalName,
      customerPhone: finalPhone,
      customerEmail: finalEmail,
      pdfDataUri: details?.pdfDataUri || '',
      tableNo: order.tableNo || 'Takeaway',
      items: order.items,
      subtotal,
      gst,
      discount,
      total: Math.max(0, totalAmount - discount),
      paymentMethod,
      timestamp: Date.now()
    });

    toast.success(`Payment & Invoice processed securely for OP-${order.orderNumber}`);
  };

  const generateOrderId = () => `o${Date.now()}`;
  const generateOrderNumber = () => `OP-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleAddNewOrder = async (ord: Order) => {
    // 1. Add order to firestore using the live hooks
    await addOrder(ord);

    // 2. Save/Update Customer instantly
    if (ord.customerPhone) {
      const phoneClean = ord.customerPhone.trim();
      const nameClean = ord.customerName || `Guest (${phoneClean})`;
      const existingCust = customers.find(c => c.phone.trim() === phoneClean);
      if (existingCust) {
        await updateCustomer(existingCust.id, {
          visits: existingCust.visits + 1,
          lastVisit: new Date().toISOString()
        });
      } else {
        await addCustomer({
          id: 'c_' + Date.now(),
          name: nameClean,
          phone: phoneClean,
          visits: 1,
          totalSpend: 0,
          lastVisit: new Date().toISOString()
        });
      }
    }

    // 3. Create billing record placeholder in database immediately
    const billingId = 'bill_' + ord.id;
    await addBillingRecord({
      id: billingId,
      orderId: ord.id,
      invoiceNo: 'OPEN',
      subtotal: ord.totalAmount,
      gst: 0,
      discount: 0,
      total: ord.totalAmount,
      timestamp: Date.now(),
      isPaid: false
    });

    // 4. Reduce stock based on ingredients dynamically
    for (const item of ord.items) {
      const qtyOrdered = item.quantity;
      const isHalf = item.size === 'Half';
      const sizeMultiplier = isHalf ? 0.5 : 1.0;

      let recipe = item.menuItem.recipe;
      if (!recipe || recipe.length === 0) {
        // Fallback to seeds mapping
        const seedItem = INITIAL_MENU_ITEMS.find(m => m.id === item.menuItem.id || m.name.toLowerCase() === item.menuItem.name.toLowerCase());
        if (seedItem && seedItem.recipe) {
          recipe = seedItem.recipe;
        }
      }

      if (recipe && Array.isArray(recipe)) {
        for (const rec of recipe) {
          const invItem = inventoryItems.find(i => i.id === rec.inventoryItemId);
          if (invItem) {
            const amountToReduce = parseFloat((rec.amount * sizeMultiplier * qtyOrdered).toFixed(2));
            const newQty = Math.max(0, parseFloat((invItem.quantity - amountToReduce).toFixed(2)));
            let newStatus: 'NORMAL' | 'LOW STOCK' | 'OUT OF STOCK' = 'NORMAL';
            if (newQty === 0) {
              newStatus = 'OUT OF STOCK';
            } else if (newQty <= invItem.lowLimit) {
              newStatus = 'LOW STOCK';
            }

            await updateInventoryItem(invItem.id, {
              quantity: newQty,
              status: newStatus
            });

            // Log stock out transaction
            await addStockTransaction({
              id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              itemId: invItem.id,
              itemName: invItem.name,
              type: 'OUT',
              quantity: amountToReduce,
              prevQuantity: invItem.quantity,
              newQuantity: newQty,
              reason: `Order #${ord.orderNumber} placed (${item.menuItem.name} ${item.size || 'Full'} x${qtyOrdered})`,
              timestamp: Date.now()
            });

            if (newStatus === 'LOW STOCK' || newStatus === 'OUT OF STOCK') {
              toast.error(`⚠️ Low Stock Alert: ${invItem.name} has only ${newQty} ${invItem.unit} remaining!`, {
                duration: 6000,
                icon: '⚠️'
              });
            }
          }
        }
      }
    }
  };

  const subInfo = settingsData?.subscription || {
    subscription_status: 'active',
    subscription_plan: 'pro',
    plan_name: 'Pro',
    subscription_price: 1499,
    subscription_start: Date.now() - 2 * 24 * 60 * 60 * 1000,
    subscription_end: Date.now() + 28 * 24 * 60 * 60 * 1000,
    payment_status: 'paid',
    payment_method: 'Razorpay',
    transaction_id: 'sub_init_active',
  };
  const currentSubPlan = subInfo.subscription_plan || 'pro';
  const isSubExpired = subInfo.subscription_end ? Date.now() > subInfo.subscription_end : false;

  const handleUpgradeToSettings = () => {
    setActiveTab('Subscription');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-emerald-600">
          <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin" />
          <p className="font-medium text-gray-500">Syncing with Live Database...</p>
        </div>
      );
    }
    
    switch (activeTab) {
      case 'Dashboard':
        return <Dashboard orders={orders} menuItems={menuItems} inventoryItems={inventoryItems} onNavigateToTab={setActiveTab} restaurantName={settingsData.restaurantInfo.name} settings={settingsData as any} />;
      case 'Orders':
        return <Orders menuItems={menuItems} inventoryItems={inventoryItems} orders={orders} onNavigateToTab={setActiveTab} onAddOrderToKitchen={async (orderPartial: any) => { 
          const ord: Order = {
            id: generateOrderId(),
            orderNumber: generateOrderNumber(),
            status: 'New',
            createdAt: new Date().toISOString(),
            timestamp: Date.now(),
            totalAmount: orderPartial.items.reduce((sum: number, item: any) => sum + (item.menuItem.price * item.quantity), 0),
            isPaid: false,
            isBilled: false,
            orderStatus: 'New',
            kitchenStatus: 'Pending',
            billingStatus: 'Pending',
            paymentStatus: 'Unpaid',
            preparedAt: 0,
            servedAt: 0,
            preparedBy: '',
            servedBy: '',
            ...orderPartial
          };
          await handleAddNewOrder(ord); 
          toast.success('Order Sent to Kitchen!'); 
        }} onShowToast={handleShowToast} settings={settingsData as any} />;
      case 'Kitchen':
        return <Kitchen orders={orders} onNavigateToTab={setActiveTab} onUpdateOrderStatus={async (id, status, updates = {}) => {
          let extraUpdates: any = {};
          if (status === 'Preparing') {
            extraUpdates = {
              orderStatus: 'Preparing',
              kitchenStatus: 'Preparing',
            };
          } else if (status === 'Ready') {
            extraUpdates = {
              orderStatus: 'Ready',
              kitchenStatus: 'Prepared',
              preparedAt: Date.now(),
              preparedBy: 'Arjun Kumar',
              billingStatus: 'Ready for Billing',
            };
          } else if (status === 'Completed' || status === 'Delivered') {
            extraUpdates = {
              orderStatus: 'Completed',
              kitchenStatus: 'Served',
              servedAt: Date.now(),
              servedBy: 'Rahul Verma',
              billingStatus: 'Ready for Billing',
            };
          } else {
            extraUpdates = {
              orderStatus: status,
            };
          }
          await updateOrder(id, { status, ...extraUpdates, ...updates });
        }} onShowToast={handleShowToast} />;
      case 'Billing':
        return <Billing orders={orders} menuItems={menuItems} onNavigateToTab={setActiveTab} onMarkOrderPaid={handleMarkOrderPaid} onSendWhatsAppBill={() => {}} onShowToast={handleShowToast} settings={settingsData as any} />;
      case 'Menu':
        return <MenuCatalog menuItems={menuItems} onNavigateToTab={setActiveTab} onAddMenuItem={addMenuItem} onUpdateMenuItem={async (item: MenuItem) => await updateMenuItem(item.id, item)} onDeleteMenuItem={deleteMenuItem} onShowToast={handleShowToast} settings={settingsData as any} />;
      case 'Inventory':
        return (
          <Inventory 
            inventoryItems={inventoryItems} 
            stockTransactions={stockTransactions}
            onAddStockTransaction={addStockTransaction}
            onNavigateToTab={setActiveTab} 
            onAddInventoryItem={addInventoryItem} 
            onUpdateInventoryItem={async (item: InventoryItem) => await updateInventoryItem(item.id, item)} 
            onDeleteInventoryItem={deleteInventoryItem} 
            onShowToast={handleShowToast} 
            subscriptionPlan="pro" 
            isExpired={false} 
          />
        );
      case 'Staff':
        return <Staff staffMembers={staffMembers} onNavigateToTab={setActiveTab} onAddStaff={addStaffMember} onUpdateStaff={async (item: StaffMember) => await updateStaffMember(item.id, item)} onShowToast={handleShowToast} subscriptionPlan="pro" isExpired={false} />;
      case 'Customers':
        return <Customers customers={customers} onNavigateToTab={setActiveTab} onAddCustomer={addCustomer} onDeleteCustomer={deleteCustomer} onShowToast={handleShowToast} />;
      case 'Reports':
        return <Reports orders={orders} inventoryItems={inventoryItems} onNavigateToTab={setActiveTab} subscriptionPlan="pro" isExpired={false} />;
      case 'ScanGo':
        return (
          <ScanGo
            restaurantId={restaurantId || 'demo_store'}
            menuItems={menuItems}
            inventoryItems={inventoryItems}
            activeSelfOrders={selfOrders}
            orders={orders}
            onAddOrder={async (newOrder) => {
              await addOrder(newOrder);
            }}
            onPlaceSelfOrder={async (customerName, phone, tableNo, items) => {
              const total = items.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
              const newSelfOrder = {
                id: 'so_' + Date.now(),
                tableNumber: tableNo,
                tableNo: tableNo,
                sessionActive: true,
                joinedAt: new Date().toISOString(),
                orders: [],
                itemsCart: items,
                items: items,
                customerName,
                customerPhone: phone,
                total
              };
              await addSelfOrder(newSelfOrder);
              toast.success(`Success! Self-order placed for ${tableNo}`);
            }}
            onApproveSelfOrder={async (id) => {
              const target = selfOrders.find(so => so.id === id);
              if (target) {
                const ord = {
                  id: generateOrderId(),
                  orderNumber: generateOrderNumber(),
                  type: 'Dine-In' as const,
                  tableNo: target.tableNo || target.tableNumber || 'Table 1',
                  items: target.items,
                  status: 'New' as const,
                  createdAt: new Date().toISOString(),
                  timestamp: Date.now(),
                  totalAmount: target.total || 0,
                  customerName: target.customerName,
                  customerPhone: target.customerPhone,
                  isPaid: false,
                  isBilled: false,
                  orderStatus: 'New',
                  kitchenStatus: 'Pending',
                  billingStatus: 'Pending',
                  paymentStatus: 'Unpaid',
                  preparedAt: 0,
                  servedAt: 0,
                  preparedBy: '',
                  servedBy: '',
                };
                await handleAddNewOrder(ord);
                await deleteSelfOrder(id);
                toast.success(`Self-order approved for ${target.customerName}`);
              }
            }}
            onDeclineSelfOrder={async (id) => {
              await deleteSelfOrder(id);
              toast.success('Self-order declined.');
            }}
            onShowToast={handleShowToast}
          />
        );
      case 'Settings':
        return (
          <SettingsView 
            orders={orders} 
            menuItems={menuItems} 
            onAddOrderToKitchen={async (newOrder) => { await handleAddNewOrder(newOrder); }} 
            onShowToast={handleShowToast} 
            activeSection={settingsSection}
            onSectionChange={setSettingsSection}
            onGoToDashboard={() => setActiveTab('Dashboard')}
            onNavigateToTab={setActiveTab}
          />
        );
      case 'Feedback':
        return <FeedbackDashboard />;
      case 'SuperAdmin':
        return <SuperAdmin onShowToast={handleShowToast} onNavigateToTab={setActiveTab} />;
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <h2 className="text-xl font-bold text-gray-500">{activeTab} section coming soon</h2>
          </div>
        );
    }
  };

  if (feedbackInvoice && feedbackStoreId) {
    return (
      <>
        <Toaster position="top-right" />
        <CustomerFeedbackPage invoiceNo={feedbackInvoice} restaurantId={feedbackStoreId} />
      </>
    );
  }

  if (invoiceIdParam && invoiceStoreId) {
    return (
      <>
        <Toaster position="top-right" />
        <LiveInvoiceViewer invoiceId={invoiceIdParam} restaurantId={invoiceStoreId} />
      </>
    );
  }

  if (isScanMode) {
    return (
      <>
        <Toaster position="top-right" />
        <DinerSimulator
          selectedTable={scanTable}
          setSelectedTable={setScanTable}
          menuItems={menuItems}
          inventoryItems={inventoryItems}
          orders={orders}
          onAddOrder={addOrder}
          onPlaceSelfOrder={async (customerName, phone, tableNo, items) => {
            const total = items.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
            const newSelfOrder = {
              id: 'so_' + Date.now(),
              tableNumber: tableNo,
              tableNo: tableNo,
              sessionActive: true,
              joinedAt: new Date().toISOString(),
              orders: [],
              itemsCart: items,
              items: items,
              customerName,
              customerPhone: phone,
              total
            };
            await addSelfOrder(newSelfOrder);
            toast.success(`Success! Self-order placed for ${tableNo}`);
          }}
          onShowToast={handleShowToast}
          isOpen={true}
          onClose={() => {}}
          isStandalone={true}
        />
      </>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#020B1D] via-[#06183B] to-[#010814] flex flex-col items-center justify-center font-sans relative overflow-hidden text-white">
        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          {/* Beautiful Inline SVG Logo */}
          <div className="w-24 h-24 drop-shadow-2xl animate-[pulse_2s_infinite_ease-in-out]">
            <svg viewBox="0 0 512 512" width="100%" height="100%">
              <defs>
                <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor:'#2563EB',stopOpacity:1}} />
                  <stop offset="100%" style={{stopColor:'#1D4ED8',stopOpacity:1}} />
                </linearGradient>
              </defs>
              <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#splashGrad)" />
              <path d="M160 300 C160 210, 352 210, 352 300 Z" fill="#FFFFFF" />
              <circle cx="256" cy="180" r="18" fill="#FFFFFF" />
              <rect x="251" y="196" width="10" height="12" rx="4" fill="#FFFFFF" />
              <path d="M128 316 L384 316 C396 316, 400 324, 384 328 L128 328 C112 324, 116 316, 128 316 Z" fill="#FFFFFF" />
              <rect x="112" y="324" width="288" height="8" rx="4" fill="#FFFFFF" opacity="0.9" />
              <path d="M220 285 L245 310 L300 250" stroke="#1D4ED8" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white leading-none">OrderPoint Pro</h2>
            <p className="text-blue-300 text-[10px] font-black tracking-widest uppercase font-mono">POS &amp; Restaurant OS</p>
          </div>
          <div className="w-24 h-1.5 bg-blue-950/80 rounded-full overflow-hidden relative shadow-inner border border-blue-500/20">
            <div className="absolute inset-y-0 bg-blue-400 rounded-full animate-[loading_1.5s_infinite_ease-in-out]" />
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes loading {
            0% { left: -100%; right: 100%; }
            50% { left: 0; right: 0; }
            100% { left: 100%; right: -100%; }
          }
        `}} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Toaster position="top-right" />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  if (showStoreSelector) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
        <Toaster position="top-right" />
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
              <Store size={24} />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Select Restaurant</h1>
            <p className="text-xs text-slate-400">Choose which outlet you want to manage today.</p>
          </div>

          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {userStores.map((store) => (
              <button
                key={store.storeId}
                onClick={async () => {
                  const userDocRef = doc(db, 'users', currentUser.uid);
                  await updateDoc(userDocRef, { restaurantId: store.storeId }).catch(() => {});
                  sessionStorage.setItem('orderpoint_session_store_selected', 'true');
                  setShowStoreSelector(false);
                  toast.success(`Switched to ${store.storeName}`);
                }}
                className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 p-4 rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-between group"
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold group-hover:text-emerald-400 transition-colors">{store.storeName}</span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-tight pt-0.5">{store.storeId}</span>
                </div>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
          </div>

          {!isCreatingNewStore ? (
            <button
              onClick={() => setIsCreatingNewStore(true)}
              className="w-full py-3 border border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl text-xs font-bold text-slate-400 hover:text-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer bg-transparent"
            >
              <span>+ Create New Store</span>
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newStoreName.trim()) {
                  toast.error('Store Name is required');
                  return;
                }
                setStoresLoading(true);
                try {
                  const storeId = calculateStoreId(currentUser.email!, newStoreName);

                  const exists = userStores.some(s => s.storeNameNormalized === newStoreName.trim().toLowerCase() || s.storeId === storeId);
                  if (exists) {
                    toast.error('A store with this name already exists under your account!');
                    setStoresLoading(false);
                    return;
                  }

                  const storeDocRef = doc(db, 'stores', storeId);
                  const storeDocSnap = await getDoc(storeDocRef);
                  if (storeDocSnap.exists()) {
                    toast.error('A store with this name already exists under your account!');
                    setStoresLoading(false);
                    return;
                  }

                  await setDoc(storeDocRef, {
                    storeId,
                    ownerEmail: currentUser.email!.toLowerCase().trim(),
                    ownerId: currentUser.uid,
                    storeName: newStoreName.trim(),
                    storeNameNormalized: newStoreName.trim().toLowerCase(),
                    createdAt: Date.now()
                  });

                  const settingsDocRef = doc(db, 'settings', storeId);
                  await setDoc(settingsDocRef, {
                    restaurantInfo: {
                      name: newStoreName.trim(),
                      owner: currentUser.displayName || 'Owner',
                      phone: '',
                      email: currentUser.email!,
                      address: '',
                      regNumber: ''
                    },
                    branding: { logoUrl: '', faviconUrl: '' },
                    gstTax: { gstNumber: '', gstRate: 0, taxEnabled: false },
                    payment: { cash: true, upi: true, creditCard: true, debitCard: false, wallet: false, upiId: '', merchantName: '' },
                    whatsapp: { number: '', businessName: newStoreName.trim(), autoSendBills: false },
                    qrOrdering: { enabled: true, perTable: true, selfOrdering: true },
                    notifications: { newOrder: true, payment: true, kitchenReady: true, lowStock: true, dailySummary: true },
                    security: { adminName: currentUser.displayName || 'Owner', twoFactor: false, sessionTimeout: '30m' },
                    preferences: { darkMode: false, compactMode: false, autoPrint: false, autoRefresh: true, currency: 'INR' },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  });

                  const userDocRef = doc(db, 'users', currentUser.uid);
                  await updateDoc(userDocRef, { restaurantId: storeId }).catch(() => {});

                  const newStoreItem = {
                    storeId,
                    ownerEmail: currentUser.email!.toLowerCase().trim(),
                    ownerId: currentUser.uid,
                    storeName: newStoreName.trim(),
                    storeNameNormalized: newStoreName.trim().toLowerCase()
                  };
                  setUserStores([...userStores, newStoreItem]);
                  sessionStorage.setItem('orderpoint_session_store_selected', 'true');
                  setShowStoreSelector(false);
                  setIsCreatingNewStore(false);
                  setNewStoreName('');
                  toast.success(`Store "${newStoreName}" created successfully!`);
                } catch (err: any) {
                  console.error('Error creating new store:', err);
                  toast.error(err.message || 'Failed to create new store. Please try again.');
                } finally {
                  setStoresLoading(false);
                }
              }}
              className="space-y-3 pt-2"
            >
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Store / Business Name</label>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="e.g. My Bistro, XYZ Cafe"
                  className="w-full h-11 px-4 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-all font-sans"
                  required
                  disabled={storesLoading}
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewStore(false);
                    setNewStoreName('');
                  }}
                  className="flex-1 py-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer bg-transparent"
                  disabled={storesLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none flex items-center justify-center"
                  disabled={storesLoading}
                >
                  {storesLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Create Store'}
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 text-center">
            <button
              onClick={async () => {
                sessionStorage.removeItem('orderpoint_session_store_selected');
                await auth.signOut();
                toast.success('Logged out successfully');
              }}
              className="text-xs font-bold text-rose-500 hover:underline bg-transparent border-none cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans overflow-hidden">
      <Toaster position="top-right" />
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        adminName={currentUser?.displayName || 'Admin'}
        onLogout={async () => {
          localStorage.removeItem('backend_session_token');
          sessionStorage.removeItem('orderpoint_session_store_selected');
          await auth.signOut();
          toast.success('Signed out securely!');
        }}
        isOpenOnMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        restaurantName={!settingsLoading && settingsData?.restaurantInfo?.name ? settingsData.restaurantInfo.name : 'OrderPoint Pro'}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        settingsSection={settingsSection}
        onSettingsSectionChange={setSettingsSection}
        subscription={subInfo}
        userRole={userRole}
        userEmail={currentUser?.email}
        stores={userStores.map(s => ({ id: s.storeId, name: s.storeName }))}
        activeStoreId={restaurantId}
        onSwitchStore={async (id) => {
          if (!currentUser) return;
          const userDocRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userDocRef, { restaurantId: id }).catch(() => {});
          toast.success('Outlet switched successfully!');
        }}
      />

      <main className="flex-1 min-w-0 relative h-screen overflow-hidden flex flex-col bg-[#020B1D] text-slate-100">
        {/* Offline Banner Indicator */}
        {!isOnline && (
          <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 shadow-md shrink-0 border-b border-amber-700 font-sans z-30 animate-pulse text-xs font-bold">
            <span>📶 You're offline — Some features may be unavailable until your connection returns.</span>
          </div>
        )}

        {/* PWA Install Banner */}
        {showInstallPrompt && (
          <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-gray-100 rounded-2xl p-4 shadow-xl z-55 flex flex-col gap-3 font-sans animate-fade-in">
            <div className="flex gap-3 items-start">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                {/* SVG Logo */}
                <svg viewBox="0 0 512 512" className="w-9 h-9">
                  <defs>
                    <linearGradient id="promptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:'#8B5CF6',stopOpacity:1}} />
                      <stop offset="100%" style={{stopColor:'#6D28D9',stopOpacity:1}} />
                    </linearGradient>
                  </defs>
                  <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#promptGrad)" />
                  <path d="M160 300 C160 210, 352 210, 352 300 Z" fill="#FFFFFF" />
                  <circle cx="256" cy="180" r="18" fill="#FFFFFF" />
                  <rect x="251" y="196" width="10" height="12" rx="4" fill="#FFFFFF" />
                  <path d="M128 316 L384 316 C396 316, 400 324, 384 328 L128 328 C112 324, 116 316, 128 316 Z" fill="#FFFFFF" />
                  <rect x="112" y="324" width="288" height="8" rx="4" fill="#FFFFFF" opacity="0.9" />
                  <path d="M220 285 L245 310 L300 250" stroke="#10B981" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="text-sm font-bold text-gray-900 leading-none">Install OrderPoint Pro</h4>
                <p className="text-[11px] text-gray-400 font-semibold leading-normal">Get a faster, standalone app-like experience on your device.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={handleDismissPwaPrompt}
                className="px-3 h-8 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border-none cursor-pointer bg-transparent"
              >
                Not Now
              </button>
              <button 
                onClick={handleInstallPwa}
                className="px-3 h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors border-none cursor-pointer shadow-sm"
              >
                Install App
              </button>
            </div>
          </div>
        )}

        {/* Mobile Header (Deep Dark Blue with Sapphire Accents & iOS/Android Notch Support) */}
        <div className="lg:hidden flex items-center justify-between bg-[#030B1C] border-b border-blue-950/70 px-4 py-2.5 sticky top-0 z-30 shadow-md shrink-0 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 -ml-1 rounded-xl text-blue-200 hover:text-white hover:bg-blue-900/30 active:scale-95 flex items-center justify-center focus:outline-none bg-transparent border-none cursor-pointer transition-all"
            aria-label="Open Navigation Menu"
          >
            {/* SVG Menu Icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-300">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="flex flex-col items-center">
            <div className="font-black text-[14px] tracking-tight text-white leading-none mb-1 mt-0.5">ORDERPOINT PRO</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black text-blue-200 bg-blue-500/20 border border-blue-400/20 px-1.5 py-0.5 rounded leading-none uppercase tracking-widest">POS SYSTEM</span>
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider leading-none truncate max-w-[150px]">{!settingsLoading && settingsData?.restaurantInfo?.name ? settingsData.restaurantInfo.name : ''}</span>
            </div>
          </div>
          <div className="w-8 flex justify-end">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 animate-pulse" title="System Live" />
          </div>
        </div>

        <div className={`w-full relative flex-1 h-full min-w-0 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0 ${activeTab === 'Settings' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {renderContent()}
        </div>

        {/* Mobile Bottom Navigation Bar (Deep Dark Blue Theme with Safe-Area Inset for iOS Home Bar & Android Nav) */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[#030B1C]/95 backdrop-blur-md border-t border-blue-950/80 z-30 shadow-[0_-4px_25px_rgba(2,11,29,0.8)] select-none pb-[env(safe-area-inset-bottom,0px)]">
          <div className="h-16 flex items-center justify-around px-1">
            {[
              { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'Orders', label: 'POS Order', icon: ShoppingCart },
              { id: 'Kitchen', label: 'Kitchen', icon: ChefHat },
              { id: 'Billing', label: 'Billing', icon: Receipt },
              { id: 'more', label: 'More', icon: Layers }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = tab.id === 'more' ? isSidebarOpen : activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'more') {
                      setIsSidebarOpen(true);
                    } else {
                      setActiveTab(tab.id as SidebarTab);
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-1 flex-1 h-full bg-transparent border-none cursor-pointer transition-all active:scale-95 touch-manipulation ${
                    isActive ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-blue-200'
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30' : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
