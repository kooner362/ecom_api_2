import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { Product } from '@/data/mockData';
import { ecomApi } from '@/lib/ecom-api';

export default function AdminProducts() {
  const { state, refreshFromApi } = useStore();
  const PAGE_SIZE = 20;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const filtered = state.products.filter(p => {
    const ms = p.title.toLowerCase().includes(search.toLowerCase());
    const mc = catFilter === 'all' || p.categoryId === catFilter;
    return ms && mc;
  });

  useEffect(() => {
    setPage(1);
  }, [search, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleFeatured = async (p: Product) => {
    setError(null);
    try {
      await ecomApi.admin.setProductFeatured(p.id, !p.featured);
      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to update featured status');
    }
  };

  const toggleStatus = async (p: Product) => {
    setError(null);
    try {
      await ecomApi.admin.updateProduct(p.id, {
        status: p.status === 'active' ? 'DRAFT' : 'ACTIVE'
      });
      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to update product status');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Archive this product? It will be hidden from the storefront.')) return;
    setError(null);
    try {
      await ecomApi.admin.deleteProduct(id);
      await refreshFromApi();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive product');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-display text-2xl font-700">Products</h1><p className="text-muted-foreground text-sm">{state.products.length} products</p></div>
        <button onClick={() => navigate('/admin/products/new')} className="btn-fire py-2.5 px-4 text-sm"><Plus className="w-4 h-4" /> Add Product</button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="input-clean pl-9" /></div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-clean w-auto">
          <option value="all">All Categories</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>{['Product','Category','Price','Stock','Status','Featured','Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedProducts.map(p => {
                const cat = state.categories.find(c => c.id === p.categoryId);
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">{p.images[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}</div>
                        <span className="font-medium line-clamp-1 max-w-[160px]">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{cat?.name}</td>
                    <td className="px-4 py-3 font-display font-700">${p.price.toFixed(2)}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => void toggleStatus(p)} className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${p.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => void toggleFeatured(p)} className="flex items-center gap-1 text-xs" title="Featured products appear on the homepage.">
                        {p.featured ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/admin/products/${p.id}/edit`)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => void deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No products found.</div>}
        </div>
      </div>
      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded-md border border-border disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded-md border border-border disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
