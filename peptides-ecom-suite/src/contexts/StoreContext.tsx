import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import {
  Product, Category, Order, Customer, FAQ, Discount, ThemeSettings,
  defaultTheme
} from '@/data/mockData';
import { ecomApi } from '@/lib/ecom-api';

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface InventoryLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  active: boolean;
}

export interface InventoryEntry {
  productId: string;
  variantId?: string;
  locationId: string;
  stock: number;
  lowStockThreshold: number;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  variantId?: string;
  locationId: string;
  delta: number;
  reason: string;
  createdAt: string;
}

// ─── Shipping ─────────────────────────────────────────────────────────────────
export interface ShippingMethod {
  id: string;
  type: 'flat_rate' | 'local_delivery' | 'pickup';
  name: string;
  enabled: boolean;
  amount: number;
  description?: string;
  postalPrefixes?: string;
  pickupInstructions?: string;
}

// ─── Taxes ────────────────────────────────────────────────────────────────────
export interface TaxRule {
  id: string;
  name: string;
  country: string;
  province: string;
  postalPrefix?: string;
  rate: number;
  priority: number;
  enabled: boolean;
}

export interface TaxSettings {
  enabled: boolean;
  rules: TaxRule[];
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export interface PaymentProvider {
  id: 'stripe' | 'other';
  name: string;
  enabled: boolean;
  active: boolean;
  publicKey?: string;
  manualPaymentEmail?: string;
  secretKey?: string;
  testMode: boolean;
}

export interface StoreSettingsProfile {
  name: string;
  email: string;
  websiteUrl: string;
  businessType: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  logoUrl: string;
  sameAs: string[];
  openingHours: Array<{
    dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
    opens?: string | null;
    closes?: string | null;
    closed?: boolean;
  }>;
  priceRange: string;
  geoLat: number | null;
  geoLng: number | null;
  googleMapsUrl: string;
  hasPhysicalStorefront: boolean;
  currency: string;
  timezone: string;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  variantId?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────
interface StoreState {
  products: Product[];
  categories: Category[];
  orders: Order[];
  customers: Customer[];
  faqs: FAQ[];
  discounts: Discount[];
  cart: CartItem[];
  theme: ThemeSettings;
  user: { name: string; email: string } | null;
  searchQuery: string;
  inventoryLocations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
  stockAdjustments: StockAdjustment[];
  shippingMethods: ShippingMethod[];
  taxSettings: TaxSettings;
  paymentProviders: PaymentProvider[];
  storeSettings: StoreSettingsProfile;
}

const defaultLocations: InventoryLocation[] = [];

const defaultInventoryEntries: InventoryEntry[] = [];

const defaultShippingMethods: ShippingMethod[] = [
  { id: 'sm-1', type: 'flat_rate', name: 'Standard Shipping', enabled: true, amount: 15, description: '5–7 business days' },
  { id: 'sm-2', type: 'flat_rate', name: 'Express Shipping', enabled: true, amount: 25, description: '2–3 business days' },
  { id: 'sm-3', type: 'local_delivery', name: 'Local Delivery', enabled: true, amount: 10, description: 'Same-day delivery in select areas', postalPrefixes: 'M5V,M5A,M4B' },
  { id: 'sm-4', type: 'pickup', name: 'In-Store Pickup', enabled: true, amount: 0, description: 'Free pickup at our storefront', pickupInstructions: 'Pick up at 55 King St W, Toronto. Bring your order confirmation.' },
];

const defaultTaxSettings: TaxSettings = {
  enabled: true,
  rules: [
    { id: 'tax-1', name: 'Ontario HST', country: 'CA', province: 'ON', rate: 13, priority: 1, enabled: true },
    { id: 'tax-2', name: 'British Columbia GST+PST', country: 'CA', province: 'BC', rate: 12, priority: 1, enabled: true },
    { id: 'tax-3', name: 'Quebec QST+GST', country: 'CA', province: 'QC', rate: 14.975, priority: 1, enabled: true },
    { id: 'tax-4', name: 'Alberta GST', country: 'CA', province: 'AB', rate: 5, priority: 1, enabled: true },
    { id: 'tax-5', name: 'Manitoba GST+PST', country: 'CA', province: 'MB', rate: 12, priority: 1, enabled: true },
  ],
};

const defaultPaymentProviders: PaymentProvider[] = [
  { id: 'stripe', name: 'Stripe', enabled: true, active: true, publicKey: '', secretKey: '', testMode: true },
  { id: 'other', name: 'Other / Manual', enabled: false, active: false, publicKey: '', secretKey: '', testMode: false },
];

const defaultStoreSettings: StoreSettingsProfile = {
  name: "Store",
  email: "",
  websiteUrl: "",
  businessType: "Store",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateOrProvince: "",
  postalCode: "",
  countryCode: "",
  logoUrl: "",
  sameAs: [],
  openingHours: [],
  priceRange: "",
  geoLat: null,
  geoLng: null,
  googleMapsUrl: "",
  hasPhysicalStorefront: true,
  currency: "CAD",
  timezone: "America/Toronto",
};

type Action =
  | { type: 'LOAD_STATE'; payload: Partial<StoreState> }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_CART_QTY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER_STATUS'; payload: { id: string; status: Order['status'] } }
  | { type: 'UPDATE_THEME'; payload: Partial<ThemeSettings> }
  | { type: 'ADD_FAQ'; payload: FAQ }
  | { type: 'UPDATE_FAQ'; payload: FAQ }
  | { type: 'DELETE_FAQ'; payload: string }
  | { type: 'ADD_DISCOUNT'; payload: Discount }
  | { type: 'UPDATE_DISCOUNT'; payload: Discount }
  | { type: 'DELETE_DISCOUNT'; payload: string }
  | { type: 'SET_USER'; payload: { name: string; email: string } | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'ADD_LOCATION'; payload: InventoryLocation }
  | { type: 'UPDATE_LOCATION'; payload: InventoryLocation }
  | { type: 'DELETE_LOCATION'; payload: string }
  | { type: 'ADJUST_STOCK'; payload: { productId: string; variantId?: string; locationId: string; delta: number; reason: string } }
  | { type: 'SET_LOW_THRESHOLD'; payload: { productId: string; variantId?: string; locationId: string; threshold: number } }
  | { type: 'UPDATE_INVENTORY_ENTRY'; payload: InventoryEntry }
  | { type: 'ADD_SHIPPING_METHOD'; payload: ShippingMethod }
  | { type: 'UPDATE_SHIPPING_METHOD'; payload: ShippingMethod }
  | { type: 'DELETE_SHIPPING_METHOD'; payload: string }
  | { type: 'UPDATE_TAX_SETTINGS'; payload: Partial<TaxSettings> }
  | { type: 'ADD_TAX_RULE'; payload: TaxRule }
  | { type: 'UPDATE_TAX_RULE'; payload: TaxRule }
  | { type: 'DELETE_TAX_RULE'; payload: string }
  | { type: 'UPDATE_PAYMENT_PROVIDER'; payload: PaymentProvider }
  | { type: 'SET_ACTIVE_PROVIDER'; payload: 'stripe' | 'other' };

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function mapApiCategories(input: Array<{ id: string; name: string; slug: string; description?: string; sortOrder: number }>): Category[] {
  return input.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description || '',
    emoji: '',
    sortOrder: item.sortOrder ?? 0,
  }));
}

