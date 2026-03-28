import { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { ecomApi } from '@/lib/ecom-api';

const emailTypes = [
  { id: 'confirmation', apiType: 'CUSTOMER_CONFIRMATION', label: 'Order Confirmation', desc: 'Sent to customer after order is placed.' },
  { id: 'packing', apiType: 'PACKING', label: 'Packing Slip', desc: 'Sent to warehouse when order is confirmed.' },
  { id: 'warehouse', apiType: 'WAREHOUSE', label: 'Warehouse Notification', desc: 'Internal team alert for new orders.' },
  { id: 'shipped', apiType: 'SHIPPED_CONFIRMATION', label: 'Order Shipped', desc: 'Sent to customer when fulfillment is marked shipped.' },
  { id: 'delivered', apiType: 'DELIVERED_CONFIRMATION', label: 'Order Delivered', desc: 'Sent to customer when fulfillment is marked delivered.' },
] as const;

const idToApiType = {
  confirmation: 'CUSTOMER_CONFIRMATION',
  packing: 'PACKING',
  warehouse: 'WAREHOUSE',
  shipped: 'SHIPPED_CONFIRMATION',
  delivered: 'DELIVERED_CONFIRMATION',
} as const;

type EmailUiType = (typeof emailTypes)[number]['id'];

export default function AdminEmailSettings() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ confirmation: true, packing: true, warehouse: true, shipped: true, delivered: true });
  const [to, setTo] = useState<Record<string, string>>({ confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' });
  const [cc, setCc] = useState<Record<string, string>>({ confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' });
  const [bcc, setBcc] = useState<Record<string, string>>({ confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' });
  const [subject, setSubject] = useState<Record<string, string>>({ confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' });
  const [html, setHtml] = useState<Record<string, string>>({ confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' });
  const [selected, setSelected] = useState<EmailUiType>('confirmation');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmailSettings = async () => {
    const routes = await ecomApi.admin.emailRoutes();

    const nextEnabled: Record<string, boolean> = { confirmation: true, packing: true, warehouse: true, shipped: true, delivered: true };
    const nextTo: Record<string, string> = { confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' };
    const nextCc: Record<string, string> = { confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' };
    const nextBcc: Record<string, string> = { confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' };
    const nextSubject: Record<string, string> = { confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' };
    const nextHtml: Record<string, string> = { confirmation: '', packing: '', warehouse: '', shipped: '', delivered: '' };

    for (const type of emailTypes) {
      const route = (routes.items || []).find((item) => item.type === type.apiType);
      if (route) {
        nextEnabled[type.id] = route.enabled;
      }

      const [recipients, template] = await Promise.all([
        ecomApi.admin.emailRecipients(type.apiType),
        ecomApi.admin.emailTemplate(type.apiType),
      ]);

      nextTo[type.id] = (recipients.to || []).join(', ');
      nextCc[type.id] = (recipients.cc || []).join(', ');
      nextBcc[type.id] = (recipients.bcc || []).join(', ');
      nextSubject[type.id] = template.subject || '';
      nextHtml[type.id] = template.html || '';
    }

    setEnabled(nextEnabled);
    setTo(nextTo);
    setCc(nextCc);
    setBcc(nextBcc);
    setSubject(nextSubject);
    setHtml(nextHtml);
  };

  useEffect(() => {
    void loadEmailSettings().catch(() => setError('Failed to load email settings'));
  }, []);

  const save = async () => {
    setError(null);
    const apiType = idToApiType[selected];

    try {
      await Promise.all([
        ecomApi.admin.updateEmailRoute(apiType, enabled[selected]),
        ecomApi.admin.updateEmailRecipients(apiType, {
          to: to[selected].split(',').map((item) => item.trim()).filter(Boolean),
          cc: cc[selected].split(',').map((item) => item.trim()).filter(Boolean),
          bcc: bcc[selected].split(',').map((item) => item.trim()).filter(Boolean),
        }),
        ecomApi.admin.updateEmailTemplate(apiType, {
          subject: subject[selected] || `${emailTypes.find((e) => e.id === selected)?.label || 'Email'}`,
          html: html[selected] || '<p></p>',
        }),
      ]);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save email settings');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="font-display text-2xl font-700 mb-2">Email Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">Configure transactional email recipients and templates.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {emailTypes.map((et) => (
          <button key={et.id} onClick={() => setSelected(et.id)} className={`text-left p-4 rounded-xl border-2 transition-colors ${selected === et.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">{et.label}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setEnabled((value) => ({ ...value, [et.id]: !value[et.id] })); }}>
                {enabled[et.id] ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{et.desc}</p>
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-display font-600">{emailTypes.find((entry) => entry.id === selected)?.label} — Template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium mb-1">To</label><input value={to[selected]} onChange={(e) => setTo((value) => ({ ...value, [selected]: e.target.value }))} className="input-clean text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">CC</label><input value={cc[selected]} onChange={(e) => setCc((value) => ({ ...value, [selected]: e.target.value }))} className="input-clean text-sm" placeholder="cc@example.com" /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">BCC</label><input value={bcc[selected]} onChange={(e) => setBcc((value) => ({ ...value, [selected]: e.target.value }))} className="input-clean text-sm" placeholder="bcc@example.com" /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Subject</label><input className="input-clean text-sm" value={subject[selected]} onChange={(e) => setSubject((value) => ({ ...value, [selected]: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Template (HTML)</label>
            <textarea rows={6} className="input-clean text-xs font-mono resize-none" value={html[selected]} onChange={(e) => setHtml((value) => ({ ...value, [selected]: e.target.value }))} />
          </div>
        </div>
        <button onClick={() => void save()} className="btn-fire py-2.5 px-5 text-sm">{saved ? '✓ Saved!' : 'Save Settings'}</button>
      </div>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
