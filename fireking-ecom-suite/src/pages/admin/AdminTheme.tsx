import { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { ThemeSettings } from '@/data/mockData';
import { ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from 'lucide-react';
import { ecomApi } from '@/lib/ecom-api';

const fonts: ThemeSettings['font'][] = ['Space Grotesk', 'Inter', 'Playfair Display'];

export default function AdminTheme() {
  const { state, dispatch, refreshFromApi } = useStore();
  const { theme } = state;
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<ThemeSettings>) => dispatch({ type: 'UPDATE_THEME', payload: partial });

  const save = async () => {
    setError(null);
    try {
      await ecomApi.admin.updateTheme(theme);
      await refreshFromApi();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save theme');
    }
  };

  const moveSection = (key: string, dir: -1 | 1) => {
    const arr = [...theme.sectionOrder];
    const i = arr.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({ sectionOrder: arr });
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-display text-2xl font-700 mb-2">Theme & Branding</h1>
      <p className="text-muted-foreground text-sm mb-6">Changes apply instantly to the storefront via localStorage.</p>

      <div className="space-y-5">
        {/* Colors */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-display font-600">Colors</h2>
          {[
            { label: 'Primary / Fire Color', key: 'primaryColor', desc: 'Used for buttons, accents, and badges.' },
            { label: 'Header Background', key: 'headerBgColor', desc: 'Background color of the storefront header.' },
            { label: 'Button Color', key: 'buttonColor', desc: 'Main call-to-action button color.' },
          ].map(({ label, key, desc }) => (
            <div key={key} className="flex items-center gap-4">
              <input type="color" value={(theme as any)[key]} onChange={e => update({ [key]: e.target.value } as any)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-600 mb-3">Font</h2>
          <div className="flex flex-wrap gap-3">
            {fonts.map(f => (
              <button key={f} onClick={() => update({ font: f })} className={`px-4 py-2 rounded-lg border-2 text-sm transition-colors ${theme.font === f ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30'}`} style={{ fontFamily: f }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-display font-600">Content</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tagline</label>
            <input value={theme.tagline} onChange={e => update({ tagline: e.target.value })} className="input-clean" placeholder="Your brand tagline…" />
            <p className="text-xs text-muted-foreground mt-1">Shown on hero section and footer.</p>
          </div>
        </div>

        {/* Section toggles */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-display font-600">Homepage Sections</h2>
          {[
            { key: 'showFeaturedSection', label: 'Featured Products', desc: 'Show featured products section on homepage.' },
            { key: 'showCategorySection', label: 'Category Highlights', desc: 'Show category browse section on homepage.' },
            { key: 'showNewsletterSection', label: 'Newsletter Signup', desc: 'Show newsletter subscription section.' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
              <button onClick={() => update({ [key]: !(theme as any)[key] } as any)}>
                {(theme as any)[key] ? <ToggleRight className="w-7 h-7 text-primary" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
              </button>
            </div>
          ))}
        </div>

        {/* Section order */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-600 mb-3">Section Order</h2>
          <p className="text-xs text-muted-foreground mb-3">Drag or use arrows to reorder homepage sections.</p>
          <div className="space-y-2">
            {theme.sectionOrder.map((key, i) => (
              <div key={key} className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium flex-1 capitalize">{key === 'newsletter' ? 'Newsletter Signup' : key === 'featured' ? 'Featured Products' : key === 'categories' ? 'Category Highlights' : 'Hero Banner'}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveSection(key, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveSection(key, 1)} disabled={i === theme.sectionOrder.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => void save()} className="btn-fire py-3 px-6">{saved ? '✓ Saved to Storefront!' : 'Save All Changes'}</button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