function mapApiProducts(input: any[]): Product[] {
  return input.map((item) => {
    const firstVariant = item.variants?.[0];
    const variants = (item.variants || []).map((variant: any) => ({
      id: variant.id,
      name: variant.title || variant.sku || 'Default',
      price: (variant.priceCents || 0) / 100,
      cost: typeof variant.costCents === 'number' ? variant.costCents / 100 : undefined,
      stock: variant.available ?? variant.onHand ?? 0,
    }));

    const totalStock = variants.reduce((sum: number, variant: any) => sum + (variant.stock || 0), 0);

    return {
      id: item.id,
      title: item.title,
      description: item.description || '',
      videoUrl: item.videoUrl || undefined,
      price: firstVariant ? firstVariant.priceCents / 100 : 0,
      cost: typeof firstVariant?.costCents === 'number' ? firstVariant.costCents / 100 : undefined,
      comparePrice: firstVariant?.compareAtPriceCents ? firstVariant.compareAtPriceCents / 100 : undefined,
      categoryId: item.categories?.[0]?.id || '',
      images: (item.images || []).map((image: any) => image.url).filter(Boolean),
      featured: Boolean(item.featured),
      status: item.status === 'DRAFT' ? 'draft' : 'active',
      badges: Array.isArray(item.badges) ? item.badges : (item.featured ? ['featured'] : []),
      variants,
      stock: totalStock,
      sku: firstVariant?.sku || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
    };
  });
}

function mapApiFaqs(input: any[]): FAQ[] {
  return input.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder ?? 0,
  }));
}

