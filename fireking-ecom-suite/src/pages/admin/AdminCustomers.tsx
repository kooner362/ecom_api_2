import { useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { ecomApi } from '@/lib/ecom-api';

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const headerRow = headers.map(csvEscape).join(',');
  const dataRows = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','));
  return [headerRow, ...dataRows].join('\n');
}

export default function AdminCustomers() {
  const { state } = useStore();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customers = [...state.customers].sort((a, b) => b.totalSpent - a.totalSpent);

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const all: Array<{
        id: string;
        name: string;
        email: string;
        phone?: string | null;
        totalOrders: number;
        totalSpentCents: number;
        joinedAt: string;
        address?: {
          line1: string;
          line2?: string | null;
          city: string;
          province: string;
          country: string;
          postalCode: string;
        } | null;
      }> = [];

      let page = 1;
      let totalPages = 1;
      do {
        const response = await ecomApi.admin.customers({ page, limit: 100 });
        all.push(...response.items);
        totalPages = response.pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);

      const headers = [
        'id',
        'name',
        'email',
        'phone',
        'totalOrders',
        'totalSpent',
        'joinedAt',
        'addressLine1',
        'addressLine2',
        'city',
        'province',
        'country',
        'postalCode',
      ];

      const rows = all
        .sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1))
        .map((customer) => ({
          id: customer.id,
          name: customer.name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          totalOrders: customer.totalOrders ?? 0,
          totalSpent: ((customer.totalSpentCents || 0) / 100).toFixed(2),
          joinedAt: customer.joinedAt,
          addressLine1: customer.address?.line1 || '',
          addressLine2: customer.address?.line2 || '',
          city: customer.address?.city || '',
          province: customer.address?.province || '',
          country: customer.address?.country || '',
          postalCode: customer.address?.postalCode || '',
        }));

      const csv = toCsv(rows, headers);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to export customers');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-700 mb-2">Customers</h1>
          <p className="text-muted-foreground text-sm">{customers.length} registered customers.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>{['Name','Email','Phone','Orders','Total Spent','Joined'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || '—'}</td>
                  <td className="px-4 py-3">{c.totalOrders}</td>
                  <td className="px-4 py-3 font-display font-700">${c.totalSpent.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
