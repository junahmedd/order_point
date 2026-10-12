/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MenuItem, InventoryItem, StaffMember, Customer, Order } from './types';

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm1',
    name: 'Chocolate Brownie',
    price: 150,
    description: 'Warm chocolate brownie with walnuts.',
    category: 'Desserts',
    isAvailable: true,
    dotColor: '#F59E0B',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=600',
    recipe: [{ inventoryItemId: 'i5', amount: 0.1 }]
  },
  {
    id: 'm2',
    name: 'Cold Coffee',
    price: 120,
    description: 'Creamy cold coffee with ice cream.',
    category: 'Drinks',
    isAvailable: true,
    dotColor: '#EC4899',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29a565090c?auto=format&fit=crop&q=80&w=600',
    recipe: [
      { inventoryItemId: 'i6', amount: 0.1 },
      { inventoryItemId: 'i4', amount: 0.05 }
    ]
  },
  {
    id: 'm3',
    name: 'Dal Makhani',
    price: 220,
    description: 'Slow cooked black lentils with cream and butter.',
    category: 'Veg',
    isAvailable: true,
    dotColor: '#10B981',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
    recipe: [
      { inventoryItemId: 'i2', amount: 0.15 },
      { inventoryItemId: 'i3', amount: 0.1 },
      { inventoryItemId: 'i4', amount: 0.05 }
    ]
  },
  {
    id: 'm4',
    name: 'Fresh Lime Soda',
    price: 80,
    description: 'Refreshing lime soda with mint.',
    category: 'Drinks',
    isAvailable: true,
    dotColor: '#EF4444',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=600',
    recipe: [{ inventoryItemId: 'i8', amount: 2 }]
  },
  {
    id: 'm5',
    name: 'Paneer Butter Masala',
    price: 280,
    description: 'Creamy tomato based curry with paneer cubes.',
    category: 'Veg',
    isAvailable: true,
    dotColor: '#10B981',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=600',
    recipe: [
      { inventoryItemId: 'i7', amount: 0.15 },
      { inventoryItemId: 'i3', amount: 0.1 },
      { inventoryItemId: 'i4', amount: 0.05 }
    ]
  },
];

export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: 'i1',
    name: 'Rice',
    quantity: 25,
    lowLimit: 10,
    status: 'NORMAL',
    unit: 'kg',
    supplier: 'Metro Cash & Carry',
  },
  {
    id: 'i2',
    name: 'Black Lentils (Urad)',
    quantity: 18,
    lowLimit: 8,
    status: 'NORMAL',
    unit: 'kg',
    supplier: 'Rajesh Agro Industries',
  },
  {
    id: 'i3',
    name: 'Butter',
    quantity: 15,
    lowLimit: 5,
    status: 'NORMAL',
    unit: 'kg',
    supplier: 'Amul Dairy Corp',
  },
  {
    id: 'i4',
    name: 'Cream',
    quantity: 12,
    lowLimit: 4,
    status: 'NORMAL',
    unit: 'L',
    supplier: 'Mother Dairy Dist',
  },
  {
    id: 'i5',
    name: 'Chocolate Mix',
    quantity: 14,
    lowLimit: 10,
    status: 'NORMAL',
    unit: 'kg',
    supplier: 'Hershey B2B Suppliers',
  },
  {
    id: 'i6',
    name: 'Coffee Beans',
    quantity: 10,
    lowLimit: 3,
    status: 'NORMAL',
    unit: 'kg',
    supplier: 'Araku Valley Estates',
  },
  {
    id: 'i7',
    name: 'Paneer',
    quantity: 20,
    lowLimit: 5,
    status: 'NORMAL',
    unit: 'kg',
    supplier: 'Amul Dairy Corp',
  },
  {
    id: 'i8',
    name: 'Lemons',
    quantity: 50,
    lowLimit: 15,
    status: 'NORMAL',
    unit: 'pieces',
    supplier: 'Local Mandi Vegetable Vendor',
  },
];

export const INITIAL_STAFF_MEMBERS: StaffMember[] = [
  {
    id: 's1',
    name: 'Mohammed Zaid',
    role: 'Admin / Manager',
    email: 'mohammedzaidd13@gmail.com',
    phone: '9876543210',
    status: 'Active',
  },
  {
    id: 's2',
    name: 'Arjun Kumar',
    role: 'Head Chef',
    email: 'arjun.chef@orderpoint.com',
    phone: '9822334455',
    status: 'Active',
  },
  {
    id: 's3',
    name: 'Preeti Sharma',
    role: 'Cashier',
    email: 'preeti.billing@orderpoint.com',
    phone: '9811223344',
    status: 'Active',
  },
  {
    id: 's4',
    name: 'Rahul Verma',
    role: 'Waiter',
    email: 'rahul.v@orderpoint.com',
    phone: '9871122334',
    status: 'On Leave',
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Zaid Alvi',
    phone: '9582238472',
    visits: 12,
    totalSpend: 5400,
    lastVisit: '2026-06-04',
  },
  {
    id: 'c2',
    name: 'Kshitiz Gupta',
    phone: '9180291039',
    visits: 8,
    totalSpend: 3120,
    lastVisit: '2026-06-03',
  },
  {
    id: 'c3',
    name: 'Rohit Joshi',
    phone: '9988776655',
    visits: 4,
    totalSpend: 1540,
    lastVisit: '2026-06-05',
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'o1',
    orderNumber: 'OP-1001',
    type: 'Dine-In',
    tableNo: 'Table 1',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[2], quantity: 2 }, // Dal Makhani (220 * 2)
      { menuItem: INITIAL_MENU_ITEMS[4], quantity: 1 }, // Paneer Butter (280)
      { menuItem: INITIAL_MENU_ITEMS[1], quantity: 1 }, // Cold Coffee (120)
    ],
    status: 'Completed',
    createdAt: '2026-06-05T12:30:00Z',
    timestamp: Date.now() - 3600000 * 5,
    customerPhone: '9582238472',
    totalAmount: 840,
    isBilled: true,
    isPaid: true,
    paymentMethod: 'UPI',
    billSentToWhatsApp: true,
  },
  {
    id: 'o2',
    orderNumber: 'OP-1002',
    type: 'Takeaway',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[0], quantity: 1 }, // Chocolate Brownie (150)
      { menuItem: INITIAL_MENU_ITEMS[1], quantity: 1 }, // Cold Coffee (120)
    ],
    status: 'Completed',
    createdAt: '2026-06-05T14:15:00Z',
    timestamp: Date.now() - 3600000 * 3,
    customerPhone: '9180291039',
    totalAmount: 270,
    isBilled: true,
    isPaid: true,
    paymentMethod: 'Cash',
    billSentToWhatsApp: true,
  },
  {
    id: 'o3',
    orderNumber: 'OP-1003',
    type: 'Delivery',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[2], quantity: 1 }, // Dal Makhani (220)
      { menuItem: INITIAL_MENU_ITEMS[3], quantity: 2 }, // Fresh Lime Soda (160)
    ],
    status: 'Completed',
    createdAt: '2026-06-05T16:00:00Z',
    timestamp: Date.now() - 3600000 * 1,
    customerPhone: '9988776655',
    totalAmount: 380,
    isBilled: true,
    isPaid: true,
    paymentMethod: 'UPI',
    billSentToWhatsApp: true,
  },
];
