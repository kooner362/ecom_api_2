import { Link } from 'react-router-dom';
import { FlaskConical, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';

export default function StorefrontFooter() {
  const { state } = useStore();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubscribed(true); setEmail(''); }
  };

  return (
    <footer className="bg-[hsl(220_22%_9%)] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: state.theme.primaryColor }}>
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-700 text-white text-xl">{state.storeSettings.name}</span>
            </div>
            <p className="text-sm leading-relaxed mb-5">{state.theme.tagline}</p>
            <div className="flex gap-3">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-display font-600 text-white text-sm mb-4 tracking-wide uppercase">Shop</h4>
            <ul className="space-y-2.5">
              <li><Link to="/shop" className="text-sm hover:text-white transition-colors">All Products</Link></li>
              {state.categories.slice(0, 5).map(cat => (
                <li key={cat.id}><Link to={`/category/${cat.slug}`} className="text-sm hover:text-white transition-colors">{cat.name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="font-display font-600 text-white text-sm mb-4 tracking-wide uppercase">Information</h4>
            <ul className="space-y-2.5">
              <li><Link to="/about" className="text-sm hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/faq" className="text-sm hover:text-white transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="text-sm hover:text-white transition-colors">Contact</Link></li>
              <li><a href="#" className="text-sm hover:text-white transition-colors">Shipping Policy</a></li>
              <li><a href="#" className="text-sm hover:text-white transition-colors">Return Policy</a></li>
              <li><a href="#" className="text-sm hover:text-white transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Newsletter + Contact */}
          <div>
            <h4 className="font-display font-600 text-white text-sm mb-4 tracking-wide uppercase">Stay in the Loop</h4>
            <p className="text-sm mb-4">Get exclusive research updates and new peptide arrivals in your inbox.</p>
            {subscribed ? (
              <div className="text-sm text-green-400 font-medium">🎉 You're subscribed!</div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="bg-white/10 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                  required
                />
                <button type="submit" className="btn-fire text-sm py-2.5">Subscribe</button>
              </form>
            )}
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Mail className="w-3.5 h-3.5" /> {state.storeSettings.email}</div>
              <div className="flex items-center gap-2 text-xs"><Phone className="w-3.5 h-3.5" /> {state.storeSettings.phone}</div>
              <div className="flex items-center gap-2 text-xs"><MapPin className="w-3.5 h-3.5" /> Canada-wide Shipping</div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs">© {new Date().getFullYear()} {state.storeSettings.name} — All rights reserved.</p>
          <p className="text-xs">For research purposes only. Not for human consumption.</p>
        </div>
      </div>
    </footer>
  );
}
