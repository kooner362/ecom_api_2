import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, Menu, X, ChevronDown, FlaskConical } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { useStore } from '@/contexts/StoreContext';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'FAQ', href: '/faq' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function StorefrontHeader() {
  const { state, cartCount } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
      setSearchOpen(false);
      setSearchVal('');
    }
  };

  return (
    <header style={{ backgroundColor: state.theme.headerBgColor }} className="sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: state.theme.primaryColor }}>
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-700 text-white text-xl tracking-tight">{state.storeSettings.name}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 ml-6">
            {navLinks.map(link => (
              link.label === 'Shop' ? null :
              <Link key={link.label} to={link.href} className="px-3 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors rounded-md hover:bg-white/8">
                {link.label}
              </Link>
            ))}
            {/* Shop + Categories dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors rounded-md hover:bg-white/8"
                onMouseEnter={() => setCatOpen(true)} onMouseLeave={() => setCatOpen(false)}
              >
                <Link to="/shop" className="hover:text-white" onClick={() => setCatOpen(false)}>Shop</Link>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", catOpen && "rotate-180")} />
              </button>
              {catOpen && (
                <div
                  className="absolute top-full left-0 mt-1 w-52 bg-card rounded-xl border border-border shadow-lg py-2 animate-scale-in"
                  onMouseEnter={() => setCatOpen(true)} onMouseLeave={() => setCatOpen(false)}
                >
                  <Link to="/shop" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors font-medium text-foreground">
                    All Products
                  </Link>
                  <div className="h-px bg-border mx-4 my-1" />
                  {state.categories.map(cat => (
                    <Link key={cat.id} to={`/category/${cat.slug}`} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors text-foreground/80 hover:text-foreground">
                      <CategoryIcon name={cat.icon} size={16} className="text-muted-foreground" />{cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Search */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input
                  ref={searchRef}
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  placeholder="Search products…"
                  className="bg-white/10 text-white placeholder:text-white/50 text-sm rounded-lg px-3 py-1.5 border border-white/20 focus:outline-none focus:border-white/40 w-48 sm:w-64"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="p-2 text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/8">
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* User */}
            <div className="relative">
              <button
                onClick={() => setUserOpen(!userOpen)}
                className="p-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/8"
              >
                <User className="w-5 h-5" />
              </button>
              {userOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-card rounded-xl border border-border shadow-lg py-2 animate-scale-in">
                  {state.user ? (
                    <>
                      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border mb-1">
                        Signed in as<br /><span className="font-medium text-foreground truncate block">{state.user.email}</span>
                      </div>
                      <Link to="/account" className="block px-4 py-2 text-sm hover:bg-muted" onClick={() => setUserOpen(false)}>My Account</Link>
                      <Link to="/account/orders" className="block px-4 py-2 text-sm hover:bg-muted" onClick={() => setUserOpen(false)}>Order History</Link>
                    </>
                  ) : (
                    <>
                      <Link to="/account/login" className="block px-4 py-2 text-sm hover:bg-muted" onClick={() => setUserOpen(false)}>Sign In</Link>
                      <Link to="/account/register" className="block px-4 py-2 text-sm hover:bg-muted" onClick={() => setUserOpen(false)}>Create Account</Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/8">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: state.theme.primaryColor }}>
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile menu */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-white/70 hover:text-white">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-card border-t border-border animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <Link key={link.label} to={link.href} className="block px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg" onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <div className="pt-1 pb-1 border-t border-border mt-2">
              <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">Categories</p>
              {state.categories.map(cat => (
                <Link key={cat.id} to={`/category/${cat.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg" onClick={() => setMobileOpen(false)}>
                  <CategoryIcon name={cat.icon} size={16} className="text-muted-foreground" /> {cat.name}
                </Link>
              ))}
            </div>
            <Link to="/admin" className="block px-3 py-2.5 text-sm font-medium text-primary border border-primary/30 rounded-lg text-center mt-2" onClick={() => setMobileOpen(false)}>
              Admin Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
