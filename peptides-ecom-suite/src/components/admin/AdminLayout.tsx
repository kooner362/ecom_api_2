import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, Tag, Warehouse, Users, Percent,
  Palette, Mail, FileText, Settings, Flame, Menu, X, ChevronRight, ExternalLink, Search,
  Truck, Receipt, CreditCard
} from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { cn } from '@/lib/utils';
import { ecomApi } from '@/lib/ecom-api';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Categories', href: '/admin/categories', icon: Tag },
  { label: 'Inventory', href: '/admin/inventory', icon: Warehouse },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Discounts', href: '/admin/discounts', icon: Percent },
  { label: 'Theme & Branding', href: '/admin/theme', icon: Palette },
  { label: 'Email Settings', href: '/admin/email', icon: Mail },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Taxes', href: '/admin/taxes', icon: Receipt },
  { label: 'Shipping', href: '/admin/shipping', icon: Truck },
  { label: 'Pages / FAQ', href: '/admin/pages', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, refreshFromApi } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [admin, setAdmin] = useState<{ email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const storeName = state.storeSettings?.name?.trim() || 'Store';
  const storeHost = (() => {
    const raw = state.storeSettings?.websiteUrl?.trim();
    if (!raw) return '';
    try {
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return new URL(withProtocol).hostname.replace(/^www\./i, '');
    } catch {
      return '';
    }
  })();

  const isActive = (item: typeof navItems[0]) =>
    item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);

  const ensureAdminSession = async () => {
    if (admin) return true;
    const token = ecomApi.getToken('admin');
    if (!token) {
      setAuthChecked(true);
      return false;
    }
    try {
      const me = await ecomApi.admin.me();
      setAdmin({ email: me.email });
      await refreshFromApi();
      setAuthChecked(true);
      return true;
    } catch {
      ecomApi.setToken('admin', null);
      setAdmin(null);
      setAuthChecked(true);
      return false;
    }
  };

  useEffect(() => {
    void ensureAdminSession();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const response = await ecomApi.admin.login(credentials);
      ecomApi.setToken('admin', response.accessToken);
      const me = await ecomApi.admin.me();
      setAdmin({ email: me.email });
      await refreshFromApi();
    } catch (err: any) {
      setAuthError(err?.message || 'Admin login failed');
    }
  };

  const handleAdminLogout = async () => {
    try {
      await ecomApi.admin.logout();
    } catch {
      // no-op
    }
    ecomApi.setToken('admin', null);
    setAdmin(null);
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!admin && !ecomApi.getToken('admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <form onSubmit={handleAdminLogin} className="w-full max-w-md bg-card border border-border rounded-xl p-6 space-y-4">
          <h1 className="font-display text-2xl font-700">Admin Login</h1>
          <p className="text-sm text-muted-foreground">Sign in with your `ecom_api` admin credentials.</p>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              className="input-clean"
              value={credentials.email}
              onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              className="input-clean"
              value={credentials.password}
              onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className="btn-fire w-full justify-center">Sign In</button>
          {authError && <p className="text-sm text-destructive">{authError}</p>}
        </form>
      </div>
    );
  }

  const Sidebar = ({ mobile = false }) => (
    <nav className={cn('flex flex-col h-full', mobile && 'pt-4')}>
      <div className="px-4 mb-6">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden bg-white/10 border border-sidebar-border">
            {state.storeSettings?.logoUrl ? (
              <img
                src={state.storeSettings.logoUrl}
                alt={`${storeName} logo`}
                className="w-6 h-6 object-contain"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary">
                <Flame className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <span className="font-display font-700 text-white text-lg">{storeName}</span>
        </Link>
        <p className="text-xs text-sidebar-foreground/50 mt-1 ml-9">
          {storeHost ? `${storeHost} · ` : ''}Admin Portal
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {navItems.map(item => {
          const active = isActive(item);
          return (
            <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)}
              className={cn('sidebar-link', active && 'active')}>
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </Link>
          );
        })}
      </div>

      <div className="px-3 pb-4 mt-4 border-t border-sidebar-border pt-4">
        <Link to="/" className="sidebar-link text-xs gap-2">
          <ExternalLink className="w-4 h-4" />
          <span>View Storefront</span>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-[hsl(var(--admin-sidebar-bg))] border-r border-sidebar-border">
        <div className="flex flex-col h-full py-5">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-[hsl(var(--admin-sidebar-bg))] h-full py-5 animate-slide-in-right">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 sm:px-6 gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-6 h-6 rounded-md overflow-hidden bg-muted/40 border border-border flex items-center justify-center">
              {state.storeSettings?.logoUrl ? (
                <img src={state.storeSettings.logoUrl} alt={`${storeName} logo`} className="w-5 h-5 object-contain" />
              ) : (
                <Flame className="w-3.5 h-3.5 text-primary" />
              )}
            </span>
            <span className="font-display font-600 text-foreground">{storeName}</span>
            <span>Admin</span>
          </div>
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input className="input-clean pl-8 py-1.5 text-xs h-8 bg-muted/50" placeholder="Quick search…" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{admin?.email}</span>
            <button onClick={() => void handleAdminLogout()} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted">
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
