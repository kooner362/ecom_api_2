import { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { InventoryLocation } from '@/contexts/StoreContext';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, MapPin, AlertTriangle, Package } from 'lucide-react';
import { ecomApi } from '@/lib/ecom-api';

type AdjustModal = { productId: string; locationId: string; currentStock: number; productName: string; locationName: string } | null;
type LocationModal = { location: InventoryLocation | null; isNew: boolean };

export default function AdminInventory() {
  const { state, refreshFromApi } = useStore();
  const { inventoryLocations, inventoryEntries, stockAdjustments, products } = state;

  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [adjustModal, setAdjustModal] = useState<AdjustModal>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [locationModal, setLocationModal] = useState<LocationModal>({ location: null, isNew: false });
  const [locationForm, setLocationForm] = useState({ name: '', code: '', address: '', active: true });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'locations' | 'history'>('stock');
  const [error, setError] = useState<string | null>(null);

  const getPrimaryVariantId = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.variants?.[0]?.id;
  };

  const getEntriesForProductLocation = (productId: string, locationId: string) =>
    inventoryEntries.filter((entry) => entry.productId === productId && entry.locationId === locationId);

  const getEntry = (productId: string, locationId: string) => {
    const entries = getEntriesForProductLocation(productId, locationId);
    if (entries.length === 0) return undefined;
    return {
      stock: entries.reduce((sum, entry) => sum + entry.stock, 0),
      lowStockThreshold: entries[0]?.lowStockThreshold ?? 0,
    };
  };

  const getTotalStock = (productId: string) => inventoryEntries
    .filter((entry) => entry.productId === productId)
    .reduce((sum, entry) => sum + entry.stock, 0);

  const getStockStatus = (productId: string) => {
    const total = getTotalStock(productId);
    const entries = inventoryEntries.filter(e => e.productId === productId);
    const hasLow = entries.some(e => e.stock > 0 && e.stock <= e.lowStockThreshold);
    if (total === 0) return 'out';
    if (hasLow) return 'low';
    return 'ok';
  };

  const openAdjust = (productId: string, locationId: string) => {
    const entry = getEntry(productId, locationId);
    const product = products.find(p => p.id === productId);
    const location = inventoryLocations.find(l => l.id === locationId);
    setAdjustDelta(0);
    setAdjustReason('');
    setAdjustModal({ productId, locationId, currentStock: entry?.stock ?? 0, productName: product?.title ?? '', locationName: location?.name ?? '' });
  };

  const submitAdjust = async () => {
    if (!adjustModal || adjustDelta === 0 || !adjustReason.trim()) return;
    const variantId = getPrimaryVariantId(adjustModal.productId);
    if (!variantId) {
      setError('No variant available for selected product.');
      return;
    }
    setError(null);
    try {
      await ecomApi.admin.adjustInventory({
        variantId,
        locationId: adjustModal.locationId,
        delta: adjustDelta,
        note: adjustReason,
      });
      await refreshFromApi();
      setAdjustModal(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to adjust inventory');
    }
  };

  const openNewLocation = () => {
    setLocationForm({ name: '', code: '', address: '', active: true });
    setLocationModal({ location: null, isNew: true });
  };

  const openEditLocation = (loc: InventoryLocation) => {
    setLocationForm({ name: loc.name, code: loc.code ?? '', address: loc.address ?? '', active: loc.active });
    setLocationModal({ location: loc, isNew: false });
  };

  const saveLocation = async () => {
    setError(null);
    try {
      if (locationModal.isNew) {
        await ecomApi.admin.createLocation({
          name: locationForm.name,
          code: locationForm.code || undefined,
          address: locationForm.address || undefined,
          isActive: locationForm.active,
        });
      } else if (locationModal.location) {
        await ecomApi.admin.updateLocation(locationModal.location.id, {
          name: locationForm.name,
          address: locationForm.address || null,
          isActive: locationForm.active,
        });
      }
      await refreshFromApi();
      setLocationModal({ location: null, isNew: false });
    } catch (err: any) {
      setError(err?.message || 'Failed to save location');
    }
  };

  const setThreshold = async (productId: string, locationId: string, threshold: number) => {
    const variantId = getPrimaryVariantId(productId);
    if (!variantId) {
      setError('No variant available for selected product.');
      return;
    }
    try {
      await ecomApi.admin.setInventoryThreshold({ variantId, locationId, threshold });
      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to update threshold');
    }
  };

  const filteredProducts = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  const activeLocations = inventoryLocations.filter(l => l.active);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-display text-2xl font-700">Inventory</h1>
          <p className="text-muted-foreground text-sm">Multi-location stock management with adjustment history.</p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit mb-6 mt-4">
        {(['stock', 'locations', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab === 'stock' ? 'Stock Levels' : tab === 'locations' ? 'Locations' : 'Adjustment History'}
          </button>
        ))}
      </div>

      {/* ── STOCK TAB ───────────────────────────────── */}
      {activeTab === 'stock' && (
        <>
          <div className="relative mb-4 max-w-sm">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="input-clean pl-9" />
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Products', value: products.length },
              { label: 'In Stock', value: products.filter(p => getTotalStock(p.id) > 0).length },
              { label: 'Low Stock', value: products.filter(p => getStockStatus(p.id) === 'low').length },
              { label: 'Out of Stock', value: products.filter(p => getStockStatus(p.id) === 'out').length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xl font-display font-700">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Stock</th>
                    {activeLocations.map(loc => (
                      <th key={loc.id} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        <span title={loc.address}>{loc.name}</span>
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map(p => {
                    const totalStock = getTotalStock(p.id);
                    const status = getStockStatus(p.id);
                    const expanded = expandedProduct === p.id;

                    return (
                      <>
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedProduct(expanded ? null : p.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0">
                                {p.images[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm line-clamp-1">{p.title}</p>
                                <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-display font-700 text-base">{totalStock}</td>
                          {activeLocations.map(loc => {
                            const entry = getEntry(p.id, loc.id);
                            const isLow = entry && entry.stock > 0 && entry.stock <= entry.lowStockThreshold;
                            return (
                              <td key={loc.id} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold ${isLow ? 'text-warning' : ''}`}>{entry?.stock ?? 0}</span>
                                  {isLow && <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                                  <button onClick={e => { e.stopPropagation(); openAdjust(p.id, loc.id); }} className="text-xs text-primary hover:underline ml-1">Adjust</button>
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status === 'out' ? 'bg-destructive/10 text-destructive' : status === 'low' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                              {status === 'out' ? 'Out of Stock' : status === 'low' ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${p.id}-expanded`} className="bg-muted/20">
                            <td colSpan={3 + activeLocations.length} className="px-4 py-3">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Low Stock Thresholds per Location</div>
                              <div className="flex flex-wrap gap-3">
                                {activeLocations.map(loc => {
                                  const entry = getEntry(p.id, loc.id);
                                  return (
                                    <div key={loc.id} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                                      <span className="text-xs text-muted-foreground">{loc.name}:</span>
                                      <input
                                        type="number" min="0"
                                        defaultValue={entry?.lowStockThreshold ?? 5}
                                        className="w-14 h-6 text-xs border border-border rounded px-1 bg-background text-center"
                                        onBlur={e => setThreshold(p.id, loc.id, parseInt(e.target.value) || 0)}
                                      />
                                      <span className="text-xs text-muted-foreground">units</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No products found.</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── LOCATIONS TAB ───────────────────────────── */}
      {activeTab === 'locations' && (
        <div className="max-w-2xl space-y-3">
          <div className="flex justify-end mb-2">
            <button onClick={openNewLocation} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add Location</button>
          </div>
          {inventoryLocations.map(loc => (
            <div key={loc.id} className={`bg-card border rounded-xl p-4 flex items-start gap-4 ${!loc.active ? 'opacity-50' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{loc.name}</p>
                {loc.code && <p className="text-xs text-muted-foreground mt-0.5">Code: {loc.code}</p>}
                {loc.address && <p className="text-xs text-muted-foreground mt-0.5">{loc.address}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {inventoryEntries.filter(e => e.locationId === loc.id).reduce((s, e) => s + e.stock, 0)} total units across {products.length} products
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    setError(null);
                    try {
                      await ecomApi.admin.updateLocation(loc.id, { isActive: !loc.active });
                      await refreshFromApi();
                    } catch (err: any) {
                      setError(err?.message || 'Failed to update location status');
                    }
                  }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${loc.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}
                >
                  {loc.active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => openEditLocation(loc)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                <button
                  onClick={async () => {
                    if (!confirm('Deactivate location?')) return;
                    setError(null);
                    try {
                      await ecomApi.admin.deleteLocation(loc.id);
                      await refreshFromApi();
                    } catch (err: any) {
                      setError(err?.message || 'Failed to deactivate location');
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden max-w-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {['Date', 'Product', 'Location', 'Change', 'Reason'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockAdjustments.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No adjustments yet. Use the "Adjust" buttons in Stock Levels to log changes.</td></tr>
                )}
                {stockAdjustments.slice(0, 50).map(adj => {
                  const product = products.find(p => p.id === adj.productId);
                  const location = inventoryLocations.find(l => l.id === adj.locationId);
                  return (
                    <tr key={adj.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(adj.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium line-clamp-1 max-w-[200px]">{product?.title ?? adj.productId}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{location?.name ?? adj.locationId}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-sm font-semibold ${adj.delta > 0 ? 'text-success' : 'text-destructive'}`}>
                          {adj.delta > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                          {adj.delta > 0 ? `+${adj.delta}` : adj.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{adj.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAdjustModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h2 className="font-display font-700 text-lg">Adjust Stock</h2>
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <p className="font-medium line-clamp-2">{adjustModal.productName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">at {adjustModal.locationName}</p>
              <p className="text-xs text-muted-foreground mt-1">Current: <strong>{adjustModal.currentStock} units</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Adjustment</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setAdjustDelta(d => d - 1)} className="w-9 h-9 rounded-lg border border-border hover:bg-muted flex items-center justify-center font-bold">−</button>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={e => setAdjustDelta(parseInt(e.target.value) || 0)}
                  className="flex-1 input-clean text-center font-display font-700 text-lg"
                />
                <button onClick={() => setAdjustDelta(d => d + 1)} className="w-9 h-9 rounded-lg border border-border hover:bg-muted flex items-center justify-center font-bold">+</button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-center">
                Result: <strong>{Math.max(0, adjustModal.currentStock + adjustDelta)} units</strong>
                {adjustDelta > 0 && <span className="text-success ml-1">(+{adjustDelta})</span>}
                {adjustDelta < 0 && <span className="text-destructive ml-1">({adjustDelta})</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reason <span className="text-destructive">*</span></label>
              <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="input-clean mb-2">
                <option value="">Select a reason…</option>
                <option value="Received from supplier">Received from supplier</option>
                <option value="Return from customer">Return from customer</option>
                <option value="Damaged / written off">Damaged / written off</option>
                <option value="Inventory count correction">Inventory count correction</option>
                <option value="Transfer between locations">Transfer between locations</option>
                <option value="Sale / order fulfillment">Sale / order fulfillment</option>
                <option value="Other">Other</option>
              </select>
              {adjustReason === 'Other' && (
                <input
                  placeholder="Describe reason…"
                  onChange={e => setAdjustReason(e.target.value)}
                  className="input-clean"
                />
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAdjustModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={() => void submitAdjust()}
                disabled={adjustDelta === 0 || !adjustReason.trim()}
                className="flex-1 btn-fire py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {(locationModal.isNew || locationModal.location) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLocationModal({ location: null, isNew: false })} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h2 className="font-display font-700 text-lg">{locationModal.isNew ? 'Add Location' : 'Edit Location'}</h2>
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input value={locationForm.name} onChange={e => setLocationForm(f => ({ ...f, name: e.target.value }))} className="input-clean" placeholder="e.g. Main Warehouse" />
            </div>
            {locationModal.isNew && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Code <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input value={locationForm.code} onChange={e => setLocationForm(f => ({ ...f, code: e.target.value }))} className="input-clean" placeholder="e.g. MAIN-WH" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">Address <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input value={locationForm.address} onChange={e => setLocationForm(f => ({ ...f, address: e.target.value }))} className="input-clean" placeholder="123 Industrial Blvd, Toronto, ON" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={locationForm.active} onChange={e => setLocationForm(f => ({ ...f, active: e.target.checked }))} className="accent-primary" />
                Active
              </label>
              <div className="flex gap-2">
                <button onClick={() => setLocationModal({ location: null, isNew: false })} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={() => void saveLocation()} disabled={!locationForm.name.trim()} className="btn-fire py-2 px-4 text-sm disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
