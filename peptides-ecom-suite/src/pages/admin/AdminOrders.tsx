import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/contexts/StoreContext';
import { Search } from 'lucide-react';
import { ecomApi } from '@/lib/ecom-api';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-info/10 text-info',
  processing: 'bg-info/10 text-info',
  shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminOrders() {
  const { state, refreshFromApi } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const statusToFulfillment = (status: string) => {
    if (status === 'pending') return 'UNFULFILLED';
    if (status === 'processing') return 'PICKING';
    if (status === 'confirmed') return 'PACKED';
    if (status === 'shipped') return 'SHIPPED';
    if (status === 'delivered') return 'DELIVERED';
    return 'CANCELED';
  };

  const uiStatusToRank = (status: string) => {
    if (status === 'pending') return 0;
    if (status === 'processing') return 1;
    if (status === 'confirmed') return 2;
    if (status === 'shipped') return 3;
    if (status === 'delivered') return 4;
    return -1;
  };

  const fulfillmentPath = ['UNFULFILLED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] as const;
  const shippedIndex = fulfillmentPath.indexOf('SHIPPED');

  const updateStatus = async (orderId: string, status: string) => {
    setError(null);
    try {
      const order = state.orders.find((item) => item.id === orderId);
      if (!order) return;

      const currentFulfillment = statusToFulfillment(order.status);
      const targetFulfillment = statusToFulfillment(status);

      if (targetFulfillment === currentFulfillment) return;

      if (targetFulfillment === 'CANCELED') {
        await ecomApi.admin.updateOrderFulfillment(orderId, 'CANCELED');
      } else {
        const currentRank = uiStatusToRank(order.status);
        const targetRank = uiStatusToRank(status);
        if (currentRank > targetRank) {
          throw new Error('Cannot move order backward in fulfillment state');
        }

        const startIndex = fulfillmentPath.indexOf(currentFulfillment as any);
        const endIndex = fulfillmentPath.indexOf(targetFulfillment as any);
        if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
          throw new Error('Invalid fulfillment transition');
        }

        let shippedTrackingNumber: string | undefined;
        if (startIndex < shippedIndex && endIndex >= shippedIndex) {
          const trackingInput = window.prompt(
            'Enter tracking number (optional). Leave blank to skip.'
          );
          if (trackingInput === null) {
            return;
          }
          const trimmed = trackingInput.trim();
          shippedTrackingNumber = trimmed || undefined;
        }

        for (let index = startIndex + 1; index <= endIndex; index += 1) {
          await ecomApi.admin.updateOrderFulfillment(
            orderId,
            fulfillmentPath[index],
            fulfillmentPath[index] === 'SHIPPED' ? shippedTrackingNumber : undefined
          );
        }
      }

      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to update order status');
    }
  };

  const filtered = state.orders.filter(o => {
    const orderRef = (o.orderNumber || o.id).toLowerCase();
    const matchSearch = orderRef.includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-display text-2xl font-700">Orders</h1><p className="text-muted-foreground text-sm">{state.orders.length} total orders</p></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…" className="input-clean pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-clean w-auto">
          <option value="all">All Statuses</option>
          {['pending','confirmed','processing','shipped','delivered','cancelled'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {['Order #','Customer','Date','Items','Status','Tracking','Total',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{order.orderNumber || order.id}</td>
                  <td className="px-4 py-3"><div className="font-medium">{order.customerName}</div><div className="text-xs text-muted-foreground">{order.customerEmail}</div></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3">
                    <select value={order.status} onChange={e => void updateStatus(order.id, e.target.value)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer capitalize ${statusColors[order.status]}`}>
                      {['pending','processing','confirmed','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{order.trackingNumber || '—'}</td>
                  <td className="px-4 py-3 font-display font-700">${order.total.toFixed(2)}</td>
                  <td className="px-4 py-3"><Link to={`/admin/orders/${order.id}`} className="text-xs text-primary hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No orders found.</div>}
        </div>
      </div>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
