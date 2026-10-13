export interface RestaurantInfo {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  regNumber: string;
}

export interface Branding {
  logoUrl: string;
  faviconUrl: string;
}

export interface GstTax {
  gstNumber: string;
  gstRate: number;
  taxEnabled: boolean;
}

export interface PaymentConfig {
  cash: boolean;
  upi: boolean;
  creditCard: boolean;
  debitCard: boolean;
  wallet: boolean;
  upiId: string;
  merchantName: string;
}

export interface WhatsappIntegration {
  number: string;
  businessName: string;
  autoSendBills: boolean;
  sendInvoice: boolean;
  sendReceipt: boolean;
  sendOrderUpdates: boolean;
}

export interface QrOrdering {
  enabled: boolean;
  perTable: boolean;
  selfOrdering: boolean;
}

export interface Notifications {
  newOrder: boolean;
  payment: boolean;
  kitchenReady: boolean;
  lowStock: boolean;
  dailySummary: boolean;
}

export interface Security {
  adminName: string;
  twoFactor: boolean;
  sessionTimeout: string;
}

export interface TableConfig {
  id: string;
  name: string;
}

export interface Preferences {
  darkMode: boolean;
  compactMode: boolean;
  autoPrint: boolean;
  autoRefresh: boolean;
  currency: string;
}

