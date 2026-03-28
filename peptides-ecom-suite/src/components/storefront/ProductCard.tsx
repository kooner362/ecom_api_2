import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Zap } from 'lucide-react';
import { Product } from '@/data/mockData';
import { useStore } from '@/contexts/StoreContext';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
}

const badgeConfig = {
  featured: { label: 'Featured', className: 'badge-fire' },
  new: { label: 'New', className: 'badge-new' },
  bestseller: { label: 'Best Seller', className: 'badge-bestseller' },
};

export default function ProductCard({ product, className }: ProductCardProps) {
  const { addToCart, state } = useStore();
  const category = state.categories.find(c => c.id === product.categoryId);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.images[0] || '',
    });
  };

  return (
    <Link to={`/product/${product.id}`} className={cn('card-product block group', className)}>
      {/* Image */}
      <div className="relative overflow-hidden bg-muted aspect-[4/3]">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🎆</div>
        )}
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {product.badges.slice(0, 2).map(badge => (
            <span key={badge} className={badgeConfig[badge].className}>
              {badgeConfig[badge].label}
            </span>
          ))}
        </div>
        {/* Out of stock overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-sm font-semibold text-muted-foreground">Out of Stock</span>
          </div>
        )}
        {/* Quick add */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-primary text-primary-foreground rounded-lg p-2.5 shadow-fire hover:bg-primary-hover disabled:opacity-50"
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
          {category ? category.name : ''}
        </p>
        <h3 className="font-display font-600 text-sm sm:text-base text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {product.title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-700 font-display text-foreground">${product.price.toFixed(2)}</span>
            {product.comparePrice && (
              <span className="text-xs text-muted-foreground line-through">${product.comparePrice.toFixed(2)}</span>
            )}
          </div>
          {product.stock > 0 && product.stock <= 10 && (
            <span className="text-xs text-warning font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" />Only {product.stock} left
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
