export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
  sortOrder: number;
  image?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  cost?: number;
  stock: number;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  price: number;
  cost?: number;
  comparePrice?: number;
  categoryId: string;
  images: string[];
  featured: boolean;
  status: 'active' | 'draft';
  badges: ('new' | 'bestseller' | 'featured')[];
  variants?: ProductVariant[];
  stock: number;
  sku: string;
  weight?: number;
  tags?: string[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  joinedAt: string;
  address?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  shippingAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  shippingMethod: string;
  trackingNumber?: string;
  notes?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface Discount {
  id: string;
  type: 'percentage' | 'fixed' | 'category';
  code?: string;
  value: number;
  categoryId?: string;
  active: boolean;
  minOrder?: number;
  expiresAt?: string;
  usageCount: number;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  buttonColor: string;
  headerBgColor: string;
  font: 'Space Grotesk' | 'Inter' | 'Playfair Display';
  tagline: string;
  showFeaturedSection: boolean;
  showCategorySection: boolean;
  showNewsletterSection: boolean;
  sectionOrder: string[];
}

export const defaultTheme: ThemeSettings = {
  primaryColor: '#0D9488',
  secondaryColor: '#0D1B2A',
  buttonColor: '#0D9488',
  headerBgColor: '#0A1628',
  font: 'Space Grotesk',
  tagline: 'Canada\'s top source for quality peptides',
  showFeaturedSection: true,
  showCategorySection: true,
  showNewsletterSection: true,
  sectionOrder: ['hero', 'featured', 'categories', 'newsletter'],
};

export const mockCategories: Category[] = [
  { id: 'cat-1', name: 'Aerial Shells', slug: 'aerial-shells', description: 'Soaring shells that burst into brilliant displays high above.', emoji: '', sortOrder: 1 },
  { id: 'cat-2', name: 'Roman Candles', slug: 'roman-candles', description: 'Classic tubes that fire colorful stars and comets.', emoji: '', sortOrder: 2 },
  { id: 'cat-3', name: 'Sparklers', slug: 'sparklers', description: 'Hand-held sparkling wires perfect for any celebration.', emoji: '', sortOrder: 3 },
  { id: 'cat-4', name: 'Cakes', slug: 'cakes', description: 'Multi-shot barrages for incredible ground-level shows.', emoji: '', sortOrder: 4 },
  { id: 'cat-5', name: 'Smoke', slug: 'smoke', description: 'Vibrant smoke grenades and candles for photography.', emoji: '', sortOrder: 5 },
  { id: 'cat-6', name: 'Novelty', slug: 'novelty', description: 'Fun and unique fireworks for all ages.', emoji: '', sortOrder: 6 },
  { id: 'cat-7', name: 'Fountains', slug: 'fountains', description: 'Spectacular ground fountains with colorful showers of sparks.', emoji: '', sortOrder: 7 },
];

const fireworksImages = [
  'https://images.unsplash.com/photo-1533230408708-8f9f91d1235a?w=600&q=80',
  'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=600&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
  'https://images.unsplash.com/photo-1576485375217-d6a95e34d043?w=600&q=80',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80',
  'https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=600&q=80',
];

export const mockProducts: Product[] = [
  {
    id: 'p-1', title: 'Phoenix Rising Shell Kit', description: 'A breathtaking 12-shell kit featuring brilliant red and gold peony bursts with silver tails. Perfect for mid-season celebrations with a professional finish.',
    price: 89.99, comparePrice: 119.99, categoryId: 'cat-1',
    images: [fireworksImages[0], fireworksImages[3]],
    featured: true, status: 'active', badges: ['bestseller', 'featured'], stock: 45, sku: 'FK-AS-001', tags: ['shells', 'aerial', 'kit'],
    variants: [{ id: 'v1', name: '12-Shell Kit', price: 89.99, stock: 45 }, { id: 'v2', name: '24-Shell Kit', price: 159.99, stock: 20 }],
  },
  {
    id: 'p-2', title: 'Inferno Aerial Barrage', description: 'An explosive 36-shot cake delivering rapid-fire gold glitter and red crossette effects. The centerpiece of any serious display.',
    price: 149.99, categoryId: 'cat-1',
    images: [fireworksImages[1]],
    featured: true, status: 'active', badges: ['featured', 'new'], stock: 18, sku: 'FK-AS-002', tags: ['aerial', 'barrage'],
  },
  {
    id: 'p-3', title: 'Dragon\'s Breath Roman Candles', description: 'Pack of 6 roman candles each firing 8 colorful shots of blue, green, and gold stars with loud reports.',
    price: 34.99, comparePrice: 44.99, categoryId: 'cat-2',
    images: [fireworksImages[2]],
    featured: true, status: 'active', badges: ['bestseller'], stock: 120, sku: 'FK-RC-001', tags: ['roman candle', 'classic'],
  },
  {
    id: 'p-4', title: 'Golden Rain Sparklers (20-pack)', description: 'Premium 18-inch gold sparklers with a 2-minute burn time. Perfect for weddings, birthdays, and New Year\'s celebrations.',
    price: 18.99, categoryId: 'cat-3',
    images: [fireworksImages[3]],
    featured: true, status: 'active', badges: ['bestseller'], stock: 300, sku: 'FK-SP-001', tags: ['sparklers', 'wedding'],
  },
  {
    id: 'p-5', title: 'Supernova 500-Shot Cake', description: 'The most spectacular cake in our lineup. 500 rapid-fire shots of multicolor effects including peonies, comets, and crackling mines.',
    price: 299.99, comparePrice: 349.99, categoryId: 'cat-4',
    images: [fireworksImages[4]],
    featured: true, status: 'active', badges: ['new', 'featured'], stock: 8, sku: 'FK-CK-001', tags: ['cake', 'large', 'professional'],
  },
  {
    id: 'p-6', title: 'Chromatic Smoke Grenade Set', description: 'Set of 8 vivid smoke grenades in red, blue, yellow, and green. 90-second burn time. Great for photography and events.',
    price: 42.99, categoryId: 'cat-5',
    images: [fireworksImages[5]],
    featured: false, status: 'active', badges: ['new'], stock: 75, sku: 'FK-SM-001', tags: ['smoke', 'photography'],
  },
  {
    id: 'p-7', title: 'Color Cascade Fountain', description: 'A stunning ground fountain shooting 4-foot jets of silver and gold sparks for 2 minutes. Low-noise option, perfect for quiet neighborhoods.',
    price: 24.99, categoryId: 'cat-7',
    images: [fireworksImages[0]],
    featured: false, status: 'active', badges: [], stock: 90, sku: 'FK-FT-001', tags: ['fountain', 'quiet'],
  },
  {
    id: 'p-8', title: 'Party Sparkler Cones (12-pack)', description: 'Colorful cone-shaped sparklers that spin and crackle. Safe for supervised children over 12. Burns for 45 seconds.',
    price: 12.99, categoryId: 'cat-6',
    images: [fireworksImages[1]],
    featured: false, status: 'active', badges: [], stock: 200, sku: 'FK-NV-001', tags: ['novelty', 'family'],
  },
  {
    id: 'p-9', title: 'Thunderstruck Shell Assortment', description: 'A curated assortment of 30 professional-grade shells including willows, chrysanthemums, and brocade crowns.',
    price: 189.99, comparePrice: 229.99, categoryId: 'cat-1',
    images: [fireworksImages[2]],
    featured: false, status: 'active', badges: ['bestseller'], stock: 22, sku: 'FK-AS-003', tags: ['shells', 'assortment'],
  },
  {
    id: 'p-10', title: 'Silver Fountain Duo', description: 'Two premium 5-minute silver sparkle fountains perfect for flanking any stage or wedding aisle.',
    price: 39.99, categoryId: 'cat-7',
    images: [fireworksImages[3]],
    featured: false, status: 'active', badges: [], stock: 55, sku: 'FK-FT-002', tags: ['fountain', 'wedding'],
  },
  {
    id: 'p-11', title: 'Blazing Comet Roman Candles (3-pack)', description: 'Triple-pack of comet roman candles with brilliant gold tails and colorful star breaks. 10 shots each.',
    price: 22.99, categoryId: 'cat-2',
    images: [fireworksImages[4]],
    featured: false, status: 'active', badges: ['new'], stock: 88, sku: 'FK-RC-002', tags: ['roman candle', 'comet'],
  },
  {
    id: 'p-12', title: 'Kaleidoscope 200-Shot Cake', description: 'A vibrant 200-shot fan cake creating a wide spread of multicolor effects including purple peonies and silver willows.',
    price: 124.99, categoryId: 'cat-4',
    images: [fireworksImages[5]],
    featured: false, status: 'active', badges: [], stock: 30, sku: 'FK-CK-002', tags: ['cake', 'fan'],
  },
  {
    id: 'p-13', title: 'Neon Dreams Smoke Sticks (6-pack)', description: 'Six individually colored smoke sticks in hot pink, electric blue, lime, orange, purple, and white. 60-second burn.',
    price: 29.99, categoryId: 'cat-5',
    images: [fireworksImages[0]],
    featured: false, status: 'active', badges: [], stock: 110, sku: 'FK-SM-002', tags: ['smoke', 'colorful'],
  },
  {
    id: 'p-14', title: 'Diamond Sparklers Wedding Pack', description: 'Elegant silver-tipped sparklers with slow burn for send-off photos. Includes heart-shaped wands. 50-pack.',
    price: 38.99, categoryId: 'cat-3',
    images: [fireworksImages[1]],
    featured: false, status: 'active', badges: ['bestseller'], stock: 180, sku: 'FK-SP-002', tags: ['sparklers', 'wedding', 'premium'],
  },
  {
    id: 'p-15', title: 'Mini Finale Rack (Professional)', description: 'A rapid-fire finale rack of 25 pre-loaded 3-inch shells. The professional choice for spectacular endings.',
    price: 399.99, comparePrice: 449.99, categoryId: 'cat-1',
    images: [fireworksImages[2]],
    featured: false, status: 'draft', badges: ['new'], stock: 5, sku: 'FK-AS-PRO-001', tags: ['professional', 'finale', 'rack'],
  },
];

export const mockCustomers: Customer[] = [
  { id: 'cust-1', name: 'James Whitmore', email: 'james@example.com', phone: '416-555-0101', totalOrders: 5, totalSpent: 623.45, joinedAt: '2024-03-12', address: { street: '123 Maple Ave', city: 'Toronto', province: 'ON', postalCode: 'M5V 2T6' } },
  { id: 'cust-2', name: 'Sarah Chen', email: 'sarah.chen@example.com', phone: '604-555-0192', totalOrders: 3, totalSpent: 412.97, joinedAt: '2024-05-08', address: { street: '456 Oak St', city: 'Vancouver', province: 'BC', postalCode: 'V6B 1A1' } },
  { id: 'cust-3', name: 'Marco DiLorenzo', email: 'mdilorenzo@example.com', phone: '514-555-0243', totalOrders: 8, totalSpent: 1842.30, joinedAt: '2023-11-20', address: { street: '789 Elm Blvd', city: 'Montreal', province: 'QC', postalCode: 'H2Y 1B7' } },
  { id: 'cust-4', name: 'Priya Sharma', email: 'priya.s@example.com', totalOrders: 1, totalSpent: 89.99, joinedAt: '2025-01-15' },
  { id: 'cust-5', name: 'Kevin O\'Brien', email: 'kobrien@example.com', phone: '780-555-0312', totalOrders: 12, totalSpent: 3201.80, joinedAt: '2023-07-04', address: { street: '321 Birch Lane', city: 'Edmonton', province: 'AB', postalCode: 'T5J 3G7' } },
];

export const mockOrders: Order[] = [
  {
    id: 'ORD-2025-0001', customerId: 'cust-1', customerName: 'James Whitmore', customerEmail: 'james@example.com',
    items: [
      { productId: 'p-1', title: 'Phoenix Rising Shell Kit', price: 89.99, quantity: 2, image: fireworksImages[0] },
      { productId: 'p-4', title: 'Golden Rain Sparklers (20-pack)', price: 18.99, quantity: 3, image: fireworksImages[3] },
    ],
    subtotal: 236.95, shipping: 15.00, total: 251.95,
    status: 'delivered', createdAt: '2025-07-04T14:32:00Z',
    shippingAddress: { street: '123 Maple Ave', city: 'Toronto', province: 'ON', postalCode: 'M5V 2T6' },
    shippingMethod: 'Standard Shipping',
  },
  {
    id: 'ORD-2025-0002', customerId: 'cust-2', customerName: 'Sarah Chen', customerEmail: 'sarah.chen@example.com',
    items: [{ productId: 'p-5', title: 'Supernova 500-Shot Cake', price: 299.99, quantity: 1, image: fireworksImages[4] }],
    subtotal: 299.99, shipping: 25.00, total: 324.99,
    status: 'shipped', createdAt: '2025-08-10T09:15:00Z',
    shippingAddress: { street: '456 Oak St', city: 'Vancouver', province: 'BC', postalCode: 'V6B 1A1' },
    shippingMethod: 'Express Shipping',
  },
  {
    id: 'ORD-2025-0003', customerId: 'cust-3', customerName: 'Marco DiLorenzo', customerEmail: 'mdilorenzo@example.com',
    items: [
      { productId: 'p-3', title: 'Dragon\'s Breath Roman Candles', price: 34.99, quantity: 4, image: fireworksImages[2] },
      { productId: 'p-7', title: 'Color Cascade Fountain', price: 24.99, quantity: 2, image: fireworksImages[0] },
    ],
    subtotal: 189.94, shipping: 15.00, total: 204.94,
    status: 'processing', createdAt: '2025-09-01T16:45:00Z',
    shippingAddress: { street: '789 Elm Blvd', city: 'Montreal', province: 'QC', postalCode: 'H2Y 1B7' },
    shippingMethod: 'Standard Shipping',
  },
  {
    id: 'ORD-2025-0004', customerId: 'cust-5', customerName: 'Kevin O\'Brien', customerEmail: 'kobrien@example.com',
    items: [
      { productId: 'p-2', title: 'Inferno Aerial Barrage', price: 149.99, quantity: 2, image: fireworksImages[1] },
      { productId: 'p-9', title: 'Thunderstruck Shell Assortment', price: 189.99, quantity: 1, image: fireworksImages[2] },
    ],
    subtotal: 489.97, shipping: 0, total: 489.97,
    status: 'confirmed', createdAt: '2025-09-15T11:00:00Z',
    shippingAddress: { street: '321 Birch Lane', city: 'Edmonton', province: 'AB', postalCode: 'T5J 3G7' },
    shippingMethod: 'Free Shipping (Order over $400)',
  },
  {
    id: 'ORD-2025-0005', customerName: 'Guest User', customerEmail: 'guest@example.com',
    items: [{ productId: 'p-6', title: 'Chromatic Smoke Grenade Set', price: 42.99, quantity: 1, image: fireworksImages[5] }],
    subtotal: 42.99, shipping: 10.00, total: 52.99,
    status: 'pending', createdAt: '2025-09-18T20:00:00Z',
    shippingAddress: { street: '100 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5X 1B8' },
    shippingMethod: 'Standard Shipping',
  },
];

export const mockFAQs: FAQ[] = [
  { id: 'faq-1', question: 'Do you ship across Canada?', answer: 'Yes! We ship to all provinces and territories across Canada. Please note that some remote areas may have longer delivery times. Shipping rates are calculated at checkout.', sortOrder: 1 },
  { id: 'faq-2', question: 'Are your fireworks legal?', answer: 'All products on fireking.ca comply with Canadian regulations. Consumer fireworks (F1 and F2 categories) are available to the general public. Professional-grade fireworks (F3/F4) require a valid permit. Always check your local municipal bylaws before use.', sortOrder: 2 },
  { id: 'faq-3', question: 'What is your return policy?', answer: 'Due to safety regulations, we cannot accept returns on opened fireworks products. Unopened items in original packaging may be returned within 30 days of purchase. Contact our support team to initiate a return.', sortOrder: 3 },
  { id: 'faq-4', question: 'What age is required to purchase?', answer: 'You must be 18 years or older to purchase fireworks. By placing an order, you confirm that you meet the legal age requirement in your province or territory.', sortOrder: 4 },
  { id: 'faq-5', question: 'How should I store fireworks safely?', answer: 'Store fireworks in a cool, dry place away from heat sources and direct sunlight. Keep them out of reach of children and pets. Never store fireworks in your vehicle or near flammable materials. Follow all instructions on the packaging.', sortOrder: 5 },
  { id: 'faq-6', question: 'Do you offer bulk or event discounts?', answer: 'Absolutely! We offer competitive pricing for event organizers, festivals, and bulk purchasers. Contact our team at info@firekingfireworks.ca with your requirements and we\'ll put together a custom quote.', sortOrder: 6 },
];

export const mockDiscounts: Discount[] = [
  { id: 'disc-1', type: 'percentage', code: 'SUMMER25', value: 25, active: true, minOrder: 100, expiresAt: '2025-10-31', usageCount: 42 },
  { id: 'disc-2', type: 'fixed', code: 'WELCOME15', value: 15, active: true, usageCount: 128 },
  { id: 'disc-3', type: 'category', value: 10, categoryId: 'cat-3', active: true, usageCount: 0 },
  { id: 'disc-4', type: 'percentage', code: 'FLASH50', value: 50, active: false, minOrder: 200, expiresAt: '2025-08-01', usageCount: 19 },
];