export interface SubscriptionInfo {
  subscriptionId?: string;
  userId?: string;
  subscription_status: 'active' | 'expired' | 'trial' | 'none' | string;
  subscription_plan: 'basic' | 'pro' | 'business' | string;
  plan_name: string;
  subscription_price: number;
  billing_cycle?: 'monthly' | 'annual' | 'founders' | string;
  subscription_start: number | null;
  subscription_end: number | null;
  renewalDate?: number | null;
  payment_status: string;
  payment_method: string;
  transaction_id: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  remainingDays?: number;
  isExpired?: boolean;
  lastReminder?: number | string | null;
  discount?: number;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface PaymentHistoryRecord {
  id: string;
  invoiceNumber: string;
  subscriptionId: string;
  userId?: string;
  plan: string;
  planName: string;
  billingCycle: string;
  price: number;
  discount: number;
  subtotal: number;
  gst: number;
  totalAmount: number;
  paymentStatus: 'paid' | 'pending' | 'failed' | string;
  transactionId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentMethod: string;
  subscriptionStart: number;
  subscriptionEnd: number;
  createdAt: number | string;
}

export interface SettingsData {
  restaurantInfo: RestaurantInfo;
  branding: Branding;
  gstTax: GstTax;
  payment: PaymentConfig;
  whatsapp: WhatsappIntegration;
  qrOrdering: QrOrdering;
  notifications: Notifications;
  security: Security;
  preferences: Preferences;
  tables: TableConfig[];
  subscription?: SubscriptionInfo;
}

export const defaultSettings: SettingsData = {
  restaurantInfo: {
    name: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    regNumber: '',
  },
  branding: {
    logoUrl: '',
    faviconUrl: '',
  },
  gstTax: {
    gstNumber: '',
    gstRate: 5,
    taxEnabled: false,
  },
  payment: {
    cash: true,
    upi: true,
    creditCard: true,
    debitCard: true,
    wallet: false,
    upiId: '',
    merchantName: '',
  },
  whatsapp: {
    number: '',
    businessName: '',
    autoSendBills: false,
    sendInvoice: true,
    sendReceipt: true,
    sendOrderUpdates: false,
  },
  qrOrdering: {
    enabled: false,
    perTable: true,
    selfOrdering: true,
  },
  notifications: {
    newOrder: true,
    payment: true,
    kitchenReady: false,
    lowStock: false,
    dailySummary: true,
  },
  security: {
    adminName: '',
    twoFactor: false,
    sessionTimeout: '30',
  },
  preferences: {
    darkMode: false,
    compactMode: false,
    autoPrint: true,
    autoRefresh: true,
    currency: 'INR',
  },
  tables: [
    { id: 't1', name: 'Table 1' },
    { id: 't2', name: 'Table 2' },
    { id: 't3', name: 'Table 3' },
    { id: 't4', name: 'Table 4' },
    { id: 't5', name: 'Table 5' },
  ],
  subscription: {
    subscription_status: 'active',
    subscription_plan: 'pro',
    plan_name: 'Pro',
    subscription_price: 1499,
    subscription_start: Date.now() - 2 * 24 * 60 * 60 * 1000,
    subscription_end: Date.now() + 28 * 24 * 60 * 60 * 1000,
    payment_status: 'paid',
    payment_method: 'Razorpay',
    transaction_id: 'sub_init_active',
  },
};

export type Category = 'All' | 'Starters' | 'Main Course' | 'Desserts' | 'Drinks' | 'Veg' | 'Non-Veg';

export interface MenuItemVariant {
  id: string;
  menuItemId: string;
  name: string; // e.g. "Half" or "Full"
  price: number;
  isAvailable: boolean;
  cost?: number;
  sku?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
}

export interface MenuItemRecipeItem {
  inventoryItemId: string;
  amount: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  isAvailable: boolean;
  hasVariants?: boolean;
  isAvailableForOrder?: boolean;
  variants?: MenuItemVariant[];
  dotColor?: string;
  imageUrl?: string;
  recipe?: MenuItemRecipeItem[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  lowLimit: number;
  status: 'NORMAL' | 'LOW STOCK' | 'OUT OF STOCK';
  unit: string;
  supplier?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'Active' | 'On Leave' | 'Inactive';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  visits: number;
  totalSpend: number;
  lastVisit: string;
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  productId?: string;
  productName?: string;
  size?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export type OrderType = 'Dine-In' | 'Takeaway' | 'Delivery';

export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  tableNo?: string;
  items: OrderItem[];
  status: 'New' | 'Accepted' | 'Preparing' | 'Ready' | 'Picked Up' | 'Out for Delivery' | 'Delivered' | 'Completed' | 'Cancelled';
  createdAt: string;
  timestamp: number;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  invoiceNumber?: string;
  pdfDataUri?: string;
  totalAmount: number;
  isPaid: boolean;
  isBilled: boolean;
  paymentMethod?: 'Cash' | 'UPI' | 'Card' | string;
  payment_method?: string;
  payment_status?: string;
  transaction_type?: string;
  billSentToWhatsApp?: boolean;
  startedAt?: number;
  // Delivery integration metadata fields
  orderSource?: 'Swiggy' | 'Zomato' | 'Website' | 'WhatsApp' | string;
  platformOrderId?: string;
  deliveryAddress?: string;
  landmark?: string;
  deliveryNotes?: string;
  specialInstructions?: string;
  preparationNotes?: string;
  riderName?: string;
  riderPhone?: string;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  subtotal?: number;
  orderToken?: string;
  notes?: string;
  taxes?: number;
  deliveryFee?: number;
  discount?: number;
  coupon?: string;
  grandTotal?: number;
  platformCommission?: number;
  cookingStartedAt?: number;
  readyAt?: number;
  pickedUpAt?: number;
  deliveredAt?: number;
  // Kitchen workflow fields
  orderStatus?: string;
  kitchenStatus?: 'Pending' | 'Preparing' | 'Prepared' | 'Served' | string;
  billingStatus?: 'Pending' | 'Billed' | 'Paid' | string;
  paymentStatus?: 'Unpaid' | 'Paid' | string;
  transactionId?: string;
  preparedAt?: number;
  servedAt?: number;
  preparedBy?: string;
  servedBy?: string;
  paymentAt?: string;
  paymentTimestamp?: number;
  confirmedBy?: string;
}

export interface ActiveSelfOrder {
  id: string;
  tableNumber: string;
  tableNo?: string;
  sessionActive: boolean;
  joinedAt: string;
  orders: Order[];
  itemsCart: OrderItem[];
  items: OrderItem[];
  customerName?: string;
  customerPhone?: string;
  total?: number;
}

export interface CustomerFeedback {
  id: string;
  orderId: string;
  invoiceNo: string;
  customerName?: string;
  customerPhone: string;
  visitDate?: string;
  foodRating: number;
  serviceRating: number;
  cleanlinessRating: number;
  overallRating: number;
  review: string;
  suggestions?: string;
  wouldVisitAgain: 'Definitely' | 'Maybe' | 'No' | string;
  wouldRecommend: 'Yes' | 'No' | string;
  uploadedPhotos: string[];
  feedbackDate: number;
  platform: 'Dine-In' | 'Takeaway' | 'Delivery' | string;
  status: 'Pending' | 'Resolved' | 'Pending Reply' | 'Replied' | string;
  managerReply?: string;

  // Additional Firestore synchronisation fields requested by user
  feedbackId?: string;
  invoiceId?: string;
  restaurantId?: string;
  restaurantName?: string;
  foodQualityRating?: number;
  ambienceRating?: number;
  comments?: string;
  category?: 'Positive' | 'Complaint' | string;
  submittedAt?: any;
  adminReply?: string;
  repliedAt?: any;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  prevQuantity: number;
  newQuantity: number;
  reason: string;
  timestamp: number;
  userName?: string;
}




