import { useEffect, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Zap } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { PaymentProvider } from '@/contexts/StoreContext';
import { ecomApi } from '@/lib/ecom-api';

const providerLogos: Record<string, string> = {
  stripe: '💳',
  other: '🏦',
};

const providerDescriptions: Record<string, string> = {
  stripe: 'Accept credit cards, Apple Pay, and Google Pay. Most popular and developer-friendly.',
  other: 'Configure a manual or custom payment method (e.g., bank transfer, cash on delivery).',
};

export default function AdminPayments() {
  const { state, dispatch, refreshFromApi } = useStore();
  const { paymentProviders } = state;
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail'>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [localProviders, setLocalProviders] = useState(paymentProviders);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalProviders(paymentProviders);
  }, [paymentProviders]);

  const updateLocal = (id: string, changes: Partial<PaymentProvider>) => {
    setLocalProviders(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  };

  const saveProvider = async (provider: PaymentProvider) => {
    setError(null);
    try {
      await ecomApi.admin.updatePaymentSetting(provider.id, {
        enabled: provider.enabled,
        publicKey: provider.publicKey,
        ...(provider.secretKey ? { secretKey: provider.secretKey } : {}),
        testMode: provider.testMode,
        ...(provider.id === 'other'
          ? { manualPaymentEmail: provider.manualPaymentEmail?.trim() ? provider.manualPaymentEmail.trim() : null }
          : {}),
      });
      await refreshFromApi();
      dispatch({ type: 'UPDATE_PAYMENT_PROVIDER', payload: provider });
      setSaved(provider.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save payment provider');
    }
  };

  const setActive = async (id: 'stripe' | 'other') => {
    setError(null);
    try {
      await ecomApi.admin.activatePaymentProvider(id);
      await refreshFromApi();
      dispatch({ type: 'SET_ACTIVE_PROVIDER', payload: id });
      setLocalProviders(prev => prev.map(p => ({ ...p, active: p.id === id })));
    } catch (err: any) {
      setError(err?.message || 'Failed to activate payment provider');
    }
  };

  const testConnection = (id: string) => {
    setTesting(id);
    setTimeout(() => {
      setTesting(null);
      // Mock: always succeed for stripe if key is filled, fail otherwise
      const provider = localProviders.find(p => p.id === id);
      setTestResult(prev => ({ ...prev, [id]: (provider?.publicKey && provider.publicKey.length > 5) ? 'ok' : 'fail' }));
    }, 1500);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="font-display text-2xl font-700 mb-2">Payment Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">Configure your payment providers. Only one provider can be active at checkout at a time.</p>

      <div className="space-y-5">
        {localProviders.map(provider => {
          const isActive = provider.active;
          const isSaved = saved === provider.id;

          return (
            <div key={provider.id} className={`bg-card border rounded-2xl p-5 transition-all ${isActive ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
                  {providerLogos[provider.id]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-700">{provider.name}</span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{providerDescriptions[provider.id]}</p>
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  <button
                    onClick={() => { updateLocal(provider.id, { enabled: !provider.enabled }); }}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${provider.enabled ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  {provider.enabled && !isActive && (
                    <button onClick={() => void setActive(provider.id as any)} className="text-xs text-primary hover:underline">
                      Set as Active
                    </button>
                  )}
                </div>
              </div>

              {provider.id !== 'other' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">Publishable / Client Key</label>
                    <div className="relative">
                      <input
                        type={showKeys[`${provider.id}_pub`] ? 'text' : 'password'}
                        value={provider.publicKey}
                        onChange={e => updateLocal(provider.id, { publicKey: e.target.value })}
                        className="input-clean pr-10 font-mono text-sm"
                        placeholder={provider.id === 'stripe' ? 'pk_live_...' : 'Client ID...'}
                      />
                      <button onClick={() => setShowKeys(s => ({ ...s, [`${provider.id}_pub`]: !s[`${provider.id}_pub`] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKeys[`${provider.id}_pub`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">Secret Key</label>
                    <div className="relative">
                      <input
                        type={showKeys[`${provider.id}_sec`] ? 'text' : 'password'}
                        value={provider.secretKey}
                        onChange={e => updateLocal(provider.id, { secretKey: e.target.value })}
                        className="input-clean pr-10 font-mono text-sm"
                        placeholder={provider.id === 'stripe' ? 'sk_live_...' : 'Secret...'}
                      />
                      <button onClick={() => setShowKeys(s => ({ ...s, [`${provider.id}_sec`]: !s[`${provider.id}_sec`] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKeys[`${provider.id}_sec`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={provider.testMode} onChange={e => updateLocal(provider.id, { testMode: e.target.checked })} className="accent-primary" />
                      <span className="text-sm">Test mode</span>
                    </label>
                    <p className="text-xs text-muted-foreground">No real charges in test mode.</p>
                  </div>
                </div>
              )}

              {provider.id === 'other' && (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                    Manual payment method — customers will be prompted to pay via instructions you provide in your order confirmation email.
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">E-transfer Email</label>
                    <input
                      type="email"
                      value={provider.manualPaymentEmail || ''}
                      onChange={e => updateLocal(provider.id, { manualPaymentEmail: e.target.value })}
                      className="input-clean text-sm"
                      placeholder="payments@yourstore.com"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Shown in customer order confirmation when this provider is active.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                {provider.id !== 'other' && (
                  <button
                    onClick={() => testConnection(provider.id)}
                    disabled={testing === provider.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Zap className="w-3 h-3" />
                    {testing === provider.id ? 'Testing…' : 'Test Connection'}
                  </button>
                )}
                {testResult[provider.id] && (
                  <span className={`text-xs font-semibold ${testResult[provider.id] === 'ok' ? 'text-success' : 'text-destructive'}`}>
                    {testResult[provider.id] === 'ok' ? '✓ Connection successful' : '✗ Connection failed — check your keys'}
                  </span>
                )}
                <button
                  onClick={() => void saveProvider(localProviders.find(p => p.id === provider.id)!)}
                  className="ml-auto btn-fire py-1.5 px-4 text-xs"
                >
                  {isSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
