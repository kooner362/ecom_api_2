import { useEffect, useRef, useState } from 'react';
import { ecomApi } from '@/lib/ecom-api';
import { useStore } from '@/contexts/StoreContext';
import { ImagePlus, Trash2 } from 'lucide-react';

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

interface OpeningHour {
  dayOfWeek: DayOfWeek;
  opens?: string | null;
  closes?: string | null;
  closed?: boolean;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LOGO_MAX_FILE_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_WIDTH = 400;
const LOGO_MAX_HEIGHT = 200;

function defaultOpeningHours(): OpeningHour[] {
  return DAYS.map((day) => ({ dayOfWeek: day, opens: '09:00', closes: '17:00', closed: true }));
}

export default function AdminSettings() {
  const { refreshFromApi } = useStore();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    websiteUrl: '',
    businessType: 'Store',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateOrProvince: '',
    postalCode: '',
    countryCode: '',
    logoUrl: '',
    sameAsText: '',
    openingHours: defaultOpeningHours() as OpeningHour[],
    priceRange: '',
    geoLat: '',
    geoLng: '',
    googleMapsUrl: '',
    hasPhysicalStorefront: true,
    currency: 'CAD',
    timezone: 'America/Toronto',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file for the logo.');
      return;
    }
    if (file.size > LOGO_MAX_FILE_BYTES) {
      setError('Logo file is too large. Max size is 2MB.');
      return;
    }

