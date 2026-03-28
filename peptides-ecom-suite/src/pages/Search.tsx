import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/contexts/StoreContext';
import ProductCard from '@/components/storefront/ProductCard';
import { Search } from 'lucide-react';

export default function SearchPage() {
  const { state } = useStore();
  const PAGE_SIZE = 20;
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const q = params.get('q') || '';

  const results = useMemo(
    () =>
      state.products.filter(
        (p) =>
          p.status === 'active' &&
          (p.title.toLowerCase().includes(q.toLowerCase()) ||
            p.description.toLowerCase().includes(q.toLowerCase()) ||
            p.tags?.some((t) => t.toLowerCase().includes(q.toLowerCase())))
      ),
    [state.products, q]
  );

  useEffect(() => {
    setPage(1);
  }, [q]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Search className="w-5 h-5 text-muted-foreground" />
        <h1 className="font-display text-2xl font-700">Search Results</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        {results.length} result{results.length !== 1 ? 's' : ''} for <strong>"{q}"</strong>
      </p>
      {results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <p className="font-display text-lg font-600">No results found</p>
          <p className="text-muted-foreground mt-1">Try a different search term.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {pagedResults.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {results.length > PAGE_SIZE && (
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
        </>
      )}
    </div>
  );
}
