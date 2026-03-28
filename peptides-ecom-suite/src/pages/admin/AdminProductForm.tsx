import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, ToggleLeft, ToggleRight, Trash2, Upload } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { Product } from '@/data/mockData';
import { ecomApi } from '@/lib/ecom-api';

const emptyProduct: Omit<Product, 'id'> = {
  title: '',
  description: '',
  videoUrl: '',
  price: 0,
  cost: undefined,
  categoryId: '',
  images: [],
  featured: false,
  status: 'active',
  badges: [],
  stock: 0,
  sku: '',
  tags: [],
};

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function AdminProductForm() {
  const { id } = useParams();
  const location = useLocation();
  const { state, refreshFromApi } = useStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isNew = !id || location.pathname.endsWith('/new');
  const existing = !isNew ? state.products.find((p) => p.id === id) : null;

  const [form, setForm] = useState<Omit<Product, 'id'>>(existing || emptyProduct);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marginPct, setMarginPct] = useState<string>('');
  const [autoCalcCostLocked, setAutoCalcCostLocked] = useState<boolean>(true);

  useEffect(() => {
    if (existing) {
      const nextForm = { ...emptyProduct, ...existing, videoUrl: existing.videoUrl || '' };
      setForm(nextForm);
      if (
        typeof nextForm.cost === 'number' &&
        Number.isFinite(nextForm.cost) &&
        Number.isFinite(nextForm.price) &&
        nextForm.price > 0
      ) {
        const calculatedMargin = ((nextForm.price - nextForm.cost) / nextForm.price) * 100;
        setMarginPct(calculatedMargin.toFixed(2));
      } else {
        setMarginPct('');
      }
    } else {
      setMarginPct('');
    }
    setAutoCalcCostLocked(true);
  }, [existing, isNew]);

  useEffect(() => {
    if (!autoCalcCostLocked) return;
    if (!Number.isFinite(form.price) || form.price < 0) return;
    const parsedMargin = Number.parseFloat(marginPct);
    if (!Number.isFinite(parsedMargin)) return;

    const boundedMargin = Math.min(99.99, Math.max(0, parsedMargin));
    const nextCost = Number((form.price * (1 - boundedMargin / 100)).toFixed(2));

    setForm((prev) => {
      if (prev.cost === nextCost) return prev;
      return { ...prev, cost: nextCost };
    });
  }, [autoCalcCostLocked, marginPct, form.price]);

  const set = (field: keyof typeof form, val: any) => setForm((f) => ({ ...f, [field]: val }));

  const addImages = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Please upload image files only.');
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const added = await Promise.all(imageFiles.map((file) => ecomApi.admin.uploadFile(file)));
      set('images', Array.from(new Set([...(form.images || []), ...added])));
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const addImageByUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setError('Image URL must be a valid absolute URL.');
      return;
    }

    setError(null);
    set('images', Array.from(new Set([...(form.images || []), trimmed])));
    setImageUrlInput('');
  };

  const removeImageAt = (index: number) => {
    set('images', form.images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.videoUrl && !isValidAbsoluteUrl(form.videoUrl)) {
      setError('Video URL must be a valid absolute URL.');
      return;
    }

    try {
      const images = (form.images || []).filter(Boolean).map((url, index) => ({ url, sortOrder: index }));
      const videoUrl = form.videoUrl?.trim() || undefined;

      if (isNew) {
        await ecomApi.admin.createProduct({
          title: form.title,
          description: form.description,
          videoUrl,
          status: form.status === 'active' ? 'ACTIVE' : 'DRAFT',
          featured: form.featured,
          badges: form.badges,
          tags: form.tags || [],
          priceCents: Math.round((form.price || 0) * 100),
          costCents: typeof form.cost === 'number' ? Math.round(form.cost * 100) : undefined,
          compareAtPriceCents: form.comparePrice ? Math.round(form.comparePrice * 100) : undefined,
          categoryIds: form.categoryId ? [form.categoryId] : [],
          images,
        });
      } else if (existing) {
        await ecomApi.admin.updateProduct(existing.id, {
          title: form.title,
          description: form.description || null,
          videoUrl: videoUrl || null,
          status: form.status === 'active' ? 'ACTIVE' : 'DRAFT',
          featured: form.featured,
          badges: form.badges,
          tags: form.tags || [],
          categoryIds: form.categoryId ? [form.categoryId] : [],
          images,
        });

        const variantId = existing.variants?.[0]?.id;
        if (variantId) {
          await ecomApi.admin.updateVariant(variantId, {
            title: form.title,
            priceCents: Math.round((form.price || 0) * 100),
            costCents: typeof form.cost === 'number' ? Math.round(form.cost * 100) : null,
            compareAtPriceCents: form.comparePrice ? Math.round(form.comparePrice * 100) : null,
          });
        }
      }

      await refreshFromApi();
      navigate('/admin/products');
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to save product');
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate('/admin/products')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="font-display text-2xl font-700 mb-6">{isNew ? 'Add Product' : 'Edit Product'}</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-display font-600 text-base mb-1">Basic Info</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Title *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required className="input-clean" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              className="input-clean resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Product Video URL</label>
            <input
              value={form.videoUrl || ''}
              onChange={(e) => set('videoUrl', e.target.value)}
              className="input-clean"
              placeholder="https://... (YouTube or direct video URL)"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Price *</label>
              <input
                type="number"
                step="0.01"
                value={Number.isFinite(form.price) ? form.price : ''}
                onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                required
                className="input-clean"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Cost</label>
              <input
                type="number"
                step="0.01"
                value={form.cost ?? ''}
                onChange={(e) => set('cost', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                className="input-clean"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Compare Price</label>
              <input
                type="number"
                step="0.01"
                value={form.comparePrice || ''}
                onChange={(e) => set('comparePrice', parseFloat(e.target.value) || undefined)}
                className="input-clean"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Margin %</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                max={99.99}
                value={marginPct}
                onChange={(e) => setMarginPct(e.target.value)}
                className="input-clean"
                placeholder="e.g. 30"
              />
              <button
                type="button"
                onClick={() => setAutoCalcCostLocked((value) => !value)}
                className="h-10 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted flex items-center gap-1.5 shrink-0"
                title={autoCalcCostLocked ? 'Auto-calc is on' : 'Auto-calc is off'}
              >
                {autoCalcCostLocked ? (
                  <ToggleRight className="w-4 h-4 text-primary" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                )}
                Auto-calc cost
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cost = Price x (1 - Margin / 100)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">SKU</label>
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} className="input-clean" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => set('stock', parseInt(e.target.value, 10) || 0)}
                className="input-clean"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Category *</label>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required className="input-clean">
              <option value="">Select category…</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium">Product Images</label>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    void addImages(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
              >
                <ImagePlus className="w-3.5 h-3.5 inline mr-1" /> Upload
              </button>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  void addImages(e.dataTransfer.files);
                }
              }}
              className={`rounded-lg border border-dashed p-5 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
              }`}
            >
              <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">Drag and drop multiple images here</p>
              <p className="text-xs text-muted-foreground mt-1">or use the Upload button</p>
              {isUploading && <p className="text-xs text-muted-foreground mt-2">Processing images...</p>}
            </div>

            <div className="flex gap-2">
              <input
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="input-clean"
                placeholder="Optional: add image by URL"
              />
              <button
                type="button"
                onClick={addImageByUrl}
                className="px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted"
              >
                Add
              </button>
            </div>

            {form.images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {form.images.map((img, index) => (
                  <div key={`${img}-${index}`} className="relative group rounded-md overflow-hidden border border-border bg-muted/20">
                    <img src={img} alt={`Product ${index + 1}`} className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImageAt(index)}
                      className="absolute top-1 right-1 p-1 rounded bg-background/90 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tags</label>
            <input
              value={(form.tags || []).join(', ')}
              onChange={(e) =>
                set(
                  'tags',
                  e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                )
              }
              className="input-clean"
              placeholder="aerial, wedding, premium"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-display font-600 text-base mb-1">Visibility & Flags</h2>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">Active products are visible in the storefront.</p>
            </div>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input-clean w-auto text-sm">
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <p className="text-sm font-medium">Featured</p>
              <p className="text-xs text-muted-foreground">Featured products appear on the homepage Featured section.</p>
            </div>
            <button type="button" onClick={() => set('featured', !form.featured)}>
              {form.featured ? (
                <ToggleRight className="w-8 h-8 text-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-2">Badges</p>
            <div className="flex flex-wrap gap-3">
              {(['new', 'bestseller', 'featured'] as const).map((badge) => (
                <label key={badge} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.badges.includes(badge)}
                    onChange={(e) =>
                      set(
                        'badges',
                        e.target.checked ? [...form.badges, badge] : form.badges.filter((x) => x !== badge)
                      )
                    }
                    className="accent-primary"
                  />
                  <span className="text-sm capitalize">{badge}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-fire px-6 py-2.5">
            {isNew ? 'Create Product' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