function mapApiTheme(input: any): ThemeSettings {
  return {
    primaryColor: input?.primaryColor || defaultTheme.primaryColor,
    secondaryColor: input?.secondaryColor || defaultTheme.secondaryColor,
    buttonColor: input?.buttonColor || defaultTheme.buttonColor,
    headerBgColor: input?.headerBgColor || defaultTheme.headerBgColor,
    font: (input?.font || defaultTheme.font) as ThemeSettings['font'],
    tagline: input?.tagline || defaultTheme.tagline,
    showFeaturedSection: input?.showFeaturedSection ?? defaultTheme.showFeaturedSection,
    showCategorySection: input?.showCategorySection ?? defaultTheme.showCategorySection,
    showNewsletterSection: input?.showNewsletterSection ?? defaultTheme.showNewsletterSection,
    sectionOrder: Array.isArray(input?.sectionOrder) ? input.sectionOrder : defaultTheme.sectionOrder,
  };
}

function mapApiPaymentProviders(input: any[]): PaymentProvider[] {
  return input.map((provider) => ({
    id: provider.id as PaymentProvider['id'],
    name: provider.name,
    enabled: !!provider.enabled,
    active: !!provider.active,
    publicKey: provider.publicKey || '',
    manualPaymentEmail: provider.manualPaymentEmail || '',
    secretKey: provider.secretKey || '',
    testMode: provider.testMode ?? true,
  }));
}

function mapApiLocations(input: any[]): InventoryLocation[] {
  return input.map((location) => ({
    id: location.id,
    name: location.name,
    code: location.code,
    address: location.address || undefined,
    active: !!location.isActive,
  }));
}

function mapApiInventoryEntries(input: any[], products: Product[]): InventoryEntry[] {
  const variantToProduct = new Map<string, string>();
  for (const product of products) {
    for (const variant of product.variants || []) {
      variantToProduct.set(variant.id, product.id);
    }
  }

  return input
    .map((item) => {
      const productId = variantToProduct.get(item.variantId);
      if (!productId) return null;
      return {
        productId,
        variantId: item.variantId,
        locationId: item.locationId,
        stock: item.onHand ?? 0,
        lowStockThreshold: item.threshold ?? 0,
      };
    })
    .filter((item): item is InventoryEntry => item !== null);
}

function mapApiInventoryMovements(input: any[], products: Product[]): StockAdjustment[] {
  const variantToProduct = new Map<string, string>();
  for (const product of products) {
    for (const variant of product.variants || []) {
      variantToProduct.set(variant.id, product.id);
    }
  }

  return input.map((item) => ({
    id: item.id,
    productId: item.productId || variantToProduct.get(item.variantId) || '',
    variantId: item.variantId,
    locationId: item.locationId,
    delta: item.delta ?? 0,
    reason: item.note || item.reason || 'Inventory adjustment',
    createdAt: item.createdAt,
  })).filter((item) => !!item.productId);
}

function mapProductsWithInventoryStock(products: Product[], entries: InventoryEntry[]): Product[] {
  const stockByProduct = new Map<string, number>();
  for (const entry of entries) {
    stockByProduct.set(entry.productId, (stockByProduct.get(entry.productId) || 0) + entry.stock);
  }
  return products.map((product) => ({
    ...product,
    stock: stockByProduct.get(product.id) ?? 0,
  }));
}

function mapFulfillmentToOrderStatus(fulfillmentStatus: string): Order['status'] {
  switch (fulfillmentStatus) {
    case 'PICKING':
      return 'processing';
    case 'PACKED':
      return 'confirmed';
    case 'SHIPPED':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELED':
      return 'cancelled';
    case 'UNFULFILLED':
      return 'pending';
    default:
      return 'processing';
  }
}

function mapApiOrders(input: any[]): Order[] {
  return input.map((order) => {
    const shippingAddress = order.shippingAddress || {};
    return {
      id: order.id || order.orderNumber,
      orderNumber: order.orderNumber || order.id,
      customerId: order.customerId,
      customerName: order.email ? order.email.split('@')[0] : 'Customer',
      customerEmail: order.email || '',
      items: (order.items || []).map((item: any) => ({
        productId: item.variantId,
        title: item.titleSnapshot || item.skuSnapshot || 'Item',
        price: (item.unitPriceCents || 0) / 100,
        quantity: item.quantity || 0,
        image: '',
      })),
      subtotal: (order.subtotalCents || 0) / 100,
      shipping: (order.shippingCents || 0) / 100,
      total: (order.totalCents || 0) / 100,
      status: mapFulfillmentToOrderStatus(order.fulfillmentStatus),
      createdAt: order.createdAt || order.placedAt,
      shippingAddress: {
        street: shippingAddress.line1 || '',
        city: shippingAddress.city || '',
        province: shippingAddress.province || '',
        postalCode: shippingAddress.postalCode || '',
      },
      shippingMethod: order.shippingMethodType || '',
      trackingNumber: order.trackingNumber || undefined,
    };
  });
}

