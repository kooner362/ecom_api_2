import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Info, ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from 'lucide-react';
import { TaxRule } from '@/contexts/StoreContext';
import { ecomApi } from '@/lib/ecom-api';

const provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

const emptyRule: Omit<TaxRule, 'id'> = {
  name: '', country: 'CA', province: 'ON', postalPrefix: '', rate: 13, priority: 1, enabled: true,
};

export default function AdminTaxes() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [collectTaxes, setCollectTaxes] = useState(true);
  const [editing, setEditing] = useState<TaxRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Omit<TaxRule, 'id'>>(emptyRule);
  const [error, setError] = useState<string | null>(null);

  const loadTaxRules = async () => {
    const response = await ecomApi.admin.taxRates();
    const mapped: TaxRule[] = (response.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      country: item.country || 'CA',
      province: item.province || 'ON',
      postalPrefix: item.postalPrefix || '',
      rate: (item.rateBps || 0) / 100,
      priority: item.priority ?? 0,
      enabled: !!item.enabled,
    }));
    setRules(mapped);
    setCollectTaxes(mapped.some((item) => item.enabled));
  };

  useEffect(() => {
    void loadTaxRules().catch(() => setError('Failed to load tax settings'));
  }, []);

  const openNew = () => { setForm(emptyRule); setEditing(null); setIsNew(true); };
  const openEdit = (r: TaxRule) => { setForm({ ...r }); setEditing(r); setIsNew(false); };
  const close = () => { setEditing(null); setIsNew(false); };

  const save = async () => {
    setError(null);
    try {
      const payload = {
        name: form.name,
        enabled: form.enabled,
        country: form.country || null,
        province: form.province || null,
        postalPrefix: form.postalPrefix || null,
        rateBps: Math.round((form.rate || 0) * 100),
        priority: form.priority,
      };

      if (isNew) {
        await ecomApi.admin.createTaxRate(payload);
      } else if (editing) {
        await ecomApi.admin.updateTaxRate(editing.id, payload);
      }

      await loadTaxRules();
      close();
    } catch (err: any) {
      setError(err?.message || 'Failed to save tax rule');
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this tax rule?')) return;
    setError(null);
    try {
      await ecomApi.admin.deleteTaxRate(id);
      await loadTaxRules();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete tax rule');
    }
  };
  const toggleRule = async (r: TaxRule) => {
    setError(null);
    try {
      await ecomApi.admin.updateTaxRate(r.id, { enabled: !r.enabled });
      await loadTaxRules();
    } catch (err: any) {
      setError(err?.message || 'Failed to update tax rule');
    }
  };

  const movePriority = async (rule: TaxRule, dir: -1 | 1) => {
    setError(null);
    try {
      await ecomApi.admin.updateTaxRate(rule.id, { priority: Math.max(0, rule.priority + dir) });
      await loadTaxRules();
    } catch (err: any) {
      setError(err?.message || 'Failed to update priority');
    }
  };

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-700">Tax Settings</h1>
        <button onClick={openNew} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add Tax Rule</button>
      </div>
      <p className="text-muted-foreground text-sm mb-5">Configure tax rates by province. Taxes are applied at checkout when a matching rule is found.</p>

      {/* Global toggle */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Collect Taxes</p>
            <p className="text-xs text-muted-foreground mt-0.5">When disabled, all orders will have $0 tax regardless of rules.</p>
          </div>
          <button onClick={async () => {
            const next = !collectTaxes;
            setCollectTaxes(next);
            try {
              await Promise.all(rules.map((rule) => ecomApi.admin.updateTaxRate(rule.id, { enabled: next })));
              await loadTaxRules();
            } catch (err: any) {
              setError(err?.message || 'Failed to update tax settings');
            }
          }}>
            {collectTaxes
              ? <ToggleRight className="w-7 h-7 text-primary" />
              : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Rules table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {['Priority', 'Name', 'Region', 'Rate', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedRules.map((rule, i) => (
                <tr key={rule.id} className={`hover:bg-muted/30 transition-colors ${!rule.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => void movePriority(rule, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                      <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rule.priority}</span>
                      <button onClick={() => void movePriority(rule, 1)} disabled={i === sortedRules.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {rule.country} / {rule.province}
                    {rule.postalPrefix && <span className="ml-1 text-xs">({rule.postalPrefix})</span>}
                  </td>
                  <td className="px-4 py-3 font-display font-700">{rule.rate}%</td>
                  <td className="px-4 py-3">
                    <button onClick={() => void toggleRule(rule)} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(rule)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => void del(rule.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRules.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No tax rules configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 p-4 bg-muted/40 border border-border rounded-xl flex gap-3">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">When a customer checks out, the system finds the matching rule based on their province (and optional postal prefix). The highest-priority (lowest number) matching rule is applied. If no rule matches, tax is $0.</p>
      </div>

      {/* Modal */}
      {(isNew || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="font-display font-700 text-lg">{isNew ? 'Add Tax Rule' : 'Edit Tax Rule'}</h2>
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-clean" placeholder="e.g. Ontario HST" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Country</label>
                <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="input-clean" placeholder="CA" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Province</label>
                <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className="input-clean">
                  {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Postal Code Prefix <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input value={form.postalPrefix} onChange={e => setForm(f => ({ ...f, postalPrefix: e.target.value }))} className="input-clean" placeholder="e.g. M5V (leave blank for all)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Rate (%)</label>
                <input type="number" min="0" max="100" step="0.001" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))} className="input-clean" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Priority</label>
                <input type="number" min="1" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))} className="input-clean" />
                <p className="text-xs text-muted-foreground mt-1">Lower = higher priority.</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="accent-primary" />
                Enabled
              </label>
              <div className="flex gap-2">
                <button onClick={close} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={() => void save()} className="btn-fire py-2 px-4 text-sm">Save Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
