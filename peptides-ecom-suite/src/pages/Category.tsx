import { useParams } from 'react-router-dom';
import { useStore } from '@/contexts/StoreContext';
import ProductCard from '@/components/storefront/ProductCard';
import ShopPage from './Shop';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { state } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (slug) setSearchParams({ category: slug });
  }, [slug]);

  const cat = state.categories.find(c => c.slug === slug);

  return (
    <div>
      {cat && (
        <div className="bg-muted/40 border-b border-border py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-700 text-foreground">{cat.name}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{cat.description}</p>
            </div>
          </div>
        </div>
      )}
      <ShopPage />
    </div>
  );
}
