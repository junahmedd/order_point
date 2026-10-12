import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Order, MenuItem, InventoryItem, StaffMember, Customer, ActiveSelfOrder, StockTransaction } from '../types';
import { INITIAL_MENU_ITEMS, INITIAL_INVENTORY_ITEMS, INITIAL_STAFF_MEMBERS, INITIAL_CUSTOMERS, INITIAL_ORDERS } from '../data';
import toast from 'react-hot-toast';

function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function cleanUndefined<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as any;
  }
  if (isPlainObject(obj)) {
    const result: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        result[key] = cleanUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

export function useLiveAppData() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selfOrders, setSelfOrders] = useState<ActiveSelfOrder[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);

  useEffect(() => {
    let unsubUserSnap: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (unsubUserSnap) {
        unsubUserSnap();
        unsubUserSnap = null;
      }

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubUserSnap = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const rId = userData.restaurantId || user.uid;
            setUserId(rId);
            setUserRole(userData.role || 'admin');
            localStorage.setItem('orderpoint_user_id', rId);
            localStorage.setItem('orderpoint_user_role', userData.role || 'admin');
          } else {
            setUserId(user.uid);
            setUserRole('admin');
            localStorage.setItem('orderpoint_user_id', user.uid);
            localStorage.setItem('orderpoint_user_role', 'admin');
          }
        }, (dbErr) => {
          console.warn('Error listening to user profile changes:', dbErr);
          setUserId(user.uid);
          setUserRole('admin');
          localStorage.setItem('orderpoint_user_id', user.uid);
          localStorage.setItem('orderpoint_user_role', 'admin');
        });
      } else {
        const params = new URLSearchParams(window.location.search);
        const urlRestaurantId = params.get('restaurantId') || params.get('store');
        if (urlRestaurantId) {
          setUserId(urlRestaurantId);
          setUserRole('guest');
          localStorage.setItem('orderpoint_user_id', urlRestaurantId);
          localStorage.setItem('orderpoint_user_role', 'guest');
        } else {
          try {
            const anonUser = await signInAnonymously(auth);
            setUserId(anonUser.user.uid);
            setUserRole('guest');
            localStorage.setItem('orderpoint_user_id', anonUser.user.uid);
            localStorage.setItem('orderpoint_user_role', 'guest');
          } catch (err) {
            console.info('Anonymous sign in notice:', err);
            const cached = localStorage.getItem('orderpoint_user_id') || 'default_restaurant';
            setUserId(cached);
            setUserRole(localStorage.getItem('orderpoint_user_role') || 'guest');
          }
        }
      }
    });

    return () => {
      unsub();
      if (unsubUserSnap) unsubUserSnap();
    };
  }, []);

  const activeUserId = userId || localStorage.getItem('orderpoint_user_id') || 'default_restaurant';

  useEffect(() => {
    if (!activeUserId) return;
    const currentRestId = activeUserId;

    const runSeederIfEmpty = async () => {
       const menuRef = collection(db, `restaurants/${currentRestId}/menuItems`);
       try {
         const snap = await getDocs(menuRef);
         if(snap.empty) {
            console.log("Seeding initial live database data...");
            // Seed Menu
            for (const item of INITIAL_MENU_ITEMS) {
              await setDoc(doc(db, `restaurants/${currentRestId}/menuItems`, item.id), cleanUndefined(item));
            }
            // Seed Inventory
            for (const item of INITIAL_INVENTORY_ITEMS) {
              await setDoc(doc(db, `restaurants/${currentRestId}/inventoryItems`, item.id), cleanUndefined(item));
            }
            // Seed Staff
            for (const item of INITIAL_STAFF_MEMBERS) {
              await setDoc(doc(db, `restaurants/${currentRestId}/staffMembers`, item.id), cleanUndefined(item));
            }
            // Seed Customers
            for (const item of INITIAL_CUSTOMERS) {
              await setDoc(doc(db, `restaurants/${currentRestId}/customers`, item.id), cleanUndefined(item));
            }
            // Seed Orders
            for (const item of INITIAL_ORDERS) {
              await setDoc(doc(db, `restaurants/${currentRestId}/orders`, item.id), cleanUndefined(item));
            }
         }
       } catch (error) {
         console.warn('Seeder notice:', error);
       }
    };

    runSeederIfEmpty();

    const ordersPath = `restaurants/${currentRestId}/orders`;
    const ordersQuery = query(collection(db, ordersPath), orderBy('timestamp', 'desc'));
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => doc.data() as Order));
    }, (error) => {
      console.warn('Firestore orders listener warning:', error);
    });

    const menuPath = `restaurants/${currentRestId}/menuItems`;
    const unsubMenu = onSnapshot(collection(db, menuPath), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => doc.data() as MenuItem));
    }, (error) => {
      console.warn('Firestore menu listener warning:', error);
    });

    const inventoryPath = `restaurants/${currentRestId}/inventoryItems`;
    const unsubInventory = onSnapshot(collection(db, inventoryPath), (snapshot) => {
      setInventoryItems(snapshot.docs.map(doc => doc.data() as InventoryItem));
    }, (error) => {
      console.warn('Firestore inventory listener warning:', error);
    });

    const staffPath = `restaurants/${currentRestId}/staffMembers`;
    const unsubStaff = onSnapshot(collection(db, staffPath), (snapshot) => {
      setStaffMembers(snapshot.docs.map(doc => doc.data() as StaffMember));
    }, (error) => {
      console.warn('Firestore staff listener warning:', error);
    });

    const customersPath = `restaurants/${currentRestId}/customers`;
    const unsubCustomers = onSnapshot(collection(db, customersPath), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => doc.data() as Customer));
      setLoading(false);
    }, (error) => {
      setLoading(false);
      console.warn('Firestore customers listener warning:', error);
    });

    const selfOrdersPath = `restaurants/${currentRestId}/selfOrders`;
    const unsubSelfOrders = onSnapshot(collection(db, selfOrdersPath), (snapshot) => {
      setSelfOrders(snapshot.docs.map(doc => doc.data() as ActiveSelfOrder));
    }, (error) => {
      setLoading(false);
      console.warn('Firestore selfOrders listener warning:', error);
    });

    const txPath = `restaurants/${currentRestId}/inventoryTransactions`;
    const txQuery = query(collection(db, txPath), orderBy('timestamp', 'desc'));
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      setStockTransactions(snapshot.docs.map(doc => doc.data() as StockTransaction));
    }, (error) => {
      console.warn('Firestore transactions listener warning:', error);
    });

    return () => {
      unsubOrders();
      unsubMenu();
      unsubInventory();
      unsubStaff();
      unsubCustomers();
      unsubSelfOrders();
      unsubTx();
    };
  }, [activeUserId]);

  // Operations
  const addOrder = async (order: Order) => {
    if (!activeUserId) return;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurantId: activeUserId,
          order
        })
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error('Non-JSON server response (SPA redirect fallback)');
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Server validation failed');
      }
    } catch (error: any) {
      console.warn('Backend order validation failed, falling back to direct write:', error?.message || error);
      const path = `restaurants/${activeUserId}/orders`;
      await setDoc(doc(db, path, order.id), cleanUndefined(order));
    }
  };
  const updateOrder = async (id: string, updates: Partial<Order>) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/orders`;
    try {
      await updateDoc(doc(db, path, id), cleanUndefined(updates));
    } catch (error) {
      console.warn('Error updating order:', error);
    }
  };

  const addMenuItem = async (item: MenuItem) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/menuItems`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error creating menu item:', error);
    }
  };
  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/menuItems`;
    try {
      await updateDoc(doc(db, path, id), cleanUndefined(updates));
    } catch (error) {
      console.warn('Error updating menu item:', error);
    }
  };
  const deleteMenuItem = async (id: string) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/menuItems`;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      console.warn('Error deleting menu item:', error);
    }
  };

  const addInventoryItem = async (item: InventoryItem) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/inventoryItems`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error adding inventory item:', error);
    }
  };
  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/inventoryItems`;
    try {
      await updateDoc(doc(db, path, id), cleanUndefined(updates));
    } catch (error) {
      console.warn('Error updating inventory item:', error);
    }
  };
  const deleteInventoryItem = async (id: string) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/inventoryItems`;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      console.warn('Error deleting inventory item:', error);
    }
  };

  const addStaffMember = async (item: StaffMember) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/staffMembers`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error adding staff member:', error);
    }
  };
  const updateStaffMember = async (id: string, updates: Partial<StaffMember>) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/staffMembers`;
    try {
      await updateDoc(doc(db, path, id), cleanUndefined(updates));
    } catch (error) {
      console.warn('Error updating staff member:', error);
    }
  };

  const addCustomer = async (item: Customer) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/customers`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error adding customer:', error);
    }
  };
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/customers`;
    try {
      await updateDoc(doc(db, path, id), cleanUndefined(updates));
    } catch (error) {
      console.warn('Error updating customer:', error);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/customers`;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      console.warn('Error deleting customer:', error);
    }
  };

  const addSelfOrder = async (so: ActiveSelfOrder) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/selfOrders`;
    try {
      await setDoc(doc(db, path, so.id), cleanUndefined(so));
    } catch (error) {
      console.warn('Error adding self order:', error);
    }
  };

  const deleteSelfOrder = async (id: string) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/selfOrders`;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      console.warn('Error deleting self order:', error);
    }
  };

  const addBillingRecord = async (item: any) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/billing`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error adding billing record:', error);
    }
  };

  const addPaymentRecord = async (item: any) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/payments`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error adding payment record:', error);
    }
  };

  const addInvoiceRecord = async (item: any) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/invoices`;
    try {
      await setDoc(doc(db, path, item.id), cleanUndefined(item));
    } catch (error) {
      console.warn('Error adding invoice record:', error);
    }
  };

  const addStockTransaction = async (tx: StockTransaction) => {
    if (!activeUserId) return;
    const path = `restaurants/${activeUserId}/inventoryTransactions`;
    try {
      await setDoc(doc(db, path, tx.id), cleanUndefined(tx));
    } catch (error) {
      console.warn('Error adding stock transaction:', error);
    }
  };

  return {
    loading,
    restaurantId: activeUserId,
    userRole,
    orders, addOrder, updateOrder,
    menuItems, addMenuItem, updateMenuItem, deleteMenuItem,
    inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem,
    staffMembers, addStaffMember, updateStaffMember,
    customers, addCustomer, updateCustomer, deleteCustomer,
    selfOrders, addSelfOrder, deleteSelfOrder,
    addBillingRecord, addPaymentRecord, addInvoiceRecord,
    stockTransactions, addStockTransaction
  };
}
