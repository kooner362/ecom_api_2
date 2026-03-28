import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { Category } from '@/data/mockData';
import { ecomApi } from '@/lib/ecom-api';

const empty: Omit<Category, 'id'> = { name: '', slug: '', description: '', emoji: '', sortOrder: 99 };

export default function AdminCategories() {
  const { state, refreshFromApi } = useStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Category, 'id'>>(empty);
  const [error, setError] = useState<string | null>(null);

  const startAdd = () => { setForm(empty); setAdding(true); setEditing(null); };
  const startEdit = (c: Category) => { setForm(c); setEditing(c); setAdding(false); };
  const cancel = () => { setAdding(false); setEditing(null); };

  const save = async () => {
    setError(null);
    try {
      if (adding) {
        await ecomApi.admin.createCategory({
          name: form.name,
          description: form.description,
          sortOrder: form.sortOrder,
          isActive: true,
        });
      } else if (editing) {
        await ecomApi.admin.updateCategory(editing.id, {
          name: form.name,
          description: form.description,
          sortOrder: form.sortOrder,
          isActive: true,
        });
      }
      await refreshFromApi();
      cancel();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category');
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    setError(null);
    try {
      await ecomApi.admin.deleteCategory(id);
      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete category');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-display text-2xl font-700">Categories</h1></div>
        <button onClick={startAdd} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add Category</button>
      </div>

      {(adding || editing) && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4 animate-fade-in">
          <h2 className="font-display font-600">{adding ? 'New Category' : 'Edit Category'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className="input-clean" /></div>
            <div><label className="block text-xs font-medium mb-1">Slug</label><input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="input-clean" /></div>
            <div><label className="block text-xs font-medium mb-1">Sort Order</label><input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) }))} className="input-clean" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium mb-1">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-clean" /></div>
          </div>
          <div className="flex gap-2"><button onClick={() => void save()} className="btn-fire py-2 px-4 text-sm"><Check className="w-4 h-4" /> Save</button><button onClick={cancel} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button></div>
        </div>
      )}
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40"><tr>{['Name','Slug','Products','Order',''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {[...state.categories].sort((a, b) => a.sortOrder - b.sortOrder).map(cat => {
              const count = state.products.filter(p => p.categoryId === cat.id).length;
              return (
                <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{cat.name}<p className="text-xs text-muted-foreground">{cat.description}</p></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{cat.slug}</td>
                  <td className="px-4 py-3">{count}</td>
                  <td className="px-4 py-3">{cat.sortOrder}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => startEdit(cat)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button><button onClick={() => void del(cat.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
