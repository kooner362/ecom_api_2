import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Package, CreditCard } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { Order } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { ecomApi } from '@/lib/ecom-api';

const provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

const providerLogos: Record<string, string> = { stripe: '💳', other: '🏦' };

export default function CheckoutPage() {
  const { state, dispatch, cartTotal, getMatchingTaxRate, activePaymentProvider, refreshFromApi, isCustomerAuthenticated } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string>(() => {
    const first = state.shippingMethods.find(m => m.enabled);
    return first?.id ?? '';
  });
  const [savedAddresses, setSavedAddresses] = useState<Array<any>>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    street: '', city: '', province: 'ON', postalCode: '',
    cardName: '', cardNum: '', expiry: '', cvv: ''
  });

  const enabledShippingMethods = state.shippingMethods.filter(m => m.enabled);
  const selectedMethod = enabledShippingMethods.find(m => m.id === selectedShippingId);
  const shippingCost = selectedMethod?.amount ?? 0;

  const taxRate = getMatchingTaxRate(form.province);
  const taxAmount = state.taxSettings.enabled ? (cartTotal + shippingCost) * (taxRate / 100) : 0;
  const total = cartTotal + shippingCost + taxAmount;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const loadAddresses = async () => {
    if (!isCustomerAuthenticated) return;
    try {
      const response = await ecomApi.store.addresses();
      setSavedAddresses(response.items || []);
      const defaultAddress = (response.items || []).find((item) => item.isDefault);
      const selected = defaultAddress?.id || response.items?.[0]?.id || '';
      setSelectedAddressId(selected);
      if (defaultAddress) {
        setForm((prev) => ({
          ...prev,
          name: defaultAddress.name || prev.name,
          phone: defaultAddress.phone || prev.phone,
          street: defaultAddress.line1 || prev.street,
          city: defaultAddress.city || prev.city,
          province: defaultAddress.province || prev.province,
          postalCode: defaultAddress.postalCode || prev.postalCode
        }));
      }
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, [isCustomerAuthenticated]);

  useEffect(() => {
    if (!isCustomerAuthenticated || !state.user?.email) {
      return;
    }

    setForm((prev) => {
      if (prev.email === state.user?.email) {
        return prev;
      }
      return {
        ...prev,
        email: state.user.email
      };
    });
  }, [isCustomerAuthenticated, state.user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isCustomerAuthenticated) {
      try {
        const shippingMethodType = selectedMethod?.type === 'pickup'
          ? 'PICKUP'
          : selectedMethod?.type === 'local_delivery'
            ? 'LOCAL_DELIVERY'
            : 'FLAT_RATE';

        let shippingAddressId: string | undefined;
        if (shippingMethodType !== 'PICKUP') {
          shippingAddressId = selectedAddressId;
          if (!shippingAddressId) {
            const createdAddress = await ecomApi.store.createAddress({
              name: form.name,
              line1: form.street,
              city: form.city,
              province: form.province,
              country: 'CA',
              postalCode: form.postalCode,
              phone: form.phone,
              isDefault: savedAddresses.length === 0
            });
            shippingAddressId = createdAddress.id;
            await loadAddresses();
          }
        }

        const paymentIntent = await ecomApi.store.createPaymentIntent({
          shippingMethodType,
          shippingAddressId
        });

        const order = await ecomApi.store.confirmCheckout({
          shippingMethodType,
          shippingAddressId,
          paymentIntentId: paymentIntent.paymentIntentId
        });

        setOrderId(order.orderNumber || order.id);
        setStep('success');
        await refreshFromApi();
        return;
      } catch (err: any) {
        setError(err?.message || 'Checkout failed');
        return;
      }
    }

    const id = `ORD-2025-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const order: Order = {
      id,
      customerName: form.name,
      customerEmail: form.email,
      items: state.cart.map(i => ({ productId: i.productId, title: i.title, price: i.price, quantity: i.quantity, image: i.image })),
      subtotal: cartTotal,
      shipping: shippingCost,
      total,
      status: 'pending',
      createdAt: new Date().toISOString(),
      shippingAddress: { street: form.street, city: form.city, province: form.province, postalCode: form.postalCode },
      shippingMethod: selectedMethod?.name ?? 'Standard',
    };
    dispatch({ type: 'ADD_ORDER', payload: order });
    setOrderId(id);
    setStep('success');
    dispatch({ type: 'CLEAR_CART' });
  };

  if (step === 'success') return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-9 h-9 text-success" />
      </div>
      <h1 className="font-display text-2xl font-700 mb-2">Order Placed!</h1>
      <p className="text-muted-foreground mb-1">Thank you for your order.</p>
      <p className="text-sm font-semibold text-foreground mb-6">Order #{orderId}</p>
      <p className="text-sm text-muted-foreground mb-8">A confirmation will be sent to <strong>{form.email}</strong>. We'll notify you when your order ships.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => navigate('/')} className="btn-fire">Continue Shopping</button>
        <button onClick={() => navigate('/account/orders')} className="px-5 py-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">View Orders</button>
      </div>
    </div>
  );

  if (state.cart.length === 0) { navigate('/cart'); return null; }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl font-700 mb-8">Checkout</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Info */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="font-display font-700 text-lg mb-5">Shipping Information</h2>
              {isCustomerAuthenticated && savedAddresses.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1.5">Saved Addresses</label>
                  <select
                    className="input-clean"
                    value={selectedAddressId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedAddressId(id);
                      const selected = savedAddresses.find((item) => item.id === id);
                      if (selected) {
                        setForm((prev) => ({
                          ...prev,
                          name: selected.name || prev.name,
                          phone: selected.phone || prev.phone,
                          street: selected.line1 || prev.street,
                          city: selected.city || prev.city,
                          province: selected.province || prev.province,
                          postalCode: selected.postalCode || prev.postalCode
                        }));
                      }
                    }}
                  >
                    {savedAddresses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - {item.line1}, {item.city} {item.province}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Full Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} required className="input-clean" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} required className="input-clean" placeholder="jane@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="input-clean" placeholder="416-555-0100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Street Address *</label>
                  <input name="street" value={form.street} onChange={handleChange} required className="input-clean" placeholder="123 Main St" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">City *</label>
                  <input name="city" value={form.city} onChange={handleChange} required className="input-clean" placeholder="Toronto" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Province *</label>
                    <select name="province" value={form.province} onChange={handleChange} required className="input-clean">
                      {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Postal Code *</label>
                    <input name="postalCode" value={form.postalCode} onChange={handleChange} required className="input-clean" placeholder="M5V 2T6" />
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Method — driven by Admin Shipping Settings */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="font-display font-700 text-lg mb-5">Shipping Method</h2>
              {enabledShippingMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shipping methods are currently available. Please contact us.</p>
              ) : (
                <div className="space-y-3">
                  {enabledShippingMethods.map(method => (
                    <label key={method.id} className={cn("flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors", selectedShippingId === method.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}>
                      <input type="radio" name="shipping" value={method.id} checked={selectedShippingId === method.id} onChange={e => setSelectedShippingId(e.target.value)} className="accent-primary" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{method.name}</p>
                          <p className="text-sm font-700 font-display">{method.amount === 0 ? 'FREE' : `$${method.amount.toFixed(2)}`}</p>
                        </div>
                        {method.description && <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>}
                        {method.type === 'pickup' && method.pickupInstructions && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{method.pickupInstructions}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Payment — driven by Admin Payment Settings */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-display font-700 text-lg">Payment</h2>
                {activePaymentProvider && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground flex items-center gap-1">
                    {providerLogos[activePaymentProvider.id]} {activePaymentProvider.name}
                  </span>
                )}
              </div>

              {activePaymentProvider?.id === 'other' ? (
                <div className="p-4 bg-muted/40 rounded-xl text-sm text-muted-foreground">
                  <p className="text-xs text-muted-foreground mb-5">E-Transfer.</p>
                  <strong>Manual Payment:</strong> You'll receive payment instructions by email after placing your order.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Name on Card *</label>
                    <input name="cardName" value={form.cardName} onChange={handleChange} required className="input-clean" placeholder="Jane Smith" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Card Number *</label>
                    <div className="relative">
                      <input name="cardNum" value={form.cardNum} onChange={handleChange} required className="input-clean pr-10" placeholder="•••• •••• •••• ••••" maxLength={19} />
                      <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Expiry *</label>
                    <input name="expiry" value={form.expiry} onChange={handleChange} required className="input-clean" placeholder="MM/YY" maxLength={5} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">CVV *</label>
                    <input name="cvv" value={form.cvv} onChange={handleChange} required className="input-clean" placeholder="•••" maxLength={4} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
              <h2 className="font-display font-700 text-lg mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {state.cart.map(item => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🎆</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold shrink-0">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}</span></div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({taxRate}% {form.province})</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxAmount === 0 && state.taxSettings.enabled && (
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>Tax</span><span>No tax rule for {form.province}</span>
                  </div>
                )}
                <div className="flex justify-between font-display font-700 text-base pt-2 border-t border-border">
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
              </div>
              <button type="submit" className="btn-fire w-full mt-5 py-3.5 justify-center">
                <Package className="w-4 h-4" /> Place Order
              </button>
              {error && <p className="text-xs text-destructive mt-3">{error}</p>}
              <p className="text-xs text-muted-foreground text-center mt-3">You must be 18+ to purchase fireworks.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
