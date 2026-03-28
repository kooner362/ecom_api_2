import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/contexts/StoreContext';
import { Package, LogOut, User, ChevronRight } from 'lucide-react';

export default function AccountPage() {
  const { state, customerLogin, customerRegister, customerLogout, isCustomerAuthenticated } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register' | 'account' | 'orders'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (tab === 'register') {
        await customerRegister({ name: form.name, email: form.email, password: form.password });
      } else {
        await customerLogin({ email: form.email, password: form.password });
      }
      setTab('account');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await customerLogout();
    setTab('login');
  };

  const myOrders = state.orders.filter(o => o.customerEmail === state.user?.email);

  if (state.user && isCustomerAuthenticated) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-700">{state.user.name}</h1>
          <p className="text-muted-foreground text-sm">{state.user.email}</p>
        </div>
        <button onClick={handleLogout} className="ml-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>

      <div className="flex gap-1 mb-8 border-b border-border">
        {(['account', 'orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'orders' ? 'Order History' : 'My Account'}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-display font-600 text-sm mb-3">Account Details</h3>
            <p className="text-sm text-muted-foreground">Name: <span className="text-foreground">{state.user.name}</span></p>
            <p className="text-sm text-muted-foreground mt-1">Email: <span className="text-foreground">{state.user.email}</span></p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-display font-600 text-sm mb-3">Quick Actions</h3>
            <button onClick={() => setTab('orders')} className="flex items-center justify-between w-full text-sm py-2 hover:text-primary transition-colors">
              <span>View Order History</span><ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div>
          {myOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-display font-600">No orders yet</p>
              <Link to="/shop" className="text-sm text-primary hover:underline mt-2 block">Start shopping</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map(order => (
                <div key={order.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-display font-600 text-sm">{order.id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-success/10 text-success' :
                      order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }`}>{order.status}</span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{item.title} × {item.quantity}</p>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                    <span className="font-display font-700 text-base">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="flex gap-1 mb-6 border-b border-border">
        {(['login', 'register'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>
      <form onSubmit={handleLogin} className="space-y-4">
        {tab === 'register' && (
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name *</label>
            <input name="name" value={form.name} onChange={handleChange} className="input-clean" placeholder="Jane Smith" required={tab === 'register'} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">Email *</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} required className="input-clean" placeholder="jane@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password *</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} required className="input-clean" placeholder="••••••••" />
        </div>
        <button type="submit" className="btn-fire w-full py-3 justify-center">
          {submitting ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
