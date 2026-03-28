import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, Users, DollarSign, ArrowRight, Boxes } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { ecomApi } from '@/lib/ecom-api';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-info/10 text-info',
  processing: 'bg-info/10 text-info',
  shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

type Period = '7d' | '30d' | '90d' | 'custom';

function dateToStartIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function dateToEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export default function AdminDashboard() {
  const { state } = useStore();
  const [period, setPeriod] = useState<Period>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [salesSnapshot, setSalesSnapshot] = useState<{
    summary: { grossSalesCents: number; ordersCount: number; avgOrderValueCents: number; unitsSold: number };
    daily: Array<{ date: string; grossSalesCents: number; ordersCount: number; unitsSold: number }>;
  } | null>(null);

  const [salesByProduct, setSalesByProduct] = useState<
    Array<{ productId: string; variantId: string; title: string; sku?: string | null; unitsSold: number; revenueCents: number }>
  >([]);

  const [inventoryOnHand, setInventoryOnHand] = useState<{
    summary: { totalOnHandUnits: number; totalInventoryCostCents: number };
    items: Array<{
      productId: string;
      variantId: string;
      productTitle: string;
      variantTitle: string;
      sku?: string | null;
      onHandUnits: number;
      unitCostCents: number;
      extendedCostCents: number;
    }>;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        if (period === 'custom') {
          if (!startDate || !endDate) {
            setError('Select both start and end dates for custom range.');
            setLoading(false);
            return;
          }
          if (startDate > endDate) {
            setError('Start date must be on or before end date.');
            setLoading(false);
            return;
          }
        }

        const rangeParams =
          period === 'custom'
            ? {
                start: dateToStartIso(startDate),
                end: dateToEndIso(endDate),
              }
            : { period };

        const [snapshotRes, byProductRes, inventoryRes] = await Promise.all([
          ecomApi.admin.salesSnapshot(rangeParams),
          ecomApi.admin.salesByProduct({ ...rangeParams, limit: 8 }),
          ecomApi.admin.inventoryOnHandCost({ limit: 12 }),
        ]);

        if (!active) return;
        setSalesSnapshot({ summary: snapshotRes.summary, daily: snapshotRes.daily });
        setSalesByProduct(byProductRes.items || []);
        setInventoryOnHand({ summary: inventoryRes.summary, items: inventoryRes.items || [] });
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load dashboard reports');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReports();
    return () => {
      active = false;
    };
  }, [period, startDate, endDate]);

  const stats = useMemo(() => {
    const grossSales = (salesSnapshot?.summary.grossSalesCents || 0) / 100;
    const ordersCount = salesSnapshot?.summary.ordersCount || 0;
    const avgOrderValue = (salesSnapshot?.summary.avgOrderValueCents || 0) / 100;
    const inventoryValue = (inventoryOnHand?.summary.totalInventoryCostCents || 0) / 100;

    return [
      { label: 'Gross Sales', value: `$${grossSales.toFixed(2)}`, icon: DollarSign },
      { label: 'Orders', value: ordersCount, icon: ShoppingBag },
      { label: 'Avg Order Value', value: `$${avgOrderValue.toFixed(2)}`, icon: Package },
      { label: 'Inventory Value', value: `$${inventoryValue.toFixed(2)}`, icon: Boxes },
      { label: 'Customers', value: state.customers.length, icon: Users },
    ];
  }, [salesSnapshot, inventoryOnHand, state.customers.length]);

  return (
    <div className="p-6 space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-700">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Sales and inventory reporting overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Range</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="input-clean w-auto text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-clean w-auto text-sm"
                aria-label="Start date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-clean w-auto text-sm"
                aria-label="End date"
              />
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="admin-stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
            </div>
            <div className="font-display text-2xl font-700">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-base">Sales Snapshot</h2>
            {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {['Date', 'Orders', 'Units', 'Gross Sales'].map((h) => (
                    <th key={h} className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(salesSnapshot?.daily || []).slice(-10).reverse().map((day) => (
                  <tr key={day.date}>
                    <td className="py-2">{day.date}</td>
                    <td className="py-2">{day.ordersCount}</td>
                    <td className="py-2">{day.unitsSold}</td>
                    <td className="py-2 font-medium">${(day.grossSalesCents / 100).toFixed(2)}</td>
                  </tr>
                ))}
                {!loading && (salesSnapshot?.daily || []).length === 0 && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={4}>No sales in selected range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-display font-700 text-base mb-4">Sales by Product</h2>
          <div className="space-y-3">
            {salesByProduct.map((item) => (
              <div key={item.variantId} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.sku || 'No SKU'} · {item.unitsSold} units</p>
                </div>
                <span className="text-sm font-display font-700">${(item.revenueCents / 100).toFixed(2)}</span>
              </div>
            ))}
            {!loading && salesByProduct.length === 0 && <p className="text-sm text-muted-foreground">No sales yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-base">Inventory On Hand Cost</h2>
            <span className="text-xs text-muted-foreground">
              Total: ${((inventoryOnHand?.summary.totalInventoryCostCents || 0) / 100).toFixed(2)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {['Product / SKU', 'On Hand', 'Unit Cost', 'Extended Cost'].map((h) => (
                    <th key={h} className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(inventoryOnHand?.items || []).map((item) => (
                  <tr key={item.variantId}>
                    <td className="py-2">
                      <p className="font-medium line-clamp-1">{item.productTitle}</p>
                      <p className="text-xs text-muted-foreground">{item.sku || item.variantTitle}</p>
                    </td>
                    <td className="py-2">{item.onHandUnits}</td>
                    <td className="py-2">${(item.unitCostCents / 100).toFixed(2)}</td>
                    <td className="py-2 font-medium">${(item.extendedCostCents / 100).toFixed(2)}</td>
                  </tr>
                ))}
                {!loading && (inventoryOnHand?.items || []).length === 0 && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={4}>No inventory levels found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-base">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {state.orders.slice(0, 5).map(order => (
              <Link key={order.id} to={`/admin/orders/${order.id}`} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/30 px-2 -mx-2 rounded-lg transition-colors">
                <div>
                  <p className="text-sm font-semibold">{order.orderNumber || order.id}</p>
                  <p className="text-xs text-muted-foreground">{order.customerName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[order.status]}`}>{order.status}</span>
                  <span className="text-sm font-display font-700">${order.total.toFixed(2)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
