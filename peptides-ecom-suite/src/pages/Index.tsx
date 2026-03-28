import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import ProductCard from '@/components/storefront/ProductCard';
import CategoryIcon from '@/components/storefront/CategoryIcon';
import heroImage from '@/assets/hero-peptides.jpg';

export default function HomePage() {
  const { state, featuredProducts } = useStore();
  const navigate = useNavigate();
  const { theme, categories, products } = state;

  const orderedSections = theme.sectionOrder || ['hero', 'featured', 'categories', 'newsletter'];

  const sectionMap: Record<string, JSX.Element | null> = {
    hero: (
      <section key="hero" className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Research peptides" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="max-w-2xl animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white/90 border border-white/20 backdrop-blur-sm bg-white/10 mb-6">
              <Sparkles className="w-4 h-4" style={{ color: theme.primaryColor }} />
              Canada's Premier Peptide Research Supplier
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-700 text-white leading-tight mb-5">
              Research-Grade<br />
              <span style={{ color: theme.primaryColor }}>Peptides</span> Delivered
            </h1>
            <p className="text-white/80 text-lg sm:text-xl mb-8 leading-relaxed">{theme.tagline}</p>
            <div className="flex flex-wrap gap-4">
              <Link to="/shop" className="btn-fire text-base px-8 py-3.5">
                Shop All Peptides <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/category/healing-recovery" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors backdrop-blur-sm">
                Browse Categories
              </Link>
            </div>
          </div>
        </div>
      </section>
    ),

    featured: theme.showFeaturedSection && featuredProducts.length > 0 ? (
      <section key="featured" className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-primary font-semibold text-sm mb-1 uppercase tracking-widest">Handpicked</p>
              <h2 className="font-display text-3xl font-700 text-foreground">Featured Products</h2>
            </div>
            <Link to="/shop?filter=featured" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {featuredProducts.slice(0, 8).map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link to="/shop?filter=featured" className="text-sm font-medium text-primary hover:underline">View all featured →</Link>
          </div>
        </div>
      </section>
    ) : null,

    categories: theme.showCategorySection ? (
      <section key="categories" className="py-16 bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-primary font-semibold text-sm mb-1 uppercase tracking-widest">Explore</p>
            <h2 className="font-display text-3xl font-700 text-foreground">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.sort((a, b) => a.sortOrder - b.sortOrder).map(cat => {
              const count = products.filter(p => p.categoryId === cat.id && p.status === 'active').length;
              return (
                <Link key={cat.id} to={`/category/${cat.slug}`}
                  className="group flex flex-col items-center text-center bg-card rounded-2xl p-6 border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300">
                  <CategoryIcon name={cat.icon} size={28} className="text-primary mb-3 group-hover:scale-110 transition-transform duration-200 block" />
                  <h3 className="font-display font-600 text-sm text-foreground group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{count} items</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    ) : null,

    newsletter: theme.showNewsletterSection ? (
      <section key="newsletter" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl p-10 sm:p-14 text-center" style={{ background: 'linear-gradient(135deg, hsl(220 22% 9%), hsl(220 22% 13%))' }}>
            <h2 className="font-display text-3xl font-700 text-white mb-3">Be First to Know</h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">Subscribe for exclusive deals, new arrivals, and seasonal promotions.</p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={e => e.preventDefault()}>
              <input type="email" placeholder="Your email address" className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/40" />
              <button className="btn-fire whitespace-nowrap px-6 py-3">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
    ) : null,
  };

  return (
    <div>
      {orderedSections.map(key => sectionMap[key])}
    </div>
  );
}
