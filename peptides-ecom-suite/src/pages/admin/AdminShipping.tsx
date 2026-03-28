import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Truck, MapPin, Store, Info } from 'lucide-react';
import { ShippingMethod } from '@/contexts/StoreContext';
import { ecomApi } from '@/lib/ecom-api';

const typeIcons = { flat_rate: Truck, local_delivery: MapPin, pickup: Store };
const typeLabels = { flat_rate: 'Flat Rate', local_delivery: 'Local Delivery', pickup: 'In-Store Pickup' };

const emptyMethod: Omit<ShippingMethod, 'id'> = {
  type: 'flat_rate', name: '', enabled: true, amount: 0, description: '', postalPrefixes: '', pickupInstructions: '',
};

export default function AdminShipping() {
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Omit<ShippingMethod, 'id'>>(emptyMethod);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMethods = async () => {
    const response = await ecomApi.admin.shippingMethods();
    const mapped: ShippingMethod[] = (response.items || []).map((method) => {
      const type = method.type === 'LOCAL_DELIVERY' ? 'local_delivery' : method.type === 'PICKUP' ? 'pickup' : 'flat_rate';
      const config = method.configJson || {};
      const amountCents = typeof config.amountCents === 'number' ? config.amountCents : 0;
      const postalPrefixes = Array.isArray(config.postalPrefixes) ? config.postalPrefixes.join(',') : '';
      const pickupInstructions = typeof config.instructions === 'string' ? config.instructions : '';
      return {
        id: method.id || method.type,
        type,
        name: method.name,
        enabled: !!method.enabled,
        amount: amountCents / 100,
        description: '',
        postalPrefixes,
        pickupInstructions,
      };
    });
    setShippingMethods(mapped);
  };

  useEffect(() => {
    void loadMethods().catch(() => setError('Failed to load shipping settings'));
  }, []);

  const openNew = () => { setForm(emptyMethod); setEditing(null); setIsNew(true); };
  const openEdit = (m: ShippingMethod) => { setForm({ ...m }); setEditing(m); setIsNew(false); };
  const close = () => { setEditing(null); setIsNew(false); };

  const save = async () => {
    setError(null);
    try {
      const currentType = form.type === 'local_delivery' ? 'LOCAL_DELIVERY' : form.type === 'pickup' ? 'PICKUP' : 'FLAT_RATE';
      const configJson =
        form.type === 'pickup'
          ? { instructions: form.pickupInstructions || '' }
          : form.type === 'local_delivery'
            ? {
                amountCents: Math.round((form.amount || 0) * 100),
                postalPrefixes: (form.postalPrefixes || '')
                  .split(',')
                  .map((prefix) => prefix.trim())
                  .filter(Boolean),
              }
            : { amountCents: Math.round((form.amount || 0) * 100) };

      await ecomApi.admin.updateShippingMethod(currentType, {
        enabled: form.enabled,
        name: form.name,
        configJson,
      });
      await loadMethods();
      close();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save shipping method');
    }
  };

  const toggle = async (m: ShippingMethod) => {
    setError(null);
    try {
      const type = m.type === 'local_delivery' ? 'LOCAL_DELIVERY' : m.type === 'pickup' ? 'PICKUP' : 'FLAT_RATE';
      await ecomApi.admin.updateShippingMethod(type, { enabled: !m.enabled });
      await loadMethods();
    } catch (err: any) {
      setError(err?.message || 'Failed to update shipping method');
    }
  };
  const del = async (method: ShippingMethod) => {
    if (!confirm('Disable this shipping method?')) return;
    await toggle(method);
  };

  const modalOpen = isNew || !!editing;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-700">Shipping Settings</h1>
        <button onClick={openNew} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add Method</button>
      </div>
      <p className="text-muted-foreground text-sm mb-6">Only enabled shipping methods appear at checkout.</p>

      <div className="space-y-3">
        {shippingMethods.map(m => {
          const Icon = typeIcons[m.type];
          return (
            <div key={m.id} className={`bg-card border rounded-xl p-4 flex items-start gap-4 transition-opacity ${m.enabled ? '' : 'opacity-50'}`}>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{typeLabels[m.type]}</span>
                  {!m.enabled && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Disabled</span>}
                </div>
                {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                <p className="text-sm font-display font-700 mt-1">{m.amount === 0 ? 'Free' : `$${m.amount.toFixed(2)}`}</p>
                {m.type === 'local_delivery' && m.postalPrefixes && (
                  <p className="text-xs text-muted-foreground mt-0.5">Postal prefixes: {m.postalPrefixes}</p>
                )}
                {m.type === 'pickup' && m.pickupInstructions && (
                  <p className="text-xs text-muted-foreground mt-0.5">{m.pickupInstructions}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(m)} className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${m.enabled ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}>
                  {m.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => void del(m)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}
        {shippingMethods.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
            <Truck className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No shipping methods configured.</p>
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-muted/40 border border-border rounded-xl flex gap-3">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">Customers will only see <strong>enabled</strong> shipping methods at checkout. Local Delivery methods can be restricted by postal code prefix (e.g., M5V will match M5V 2T6).</p>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-display font-700 text-lg">{isNew ? 'Add Shipping Method' : 'Edit Shipping Method'}</h2>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className="input-clean">
                <option value="flat_rate">Flat Rate</option>
                <option value="local_delivery">Local Delivery</option>
                <option value="pickup">In-Store Pickup</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-clean" placeholder="e.g. Standard Shipping" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-clean" placeholder="e.g. 5–7 business days" />
            </div>
            {form.type !== 'pickup' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Amount ($)</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="input-clean" />
                <p className="text-xs text-muted-foreground mt-1">Set to 0 for free.</p>
              </div>
            )}
            {form.type === 'local_delivery' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Postal Code Prefixes</label>
                <input value={form.postalPrefixes} onChange={e => setForm(f => ({ ...f, postalPrefixes: e.target.value }))} className="input-clean" placeholder="M5V,M5A,M4B (comma-separated)" />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to offer to all postal codes.</p>
              </div>
            )}
            {form.type === 'pickup' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Pickup Instructions</label>
                <textarea value={form.pickupInstructions} onChange={e => setForm(f => ({ ...f, pickupInstructions: e.target.value }))} className="input-clean h-20 resize-none" placeholder="Instructions shown to customer after placing order…" />
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="accent-primary" />
                Enabled at checkout
              </label>
              <div className="flex gap-2">
                <button onClick={close} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={() => void save()} className="btn-fire py-2 px-4 text-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {saved && <p className="text-sm text-success mt-4">Saved shipping settings.</p>}
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
