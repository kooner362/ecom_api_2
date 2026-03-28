import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { Discount } from '@/data/mockData';
import { ecomApi } from '@/lib/ecom-api';

type DiscountRow = Discount & {
  source: 'coupon' | 'category';
  sourceId: string;
};

export default function AdminDiscounts() {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Discount, 'id' | 'usageCount'>>({ type: 'percentage', code: '', value: 10, active: true });
  const [items, setItems] = useState<DiscountRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDiscounts = async () => {
    const [coupons, categories] = await Promise.all([ecomApi.admin.couponDiscounts(), ecomApi.admin.categoryDiscounts()]);

    const couponRows: DiscountRow[] = (coupons.items || []).map((coupon: any) => ({
      id: `coupon:${coupon.id}`,
      source: 'coupon',
      sourceId: coupon.id,
      type: coupon.type === 'FIXED' ? 'fixed' : 'percentage',
      code: coupon.code,
      value: coupon.type === 'FIXED' ? (coupon.amountCents || 0) / 100 : (coupon.percentBps || 0) / 100,
      categoryId: undefined,
      active: !!coupon.enabled,
      usageCount: 0,
      minOrder: coupon.minSubtotalCents ? coupon.minSubtotalCents / 100 : undefined,
      expiresAt: coupon.expiresAt || undefined,
    }));

    const categoryRows: DiscountRow[] = (categories.items || []).map((discount: any) => ({
      id: `category:${discount.id}`,
      source: 'category',
      sourceId: discount.id,
      type: 'category',
      code: undefined,
      value: discount.type === 'FIXED' ? (discount.amountCents || 0) / 100 : (discount.percentBps || 0) / 100,
      categoryId: discount.categoryId,
      active: !!discount.enabled,
      usageCount: 0,
      expiresAt: discount.endsAt || undefined,
    }));

    setItems([...couponRows, ...categoryRows]);
  };

  useEffect(() => {
    void loadDiscounts().catch(() => setError('Failed to load discounts'));
  }, []);

  const save = async () => {
    setError(null);
    try {
      if (form.type === 'category') {
        if (!form.categoryId) {
          setError('Category is required for category discounts');
          return;
        }
        await ecomApi.admin.createCategoryDiscount({
          categoryId: form.categoryId,
          enabled: form.active,
          type: 'PERCENT',
          percentBps: Math.round((form.value || 0) * 100),
        });
      } else {
        if (!form.code) {
          setError('Coupon code is required');
          return;
        }
        await ecomApi.admin.createCouponDiscount({
          code: form.code.toUpperCase(),
          enabled: form.active,
          type: form.type === 'fixed' ? 'FIXED' : 'PERCENT',
          percentBps: form.type === 'percentage' ? Math.round((form.value || 0) * 100) : undefined,
          amountCents: form.type === 'fixed' ? Math.round((form.value || 0) * 100) : undefined,
        });
      }

      setAdding(false);
      setForm({ type: 'percentage', code: '', value: 10, active: true });
      await loadDiscounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to save discount');
    }
  };

  const toggleDiscount = async (discount: DiscountRow) => {
    setError(null);
    try {
      if (discount.source === 'coupon') {
        await ecomApi.admin.updateCouponDiscount(discount.sourceId, { enabled: !discount.active });
      } else {
        await ecomApi.admin.updateCategoryDiscount(discount.sourceId, { enabled: !discount.active });
      }
      await loadDiscounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to update discount');
    }
  };

  const deleteDiscount = async (discount: DiscountRow) => {
    setError(null);
    try {
      if (discount.source === 'coupon') {
        await ecomApi.admin.deleteCouponDiscount(discount.sourceId);
      } else {
        await ecomApi.admin.deleteCategoryDiscount(discount.sourceId);
      }
      await loadDiscounts();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete discount');
    }
  };

  const rows = useMemo(() => items, [items]);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-700">Discounts</h1>
        <button onClick={() => setAdding(true)} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add Discount</button>
      </div>
      {adding && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className="input-clean">
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed Amount $</option>
                <option value="category">Category Discount</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium mb-1">Value</label><input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) }))} className="input-clean" /></div>
            {form.type !== 'category' && <div><label className="block text-xs font-medium mb-1">Coupon Code</label><input value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="input-clean font-mono" placeholder="SUMMER25" /></div>}
            {form.type === 'category' && <div><label className="block text-xs font-medium mb-1">Category</label>
              <select value={form.categoryId || ''} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="input-clean">
                <option value="">All</option>
                {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => void save()} className="btn-fire py-2 px-4 text-sm">Save</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40"><tr>{['Code','Type','Value','Used','Active',''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map(d => (
              <tr key={d.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono font-semibold">{d.code || `Cat: ${state.categories.find(c => c.id === d.categoryId)?.name}`}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{d.type}</td>
                <td className="px-4 py-3 font-700">{d.type === 'percentage' ? `${d.value}%` : `$${d.value}`}</td>
                <td className="px-4 py-3">{d.usageCount}</td>
                <td className="px-4 py-3">
                  <button onClick={() => void toggleDiscount(d)}>
                    {d.active ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                  </button>
                </td>
                <td className="px-4 py-3"><button onClick={() => void deleteDiscount(d)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