    try {
      const url = await ecomApi.admin.uploadFile(file);
      setForm((state) => ({ ...state, logoUrl: url }));
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload logo');
    }
  };

  useEffect(() => {
    void ecomApi.admin.storeSettings()
      .then((settings) => {
        const loadedHours = Array.isArray(settings.openingHours) && settings.openingHours.length > 0
          ? DAYS.map((day) => {
              const existing = settings.openingHours.find((entry) => entry.dayOfWeek === day);
              return existing || { dayOfWeek: day, opens: '09:00', closes: '17:00', closed: true };
            })
          : defaultOpeningHours();

        setForm({
          name: settings.name || '',
          email: settings.email || '',
          websiteUrl: settings.websiteUrl || '',
          businessType: settings.businessType || 'Store',
          phone: settings.phone || '',
          addressLine1: settings.addressLine1 || '',
          addressLine2: settings.addressLine2 || '',
          city: settings.city || '',
          stateOrProvince: settings.stateOrProvince || '',
          postalCode: settings.postalCode || '',
          countryCode: settings.countryCode || '',
          logoUrl: settings.logoUrl || '',
          sameAsText: (settings.sameAs || []).join('\n'),
          openingHours: loadedHours,
          priceRange: settings.priceRange || '',
          geoLat: typeof settings.geoLat === 'number' ? String(settings.geoLat) : '',
          geoLng: typeof settings.geoLng === 'number' ? String(settings.geoLng) : '',
          googleMapsUrl: settings.googleMapsUrl || '',
          hasPhysicalStorefront: settings.hasPhysicalStorefront ?? true,
          currency: settings.currency || 'CAD',
          timezone: settings.timezone || 'America/Toronto',
        });
      })
      .catch(() => setError('Failed to load store settings'));
  }, []);

  const save = async () => {
    setError(null);
    try {
      await ecomApi.admin.updateStoreSettings({
        name: form.name,
        email: form.email || null,
        websiteUrl: form.websiteUrl || null,
        businessType: form.businessType || null,
        phone: form.phone || null,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        stateOrProvince: form.stateOrProvince || null,
        postalCode: form.postalCode || null,
        countryCode: form.countryCode || null,
        logoUrl: form.logoUrl || null,
        sameAs: form.sameAsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        openingHours: form.openingHours,
        priceRange: form.priceRange || null,
        geoLat: form.geoLat.trim() === '' ? null : Number(form.geoLat),
        geoLng: form.geoLng.trim() === '' ? null : Number(form.geoLng),
        googleMapsUrl: form.googleMapsUrl || null,
        hasPhysicalStorefront: form.hasPhysicalStorefront,
        currency: form.currency,
        timezone: form.timezone,
      });
      await refreshFromApi();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save store settings');
    }
  };

  const setHour = (day: DayOfWeek, patch: Partial<OpeningHour>) => {
    setForm((state) => ({
      ...state,
      openingHours: state.openingHours.map((entry) =>
        entry.dayOfWeek === day ? { ...entry, ...patch } : entry
      ),
    }));
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-display text-2xl font-700 mb-2">Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">General store and LocalBusiness settings for JSON+LD.</p>
      <div className="bg-card border border-border rounded-xl p-5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1.5">Store Name</label><input value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Store Email</label><input type="email" value={form.email} onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Website URL</label><input type="url" value={form.websiteUrl} onChange={(event) => setForm((state) => ({ ...state, websiteUrl: event.target.value }))} className="input-clean" placeholder="https://example.com" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Business Type</label><input value={form.businessType} onChange={(event) => setForm((state) => ({ ...state, businessType: event.target.value }))} className="input-clean" placeholder="Store" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Phone</label><input value={form.phone} onChange={(event) => setForm((state) => ({ ...state, phone: event.target.value }))} className="input-clean" /></div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Logo URL</label>
            <input
              type="text"
              value={form.logoUrl}
              onChange={(event) => setForm((state) => ({ ...state, logoUrl: event.target.value }))}
              className="input-clean"
              placeholder="https://example.com/logo.png or upload below"
            />
          </div>
          <div><label className="block text-sm font-medium mb-1.5">Google Maps URL</label><input type="url" value={form.googleMapsUrl} onChange={(event) => setForm((state) => ({ ...state, googleMapsUrl: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Price Range</label><input value={form.priceRange} onChange={(event) => setForm((state) => ({ ...state, priceRange: event.target.value }))} className="input-clean" placeholder="$$" /></div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void uploadLogo(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
            >
              <ImagePlus className="w-3.5 h-3.5 inline mr-1" />
              Upload Logo
            </button>
            {form.logoUrl && (
              <button
                type="button"
                onClick={() => setForm((state) => ({ ...state, logoUrl: '' }))}
                className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Recommended logo dimensions: up to {LOGO_MAX_WIDTH} x {LOGO_MAX_HEIGHT}px. Uploaded images are resized automatically.
          </p>
          {form.logoUrl && (
            <div className="rounded-md border border-border bg-muted/30 p-3 inline-flex items-center gap-3">
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="w-32 h-10 object-contain bg-background rounded border border-border"
              />
              <span className="text-xs text-muted-foreground">Preview (header/sidebar use fixed display size)</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1.5">Address Line 1</label><input value={form.addressLine1} onChange={(event) => setForm((state) => ({ ...state, addressLine1: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Address Line 2</label><input value={form.addressLine2} onChange={(event) => setForm((state) => ({ ...state, addressLine2: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">City</label><input value={form.city} onChange={(event) => setForm((state) => ({ ...state, city: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">State / Province</label><input value={form.stateOrProvince} onChange={(event) => setForm((state) => ({ ...state, stateOrProvince: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Postal Code</label><input value={form.postalCode} onChange={(event) => setForm((state) => ({ ...state, postalCode: event.target.value }))} className="input-clean" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Country Code</label><input value={form.countryCode} onChange={(event) => setForm((state) => ({ ...state, countryCode: event.target.value.toUpperCase() }))} className="input-clean" placeholder="CA" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Geo Latitude</label><input value={form.geoLat} onChange={(event) => setForm((state) => ({ ...state, geoLat: event.target.value }))} className="input-clean" placeholder="43.6532" /></div>
          <div><label className="block text-sm font-medium mb-1.5">Geo Longitude</label><input value={form.geoLng} onChange={(event) => setForm((state) => ({ ...state, geoLng: event.target.value }))} className="input-clean" placeholder="-79.3832" /></div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Social Profile URLs (one per line)</label>
          <textarea value={form.sameAsText} onChange={(event) => setForm((state) => ({ ...state, sameAsText: event.target.value }))} className="input-clean min-h-28" />
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Opening Hours</p>
          <div className="space-y-2">
            {form.openingHours.map((entry) => (
              <div key={entry.dayOfWeek} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <div className="text-sm font-medium">{entry.dayOfWeek}</div>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!entry.closed}
                    onChange={(event) => setHour(entry.dayOfWeek, { closed: event.target.checked })}
                  />
                  Closed
                </label>
                <input
                  type="time"
                  disabled={!!entry.closed}
                  value={entry.opens || ''}
                  onChange={(event) => setHour(entry.dayOfWeek, { opens: event.target.value })}
                  className="input-clean"
                />
                <input
                  type="time"
                  disabled={!!entry.closed}
                  value={entry.closes || ''}
                  onChange={(event) => setHour(entry.dayOfWeek, { closes: event.target.value })}
                  className="input-clean"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1.5">Currency</label><select value={form.currency} onChange={(event) => setForm((state) => ({ ...state, currency: event.target.value }))} className="input-clean"><option value="CAD">CAD ($)</option><option value="USD">USD ($)</option></select></div>
          <div><label className="block text-sm font-medium mb-1.5">Timezone</label><select value={form.timezone} onChange={(event) => setForm((state) => ({ ...state, timezone: event.target.value }))} className="input-clean"><option value="America/Toronto">America/Toronto (ET)</option><option value="America/Vancouver">America/Vancouver (PT)</option></select></div>
          <label className="text-sm flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={form.hasPhysicalStorefront}
              onChange={(event) => setForm((state) => ({ ...state, hasPhysicalStorefront: event.target.checked }))}
            />
            Has physical storefront
          </label>
        </div>

        <button onClick={() => void save()} className="btn-fire py-2.5 px-5 text-sm">{saved ? '✓ Saved' : 'Save Settings'}</button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
