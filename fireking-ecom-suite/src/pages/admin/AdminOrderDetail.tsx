import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { ecomApi } from '@/lib/ecom-api';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning', confirmed: 'bg-info/10 text-info',
  processing: 'bg-info/10 text-info', shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success', cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { state, refreshFromApi } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const order = state.orders.find(o => o.id === id);
  if (!order) return <div className="p-6">Order not found.</div>;

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

  const updateStatus = async (status: string) => {
    setError(null);
    try {
      const currentFulfillment = statusToFulfillment(order.status);
      const targetFulfillment = statusToFulfillment(status);

      if (targetFulfillment === currentFulfillment) return;

      if (targetFulfillment === 'CANCELED') {
        await ecomApi.admin.updateOrderFulfillment(order.id, 'CANCELED');
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
            order.id,
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

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => navigate('/admin/orders')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Back to Orders</button>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-display text-xl font-700">{order.orderNumber || order.id}</h1><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p></div>
        <select value={order.status} onChange={e => void updateStatus(e.target.value)}
          className={`text-sm font-semibold px-3 py-1.5 rounded-full border-0 focus:outline-none cursor-pointer capitalize ${statusColors[order.status]}`}>
          {['pending','processing','confirmed','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Customer</h3>
          <p className="text-sm">{order.customerName}</p>
          <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Shipping Address</h3>
          <p className="text-sm">{order.shippingAddress.street}</p>
          <p className="text-xs text-muted-foreground">{order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}</p>
          <p className="text-xs text-muted-foreground mt-1">{order.shippingMethod}</p>
          <p className="text-xs text-muted-foreground mt-1">Tracking: {order.trackingNumber || '—'}</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>{['Product','Qty','Price','Total'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map(item => (
              <tr key={item.productId}>
                <td className="px-4 py-3 flex items-center gap-3"><div className="w-10 h-10 rounded-lg overflow-hidden bg-muted">{item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}</div><span>{item.title}</span></td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">${item.price.toFixed(2)}</td>
                <td className="px-4 py-3 font-700">${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 max-w-xs ml-auto space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span></div>
        <div className="flex justify-between font-display font-700 text-base border-t border-border pt-2"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
      </div>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
    </div>
  );
}
