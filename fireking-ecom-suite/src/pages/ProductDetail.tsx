import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart, Shield, Truck, RotateCcw, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import ProductCard from '@/components/storefront/ProductCard';

const badgeStyles: Record<string, string> = {
  featured: 'badge-fire',
  new: 'badge-new',
  bestseller: 'badge-bestseller',
};
const badgeLabels: Record<string, string> = {
  featured: 'Featured', new: 'New', bestseller: 'Best Seller',
};

function getYoutubeEmbedUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = url.pathname.replace('/', '').trim();
    } else if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2] || '';
      } else {
        videoId = url.searchParams.get('v') || '';
      }
    }

    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

function getYoutubeVideoId(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (host === 'youtu.be') {
      return url.pathname.replace('/', '').trim() || null;
    }
    if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2] || null;
      }
      return url.searchParams.get('v');
    }
    return null;
  } catch {
    return null;
  }
}

function isValidAbsoluteUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, addToCart } = useStore();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [selectedMedia, setSelectedMedia] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const product = state.products.find(p => p.id === id);
  const category = product ? state.categories.find(c => c.id === product.categoryId) : undefined;
  const related = product
    ? state.products.filter(p => p.categoryId === product.categoryId && p.id !== product.id && p.status === 'active').slice(0, 4)
    : [];
  const variant = product?.variants?.find(v => v.id === selectedVariant);
  const price = variant?.price ?? product?.price ?? 0;
  const embedUrl = getYoutubeEmbedUrl(product?.videoUrl);
  const hasDirectVideo = Boolean(product?.videoUrl && !embedUrl && isValidAbsoluteUrl(product.videoUrl));
  const youtubeVideoId = getYoutubeVideoId(product?.videoUrl);

  const mediaItems: Array<{ type: 'image' | 'youtube' | 'video'; src: string; thumb?: string | null }> = [
    ...((product?.images || []).map((src) => ({ type: 'image' as const, src }))),
    ...(embedUrl
      ? [{ type: 'youtube' as const, src: embedUrl, thumb: youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg` : null }]
      : []),
    ...(hasDirectVideo ? [{ type: 'video' as const, src: product?.videoUrl as string, thumb: null }] : []),
  ];
  const currentMedia = mediaItems[selectedMedia];

  useEffect(() => {
    setSelectedMedia(0);
  }, [product?.id]);

  useEffect(() => {
    if (selectedMedia >= mediaItems.length) {
      setSelectedMedia(0);
    }
  }, [mediaItems.length, selectedMedia]);

  const goPrev = () => setSelectedMedia((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  const goNext = () => setSelectedMedia((prev) => (prev + 1) % mediaItems.length);

  const handleAdd = () => {
    if (!product) return;
    addToCart({ productId: product.id, title: product.title, price, image: product.images[0] || '', quantity: qty, variantId: selectedVariant || undefined });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (!product) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-2xl">Product not found</p>
      <button onClick={() => navigate('/shop')} className="mt-4 text-primary hover:underline">Back to shop</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border">
            {currentMedia?.type === 'image' ? (
              <img src={currentMedia.src} alt={product.title} className="w-full h-full object-cover" />
            ) : currentMedia?.type === 'youtube' ? (
              <iframe
                src={currentMedia.src}
                title={`${product.title} video`}
                className="w-full h-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : currentMedia?.type === 'video' ? (
              <video src={currentMedia.src} controls className="w-full h-full object-cover" preload="metadata" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">🎆</div>
            )}

            {mediaItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 border border-border hover:bg-background"
                  aria-label="Previous media"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 border border-border hover:bg-background"
                  aria-label="Next media"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {mediaItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, i) => (
                <button
                  key={`${item.type}-${item.src}-${i}`}
                  onClick={() => setSelectedMedia(i)}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors shrink-0 ${i === selectedMedia ? 'border-primary' : 'border-border'}`}
                  aria-label={`View media ${i + 1}`}
                >
                  {item.type === 'image' ? (
                    <img src={item.src} alt="" className="w-full h-full object-cover" />
                  ) : item.type === 'youtube' && item.thumb ? (
                    <>
                      <img src={item.thumb} alt="" className="w-full h-full object-cover" />
                      <span className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </span>
                    </>
                  ) : (
                    <span className="w-full h-full bg-foreground/90 text-background flex items-center justify-center">
                      <Play className="w-4 h-4 fill-current" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {category && <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-2">{category.name}</p>}
          <div className="flex flex-wrap gap-2 mb-3">
            {product.badges.map(b => <span key={b} className={badgeStyles[b]}>{badgeLabels[b]}</span>)}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-700 text-foreground mb-3">{product.title}</h1>
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-3xl font-display font-700 text-foreground">${price.toFixed(2)}</span>
            {product.comparePrice && <span className="text-lg text-muted-foreground line-through">${product.comparePrice.toFixed(2)}</span>}
            {product.comparePrice && <span className="badge-new">Save ${(product.comparePrice - price).toFixed(2)}</span>}
          </div>

          <p className="text-muted-foreground leading-relaxed mb-6">{product.description}</p>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold mb-2">Choose option:</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map(v => (
                  <button key={v.id} onClick={() => setSelectedVariant(v.id)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedVariant === v.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                    {v.name} — ${v.price.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + Add */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2.5 hover:bg-muted transition-colors text-lg">−</button>
              <span className="px-4 py-2.5 text-sm font-semibold min-w-[40px] text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-3 py-2.5 hover:bg-muted transition-colors text-lg">+</button>
            </div>
            <button onClick={handleAdd} disabled={product.stock === 0}
              className="flex-1 btn-fire py-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {added ? '✓ Added to Cart!' : product.stock === 0 ? 'Out of Stock' : (<><ShoppingCart className="w-4 h-4" /> Add to Cart</>)}
            </button>
          </div>

          <div className="text-sm text-muted-foreground mb-6">
            {product.stock > 0 ? <span className="text-success font-medium">● In Stock ({product.stock} available)</span> : <span className="text-destructive font-medium">● Out of Stock</span>}
            {product.sku && <span className="ml-4">SKU: {product.sku}</span>}
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 pt-5 border-t border-border">
            {[
              { Icon: Truck, label: 'Free shipping over $200' },
              { Icon: Shield, label: 'Safe & legal products' },
              { Icon: RotateCcw, label: '30-day returns (unopened)' },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-1.5">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-700 mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
