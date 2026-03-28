import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';

export default function CartPage() {
  const { state, cartTotal, updateCartItemQty, removeCartItem } = useStore();
  const navigate = useNavigate();
  const shipping = cartTotal >= 200 ? 0 : cartTotal > 0 ? 15 : 0;
  const total = cartTotal + shipping;

  const updateQty = async (id: string, qty: number) => {
    await updateCartItemQty(id, qty);
  };

  if (state.cart.length === 0) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
      <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-5" />
      <h1 className="font-display text-2xl font-700 mb-2">Your cart is empty</h1>
      <p className="text-muted-foreground mb-6">Looks like you haven't added anything yet.</p>
      <Link to="/shop" className="btn-fire">Browse Products</Link>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl font-700 mb-8">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {state.cart.map(item => (
            <div key={item.id} className="flex gap-4 bg-card rounded-xl border border-border p-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted shrink-0">
                {item.image ? <img src={item.image} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎆</div>}
              </div>
              <div className="flex-1 min-w-0">
                  <Link to={`/product/${item.productId}`} className="font-display font-600 text-foreground hover:text-primary transition-colors line-clamp-2 text-sm sm:text-base">
                    {item.title}
                  </Link>
                <p className="text-muted-foreground text-sm mt-1">${item.price.toFixed(2)} each</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button onClick={() => void updateQty(item.id, item.quantity - 1)} className="px-2.5 py-1.5 hover:bg-muted transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="px-3 py-1.5 text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => void updateQty(item.id, item.quantity + 1)} className="px-2.5 py-1.5 hover:bg-muted transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-700 text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => void removeCartItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div>
          <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
            <h2 className="font-display font-700 text-lg mb-5">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? <span className="text-success font-medium">FREE</span> : `$${shipping.toFixed(2)}`}</span>
              </div>
              {shipping > 0 && <p className="text-xs text-muted-foreground">Free shipping on orders over $200</p>}
              <div className="border-t border-border pt-3 flex justify-between font-display font-700 text-base">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={() => navigate('/checkout')} className="btn-fire w-full mt-5 justify-center py-3.5">
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </button>
            <Link to="/shop" className="block text-center text-sm text-muted-foreground hover:text-foreground mt-3 transition-colors">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
