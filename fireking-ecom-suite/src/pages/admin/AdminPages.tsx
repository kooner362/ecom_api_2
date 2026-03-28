import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { FAQ } from '@/data/mockData';
import { ecomApi } from '@/lib/ecom-api';

export default function AdminPages() {
  const { state, refreshFromApi } = useStore();
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', sortOrder: 99 });
  const [error, setError] = useState<string | null>(null);

  const startAdd = () => { setForm({ question: '', answer: '', sortOrder: state.faqs.length + 1 }); setAdding(true); setEditing(null); };
  const startEdit = (f: FAQ) => { setForm(f); setEditing(f); setAdding(false); };
  const cancel = () => { setAdding(false); setEditing(null); };

  const save = async () => {
    setError(null);
    try {
      if (adding) {
        await ecomApi.admin.createFaq(form);
      } else if (editing) {
        await ecomApi.admin.updateFaq(editing.id, form);
      }
      await refreshFromApi();
      cancel();
    } catch (err: any) {
      setError(err?.message || 'Failed to save FAQ');
    }
  };

  const removeFaq = async (id: string) => {
    setError(null);
    try {
      await ecomApi.admin.deleteFaq(id);
      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete FAQ');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-display text-2xl font-700">FAQ Management</h1><p className="text-muted-foreground text-sm">Manage FAQ entries shown on the storefront.</p></div>
        <button onClick={startAdd} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add FAQ</button>
      </div>
      {(adding || editing) && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4 animate-fade-in">
          <h2 className="font-display font-600">{adding ? 'New FAQ' : 'Edit FAQ'}</h2>
          <div><label className="block text-xs font-medium mb-1">Question</label><input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} className="input-clean" /></div>
          <div><label className="block text-xs font-medium mb-1">Answer</label><textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} rows={4} className="input-clean resize-none" /></div>
          <div><label className="block text-xs font-medium mb-1">Sort Order</label><input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) }))} className="input-clean w-24" /></div>
          <div className="flex gap-2"><button onClick={() => void save()} className="btn-fire py-2 px-4 text-sm"><Check className="w-4 h-4" /> Save</button><button onClick={cancel} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button></div>
        </div>
      )}
      <div className="space-y-3">
        {[...state.faqs].sort((a, b) => a.sortOrder - b.sortOrder).map(faq => (
          <div key={faq.id} className="bg-card border border-border rounded-xl p-4 flex gap-3">
            <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{faq.question}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(faq)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => void removeFaq(faq.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