function mapApiCustomers(input: any[]): Customer[] {
  return input.map((customer) => ({
    id: customer.id,
    name: customer.name || customer.email?.split('@')?.[0] || 'Customer',
    email: customer.email || '',
    phone: customer.phone || undefined,
    totalOrders: customer.totalOrders ?? 0,
    totalSpent: ((customer.totalSpentCents ?? 0) as number) / 100,
    joinedAt: customer.joinedAt || new Date().toISOString(),
    address: customer.address
      ? {
          street: customer.address.line1 || '',
          city: customer.address.city || '',
          province: customer.address.province || '',
          postalCode: customer.address.postalCode || '',
        }
      : undefined,
  }));
}

function mapApiCart(input: any, products: Product[]): CartItem[] {
  const variantToProduct = new Map<string, Product>();
  products.forEach((product) => {
    product.variants?.forEach((variant) => variantToProduct.set(variant.id, product));
  });

  return (input?.items || []).map((item: any) => {
    const product = variantToProduct.get(item.variantId);
    return {
      id: item.id,
      productId: product?.id || item.variantId,
      title: item.variant?.title || product?.title || 'Product',
      price: (item.variant?.priceCents || 0) / 100,
      quantity: item.quantity || 1,
      image: product?.images?.[0] || '',
      variantId: item.variantId,
    };
  });
}

function mapShippingMethodsFromApi(input: any[]): ShippingMethod[] {
  return input.map((method, index) => {
    const config = method.configJson || {};
    const amount = typeof config.amountCents === 'number' ? config.amountCents / 100 : 0;
    return {
      id: `${method.type}-${index}`,
      type: method.type === 'LOCAL_DELIVERY' ? 'local_delivery' : method.type === 'PICKUP' ? 'pickup' : 'flat_rate',
      name: method.name,
      enabled: !!method.enabled,
      amount,
      description: method.type === 'PICKUP' ? 'Pick up from store location' : undefined,
    };
  });
}

function storeReducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'LOAD_STATE': return { ...state, ...action.payload };
    case 'SET_PRODUCTS': return { ...state, products: action.payload };
    case 'SET_CATEGORIES': return { ...state, categories: action.payload };
    case 'SET_ORDERS': return { ...state, orders: action.payload };
    case 'SET_CART': return { ...state, cart: action.payload };
    case 'ADD_PRODUCT': return { ...state, products: [...state.products, action.payload] };
    case 'UPDATE_PRODUCT': return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PRODUCT': return { ...state, products: state.products.filter(p => p.id !== action.payload) };
    case 'ADD_CATEGORY': return { ...state, categories: [...state.categories, action.payload] };
    case 'UPDATE_CATEGORY': return { ...state, categories: state.categories.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CATEGORY': return { ...state, categories: state.categories.filter(c => c.id !== action.payload) };
    case 'ADD_TO_CART': {
      const existing = state.cart.find(i => i.productId === action.payload.productId && i.variantId === action.payload.variantId);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + action.payload.quantity } : i)
        };
      }
      return { ...state, cart: [...state.cart, action.payload] };
    }
    case 'REMOVE_FROM_CART': return { ...state, cart: state.cart.filter(i => i.id !== action.payload) };
    case 'UPDATE_CART_QTY': return { ...state, cart: state.cart.map(i => i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i) };
    case 'CLEAR_CART': return { ...state, cart: [] };
    case 'ADD_ORDER': return { ...state, orders: [action.payload, ...state.orders] };
    case 'UPDATE_ORDER_STATUS': return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? { ...o, status: action.payload.status } : o) };
    case 'UPDATE_THEME': return { ...state, theme: { ...state.theme, ...action.payload } };
    case 'ADD_FAQ': return { ...state, faqs: [...state.faqs, action.payload] };
    case 'UPDATE_FAQ': return { ...state, faqs: state.faqs.map(f => f.id === action.payload.id ? action.payload : f) };
    case 'DELETE_FAQ': return { ...state, faqs: state.faqs.filter(f => f.id !== action.payload) };
    case 'ADD_DISCOUNT': return { ...state, discounts: [...state.discounts, action.payload] };
    case 'UPDATE_DISCOUNT': return { ...state, discounts: state.discounts.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DISCOUNT': return { ...state, discounts: state.discounts.filter(d => d.id !== action.payload) };
    case 'SET_USER': return { ...state, user: action.payload };
    case 'SET_SEARCH': return { ...state, searchQuery: action.payload };
    case 'ADD_LOCATION': return { ...state, inventoryLocations: [...state.inventoryLocations, action.payload] };
    case 'UPDATE_LOCATION': return { ...state, inventoryLocations: state.inventoryLocations.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'DELETE_LOCATION': return { ...state, inventoryLocations: state.inventoryLocations.filter(l => l.id !== action.payload) };
    case 'ADJUST_STOCK': {
      const { productId, variantId, locationId, delta, reason } = action.payload;
      const exists = state.inventoryEntries.find(e => e.productId === productId && e.variantId === variantId && e.locationId === locationId);
      const entries = exists
        ? state.inventoryEntries.map(e => e.productId === productId && e.variantId === variantId && e.locationId === locationId
            ? { ...e, stock: Math.max(0, e.stock + delta) } : e)
        : [...state.inventoryEntries, { productId, variantId, locationId, stock: Math.max(0, delta), lowStockThreshold: 5 }];
      const adj: StockAdjustment = { id: `adj-${Date.now()}`, productId, variantId, locationId, delta, reason, createdAt: new Date().toISOString() };
      const newTotalStock = entries.filter(e => e.productId === productId).reduce((s, e) => s + e.stock, 0);
      const products = state.products.map(p => p.id === productId ? { ...p, stock: newTotalStock } : p);
      return { ...state, inventoryEntries: entries, stockAdjustments: [adj, ...state.stockAdjustments], products };
    }
    case 'SET_LOW_THRESHOLD': {
      const { productId, variantId, locationId, threshold } = action.payload;
      return { ...state, inventoryEntries: state.inventoryEntries.map(e => e.productId === productId && e.variantId === variantId && e.locationId === locationId ? { ...e, lowStockThreshold: threshold } : e) };
    }
    case 'UPDATE_INVENTORY_ENTRY': {
      const exists = state.inventoryEntries.find(e => e.productId === action.payload.productId && e.locationId === action.payload.locationId);
      const entries = exists
        ? state.inventoryEntries.map(e => e.productId === action.payload.productId && e.locationId === action.payload.locationId ? action.payload : e)
        : [...state.inventoryEntries, action.payload];
      return { ...state, inventoryEntries: entries };
    }
    case 'ADD_SHIPPING_METHOD': return { ...state, shippingMethods: [...state.shippingMethods, action.payload] };
    case 'UPDATE_SHIPPING_METHOD': return { ...state, shippingMethods: state.shippingMethods.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_SHIPPING_METHOD': return { ...state, shippingMethods: state.shippingMethods.filter(m => m.id !== action.payload) };
    case 'UPDATE_TAX_SETTINGS': return { ...state, taxSettings: { ...state.taxSettings, ...action.payload } };
    case 'ADD_TAX_RULE': return { ...state, taxSettings: { ...state.taxSettings, rules: [...state.taxSettings.rules, action.payload] } };
    case 'UPDATE_TAX_RULE': return { ...state, taxSettings: { ...state.taxSettings, rules: state.taxSettings.rules.map(r => r.id === action.payload.id ? action.payload : r) } };
    case 'DELETE_TAX_RULE': return { ...state, taxSettings: { ...state.taxSettings, rules: state.taxSettings.rules.filter(r => r.id !== action.payload) } };
    case 'UPDATE_PAYMENT_PROVIDER': return { ...state, paymentProviders: state.paymentProviders.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'SET_ACTIVE_PROVIDER': return { ...state, paymentProviders: state.paymentProviders.map(p => ({ ...p, active: p.id === action.payload })) };
    default: return state;
  }
}

const initialState: StoreState = {
  products: [],
  categories: [],
  orders: [],
  customers: [],
  faqs: [],
  discounts: [],
  cart: [],
  theme: defaultTheme,
  user: null,
  searchQuery: '',
  inventoryLocations: defaultLocations,
  inventoryEntries: defaultInventoryEntries,
  stockAdjustments: [],
  shippingMethods: defaultShippingMethods,
  taxSettings: defaultTaxSettings,
  paymentProviders: defaultPaymentProviders,
  storeSettings: defaultStoreSettings,
};

interface StoreContextValue {
  state: StoreState;
  dispatch: React.Dispatch<Action>;
  cartCount: number;
  cartTotal: number;
  addToCart: (item: Omit<CartItem, 'quantity' | 'id'> & { quantity?: number }) => Promise<void>;
  updateCartItemQty: (id: string, quantity: number) => Promise<void>;
  removeCartItem: (id: string) => Promise<void>;
  featuredProducts: Product[];
  getProductStock: (productId: string) => number;
  getMatchingTaxRate: (province: string) => number;
  activePaymentProvider: PaymentProvider | undefined;
  refreshFromApi: () => Promise<void>;
  customerLogin: (payload: { email: string; password: string }) => Promise<void>;
  customerRegister: (payload: { name?: string; email: string; password: string }) => Promise<void>;
  customerLogout: () => Promise<void>;
  isCustomerAuthenticated: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, initialState, (init) => {
    return {
      ...init,
      products: [],
      categories: [],
      orders: [],
      cart: loadFromStorage('fk_cart', []),
      theme: defaultTheme,
      faqs: [],
      discounts: [],
      user: null,
      inventoryLocations: loadFromStorage('fk_inv_locations', defaultLocations),
      inventoryEntries: loadFromStorage('fk_inv_entries', defaultInventoryEntries),
      stockAdjustments: loadFromStorage('fk_inv_adjustments', []),
      shippingMethods: loadFromStorage('fk_shipping', defaultShippingMethods),
      taxSettings: loadFromStorage('fk_taxes', defaultTaxSettings),
      paymentProviders: defaultPaymentProviders,
      storeSettings: defaultStoreSettings,
    };
  });

  const refreshFromApi = useCallback(async () => {
    try {
      const hasAdminToken = !!ecomApi.getToken('admin');
      const loadAllProducts = async () => {
        const limit = 100;
        const fetchPage = (page: number) =>
          hasAdminToken
            ? ecomApi.admin.products({ page, limit })
            : ecomApi.store.products({ page, limit });

        const firstPage = await fetchPage(1);
        const items = [...(firstPage.items || [])];
        const explicitTotalPages =
          firstPage?.pagination?.totalPages ??
          firstPage?.totalPages ??
          (typeof firstPage?.pagination?.total === 'number'
            ? Math.max(1, Math.ceil(firstPage.pagination.total / limit))
            : undefined);

        if (typeof explicitTotalPages === 'number' && explicitTotalPages > 1) {
          const restPages = await Promise.all(
            Array.from({ length: explicitTotalPages - 1 }, (_unused, index) => fetchPage(index + 2))
          );
          items.push(...restPages.flatMap((pageData) => pageData.items || []));
        } else if (explicitTotalPages === undefined) {
          // Fallback when pagination metadata is missing: keep fetching until page is not full.
          let page = 2;
          while (true) {
            const nextPage = await fetchPage(page);
            const nextItems = nextPage.items || [];
            if (nextItems.length === 0) break;
            items.push(...nextItems);
            if (nextItems.length < limit) break;
            page += 1;
          }
        }

        return { ...firstPage, items };
      };

      const [categoriesRes, productsRes, faqsRes, themeRes, storePaymentRes, storeSettingsRes] = hasAdminToken
        ? await Promise.all([
            ecomApi.admin.categories(),
            loadAllProducts(),
            ecomApi.admin.faqs(),
            ecomApi.admin.theme(),
            ecomApi.store.paymentSettings(),
            ecomApi.store.settings()
          ])
        : await Promise.all([
            ecomApi.store.categories(),
            loadAllProducts(),
            ecomApi.store.faqs(),
            ecomApi.store.theme(),
            ecomApi.store.paymentSettings(),
            ecomApi.store.settings()
          ]);

      const categories = mapApiCategories(categoriesRes.items || []);
      const products = mapApiProducts(productsRes.items || []);
      const faqs = mapApiFaqs(faqsRes.items || []);
      const theme = mapApiTheme(themeRes);
      const storefrontPaymentProviders = mapApiPaymentProviders(storePaymentRes.items || []);
      const storeSettings = {
        ...defaultStoreSettings,
        ...storeSettingsRes
      };

      if (hasAdminToken) {
        try {
          const [locationsRes, inventoryRes, movementsRes, customersRes, paymentSettingsRes, ordersRes] = await Promise.all([
            ecomApi.admin.locations(),
            ecomApi.admin.inventory(),
            ecomApi.admin.inventoryMovements({ page: 1, limit: 200 }),
            ecomApi.admin.customers({ page: 1, limit: 100 }),
            ecomApi.admin.paymentSettings(),
            ecomApi.admin.orders({ page: 1, limit: 100 }),
          ]);

          const locations = mapApiLocations(locationsRes.items || []);
          const inventoryEntries = mapApiInventoryEntries(inventoryRes.items || [], products);
          const stockAdjustments = mapApiInventoryMovements(movementsRes.items || [], products);
          const customers = mapApiCustomers(customersRes.items || []);
          const paymentProviders = mapApiPaymentProviders(paymentSettingsRes.items || []);
          const orders = mapApiOrders(ordersRes.items || []);
          const productsWithStock = mapProductsWithInventoryStock(products, inventoryEntries);

          dispatch({
            type: 'LOAD_STATE',
            payload: {
              faqs,
              theme,
              inventoryLocations: locations,
              inventoryEntries,
              stockAdjustments,
              customers,
              orders,
              paymentProviders: paymentProviders.length ? paymentProviders : defaultPaymentProviders,
              storeSettings,
            },
          });
          dispatch({ type: 'SET_PRODUCTS', payload: productsWithStock });
          dispatch({ type: 'SET_CATEGORIES', payload: categories });
        } catch {
          dispatch({ type: 'SET_PRODUCTS', payload: products });
          dispatch({ type: 'SET_CATEGORIES', payload: categories });
          dispatch({
            type: 'LOAD_STATE',
            payload: {
              faqs,
              theme,
              paymentProviders: storefrontPaymentProviders.length ? storefrontPaymentProviders : defaultPaymentProviders,
              storeSettings,
            },
          });
        }
      } else {
        dispatch({ type: 'SET_CATEGORIES', payload: categories });
        dispatch({ type: 'SET_PRODUCTS', payload: products });
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            faqs,
            theme,
            paymentProviders: storefrontPaymentProviders.length ? storefrontPaymentProviders : defaultPaymentProviders,
            storeSettings,
          },
        });
      }

      if (ecomApi.getToken('customer')) {
        try {
          const me = await ecomApi.customer.me();
          dispatch({ type: 'SET_USER', payload: { name: me.name || me.email.split('@')[0], email: me.email } });

          const [cartRes, ordersRes] = await Promise.all([
            ecomApi.store.cart(),
            ecomApi.store.orders()
          ]);

          dispatch({ type: 'SET_CART', payload: mapApiCart(cartRes, products) });
          dispatch({ type: 'SET_ORDERS', payload: mapApiOrders(ordersRes.items || []) });

          try {
            const methods = await ecomApi.store.shippingMethods({ country: 'CA' });
            dispatch({ type: 'LOAD_STATE', payload: { shippingMethods: mapShippingMethodsFromApi(methods) } });
          } catch {
            // keep fallback shipping methods
          }
        } catch {
          ecomApi.setToken('customer', null);
          dispatch({ type: 'SET_USER', payload: null });
          dispatch({ type: 'SET_CART', payload: [] });
          dispatch({ type: 'SET_ORDERS', payload: [] });
        }
      } else {
        dispatch({ type: 'SET_USER', payload: null });
      }
    } catch {
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          products: [],
          categories: [],
          faqs: [],
          customers: [],
          orders: [],
          storeSettings: defaultStoreSettings,
        },
      });
    }
  }, []);

  useEffect(() => {
    void refreshFromApi();
  }, [refreshFromApi]);

  useEffect(() => {
    localStorage.removeItem('fk_payments');
  }, []);

  useEffect(() => { localStorage.setItem('fk_products', JSON.stringify(state.products)); }, [state.products]);
  useEffect(() => { localStorage.setItem('fk_categories', JSON.stringify(state.categories)); }, [state.categories]);
  useEffect(() => { localStorage.setItem('fk_orders', JSON.stringify(state.orders)); }, [state.orders]);
  useEffect(() => { localStorage.setItem('fk_cart', JSON.stringify(state.cart)); }, [state.cart]);
  useEffect(() => { localStorage.setItem('fk_theme', JSON.stringify(state.theme)); }, [state.theme]);
  useEffect(() => { localStorage.setItem('fk_faqs', JSON.stringify(state.faqs)); }, [state.faqs]);
  useEffect(() => { localStorage.setItem('fk_discounts', JSON.stringify(state.discounts)); }, [state.discounts]);
  useEffect(() => { localStorage.setItem('fk_user', JSON.stringify(state.user)); }, [state.user]);
  useEffect(() => { localStorage.setItem('fk_inv_locations', JSON.stringify(state.inventoryLocations)); }, [state.inventoryLocations]);
  useEffect(() => { localStorage.setItem('fk_inv_entries', JSON.stringify(state.inventoryEntries)); }, [state.inventoryEntries]);
  useEffect(() => { localStorage.setItem('fk_inv_adjustments', JSON.stringify(state.stockAdjustments)); }, [state.stockAdjustments]);
  useEffect(() => { localStorage.setItem('fk_shipping', JSON.stringify(state.shippingMethods)); }, [state.shippingMethods]);
  useEffect(() => { localStorage.setItem('fk_taxes', JSON.stringify(state.taxSettings)); }, [state.taxSettings]);

  useEffect(() => {
    const root = document.documentElement;
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };
    try {
      root.style.setProperty('--primary', hexToHsl(state.theme.primaryColor));
      root.style.setProperty('--header-bg', hexToHsl(state.theme.headerBgColor));
    } catch {
      // no-op
    }
  }, [state.theme.primaryColor, state.theme.headerBgColor]);

  const cartCount = state.cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const featuredProducts = state.products.filter(p => p.featured && p.status === 'active');

  const getProductStock = (productId: string) => {
    return state.inventoryEntries.filter(e => e.productId === productId).reduce((s, e) => s + e.stock, 0);
  };

  const getMatchingTaxRate = (province: string): number => {
    if (!state.taxSettings.enabled) return 0;
    const rule = state.taxSettings.rules
      .filter(r => r.enabled && r.province === province)
      .sort((a, b) => a.priority - b.priority)[0];
    return rule?.rate ?? 0;
  };

  const activePaymentProvider = state.paymentProviders.find(p => p.active && p.enabled);

  const customerLogin = useCallback(async (payload: { email: string; password: string }) => {
    const response = await ecomApi.customer.login(payload);
    ecomApi.setToken('customer', response.accessToken);
    await refreshFromApi();
  }, [refreshFromApi]);

  const customerRegister = useCallback(async (payload: { name?: string; email: string; password: string }) => {
    const response = await ecomApi.customer.register(payload);
    ecomApi.setToken('customer', response.accessToken);
    await refreshFromApi();
  }, [refreshFromApi]);

  const customerLogout = useCallback(async () => {
    try {
      await ecomApi.customer.logout();
    } catch {
      // ignore if token already invalid
    }
    ecomApi.setToken('customer', null);
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_CART', payload: [] });
    dispatch({ type: 'SET_ORDERS', payload: [] });
  }, []);

  const addToCart = useCallback(async (item: Omit<CartItem, 'quantity' | 'id'> & { quantity?: number }) => {
    const qty = item.quantity ?? 1;

    if (!ecomApi.getToken('customer')) {
      dispatch({ type: 'ADD_TO_CART', payload: { ...item, id: `${item.productId}:${item.variantId || 'default'}`, quantity: qty } });
      return;
    }

    const product = state.products.find((p) => p.id === item.productId);
    const variantId = item.variantId || product?.variants?.[0]?.id;

    if (!variantId) {
      dispatch({ type: 'ADD_TO_CART', payload: { ...item, id: `${item.productId}:${item.variantId || 'default'}`, quantity: qty } });
      return;
    }

    const cartRes = await ecomApi.store.addCartItem({ variantId, quantity: qty });
    dispatch({ type: 'SET_CART', payload: mapApiCart(cartRes, state.products) });
  }, [state.products]);

  const updateCartItemQty = useCallback(async (id: string, quantity: number) => {
    if (ecomApi.getToken('customer')) {
      if (quantity < 1) {
        await ecomApi.store.deleteCartItem(id);
      } else {
        await ecomApi.store.updateCartItem(id, { quantity });
      }
      const cartRes = await ecomApi.store.cart();
      dispatch({ type: 'SET_CART', payload: mapApiCart(cartRes, state.products) });
      return;
    }

    if (quantity < 1) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    } else {
      dispatch({ type: 'UPDATE_CART_QTY', payload: { id, quantity } });
    }
  }, [state.products]);

  const removeCartItem = useCallback(async (id: string) => {
    if (ecomApi.getToken('customer')) {
      await ecomApi.store.deleteCartItem(id);
      const cartRes = await ecomApi.store.cart();
      dispatch({ type: 'SET_CART', payload: mapApiCart(cartRes, state.products) });
      return;
    }
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
  }, [state.products]);

  return (
    <StoreContext.Provider
      value={{
        state,
        dispatch,
        cartCount,
        cartTotal,
        addToCart,
        updateCartItemQty,
        removeCartItem,
        featuredProducts,
        getProductStock,
        getMatchingTaxRate,
        activePaymentProvider,
        refreshFromApi,
        customerLogin,
        customerRegister,
        customerLogout,
        isCustomerAuthenticated: !!state.user,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
