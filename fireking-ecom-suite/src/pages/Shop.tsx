import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import ProductCard from '@/components/storefront/ProductCard';
import { cn } from '@/lib/utils';

export default function ShopPage() {
  const { state } = useStore();
  const PAGE_SIZE = 20;
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sort, setSort] = useState('default');
  const [priceMax, setPriceMax] = useState(500);
  const [featuredOnly, setFeaturedOnly] = useState(searchParams.get('filter') === 'featured');
  const [page, setPage] = useState(1);

  const selectedCategory = searchParams.get('category');

  const filtered = useMemo(() => {
    let prods = state.products.filter(p => p.status === 'active');
    if (selectedCategory) prods = prods.filter(p => {
      const cat = state.categories.find(c => c.id === selectedCategory || c.slug === selectedCategory);
      return cat ? p.categoryId === cat.id : true;
    });
    if (featuredOnly) prods = prods.filter(p => p.featured);
    prods = prods.filter(p => p.price <= priceMax);
    if (sort === 'price-asc') prods.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') prods.sort((a, b) => b.price - a.price);
    else if (sort === 'name') prods.sort((a, b) => a.title.localeCompare(b.title));
    return prods;
  }, [state.products, state.categories, selectedCategory, featuredOnly, priceMax, sort]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, featuredOnly, priceMax, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setCategory = (id: string | null) => {
    if (id) setSearchParams({ category: id });
    else setSearchParams({});
  };

  const Sidebar = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-600 text-sm uppercase tracking-wide text-muted-foreground mb-3">Category</h3>
        <ul className="space-y-1">
          <li>
            <button onClick={() => setCategory(null)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", !selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted')}>
              All Products <span className="text-xs text-muted-foreground ml-1">({state.products.filter(p => p.status === 'active').length})</span>
            </button>
          </li>
          {state.categories.map(cat => {
            const count = state.products.filter(p => p.categoryId === cat.id && p.status === 'active').length;
            const isActive = selectedCategory === cat.id || selectedCategory === cat.slug;
            return (
              <li key={cat.id}>
                <button onClick={() => setCategory(cat.id)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2", isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted')}>
                  <span className="flex-1">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">({count})</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="font-display font-600 text-sm uppercase tracking-wide text-muted-foreground mb-3">Price</h3>
        <div className="px-1">
          <input type="range" min={10} max={500} step={10} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))}
            className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>$0</span><span>Up to ${priceMax}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={featuredOnly} onChange={e => setFeaturedOnly(e.target.checked)}
            className="w-4 h-4 accent-primary rounded" />
          <span className="text-sm font-medium">Featured only</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-700 text-foreground">Shop All Products</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} products</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileFiltersOpen(true)} className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
          <div className="relative">
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="appearance-none bg-card border border-border rounded-lg px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="default">Sort: Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name A–Z</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <Sidebar />
        </aside>

        {/* Mobile filters drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
            <div className="relative ml-auto w-72 bg-card h-full p-6 overflow-y-auto animate-slide-in-right">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-600 text-lg">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)}><X className="w-5 h-5" /></button>
              </div>
              <Sidebar />
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="text-5xl mb-4">🎆</div>
              <p className="font-display text-lg font-600">No products found</p>
              <p className="text-sm mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {pagedProducts.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
          {filtered.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-2">
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
      </div>
    </div>
  );
}
