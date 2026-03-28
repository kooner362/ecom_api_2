import { useEffect, useState } from 'react';
import { Flame, Award, Users, Shield } from 'lucide-react';
import { ecomApi } from '@/lib/ecom-api';

const stats = [
  { label: 'Years in Business', value: '15+' },
  { label: 'Happy Customers', value: '50,000+' },
  { label: 'Products Available', value: '500+' },
  { label: 'Provinces Served', value: '13' },
];

const values = [
  { Icon: Award, title: 'Premium Quality', desc: 'Only the finest consumer and professional-grade fireworks, sourced from trusted manufacturers worldwide.' },
  { Icon: Shield, title: 'Safety First', desc: 'All products meet Canadian safety standards. We include safety instructions with every order.' },
  { Icon: Users, title: 'Expert Guidance', desc: 'Our team has decades of combined experience helping customers find the perfect products for their needs.' },
  { Icon: Flame, title: 'Unforgettable Moments', desc: 'We exist to make your celebrations spectacular, from intimate backyard shows to large-scale events.' },
];

export default function AboutPage() {
  const [headline, setHeadline] = useState("Canada's Most Trusted Fireworks Retailer");
  const [description, setDescription] = useState(
    "Founded in 2009, fireking.ca has been Canada's go-to destination for premium consumer and professional fireworks. From sparklers to spectacular aerial shows, we have everything to make your celebration extraordinary."
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const page = await ecomApi.store.page('about');
        const body = (page.body || {}) as Record<string, unknown>;
        if (!active) return;
        if (typeof body.heading === 'string' && body.heading.trim()) setHeadline(body.heading);
        if (typeof body.description === 'string' && body.description.trim()) setDescription(body.description);
      } catch {
        // keep fallback content
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <div className="bg-[hsl(220_22%_9%)] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-primary font-semibold text-sm mb-3 uppercase tracking-widest">Our Story</p>
          <h1 className="font-display text-4xl sm:text-5xl font-700 text-white mb-5">
            {headline}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {stats.map(stat => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-3xl sm:text-4xl font-700 text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-700">What We Stand For</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-700 text-base mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
