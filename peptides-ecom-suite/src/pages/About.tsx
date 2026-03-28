import { FlaskConical, Award, Users, Shield, Microscope, FileCheck, Thermometer, Truck } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';

const stats = [
  { label: 'Peptides Available', value: '60+' },
  { label: 'Average Purity', value: '≥99%' },
  { label: 'Researchers Served', value: '10,000+' },
  { label: 'Provinces Shipped To', value: '13' },
];

const values = [
  { Icon: Award, title: 'Pharmaceutical-Grade Purity', desc: 'Every peptide undergoes rigorous HPLC and mass spectrometry analysis to guarantee ≥99% purity before reaching your lab.' },
  { Icon: Shield, title: 'Third-Party Verified', desc: 'Independent laboratories validate each batch. We never self-certify — transparency and trust are non-negotiable.' },
  { Icon: Users, title: 'Expert Support', desc: 'Our team of biochemists and research specialists provides guidance on reconstitution, storage, and peptide selection.' },
  { Icon: FlaskConical, title: 'Consumer-First Mission', desc: 'We exist to advance scientific discovery by making premium peptides accessible to Canadian consumers.' },
];

const process = [
  { Icon: Microscope, title: 'Synthesis', desc: 'Solid-phase peptide synthesis (SPPS) under strict GMP-adjacent conditions with premium Fmoc-protected amino acids.' },
  { Icon: FileCheck, title: 'HPLC Testing', desc: 'Every batch is analysed via reverse-phase HPLC. We publish full chromatograms and mass-spec data on each Certificate of Analysis.' },
  { Icon: Thermometer, title: 'Lyophilisation & Storage', desc: 'Peptides are freeze-dried for maximum stability and stored at -20 °C until shipment to preserve bioactivity.' },
  { Icon: Truck, title: 'Cold-Chain Shipping', desc: 'Orders ship with insulated packaging and ice packs. Expedited Canada-wide delivery ensures product integrity on arrival.' },
];

export default function AboutPage() {
  const { state } = useStore();
  return (
    <div>
      {/* Hero */}
      <div className="bg-[hsl(220_22%_9%)] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-primary font-semibold text-sm mb-3 uppercase tracking-widest">About Us</p>
          <h1 className="font-display text-4xl sm:text-5xl font-700 text-white mb-5">
            {"Canada's Trusted Source for Peptides"}
          </h1>
          <p className="text-white/65 text-lg leading-relaxed">
            {`${state.storeSettings.name} supplies premium, HPLC-verified peptides to consumers and institutions across Canada. Every product ships with care and transparency.`}
          </p>
        </div>
      </div>

      {/* Stats */}
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

      {/* Mission */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="font-display text-2xl sm:text-3xl font-700 mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            We believe breakthrough quality shouldn't be gated by supply-chain barriers. Our mission is to provide Canadians with the highest-purity peptides at competitive prices, backed by transparent testing data and responsive scientific support. Every vial that leaves our facility carries the same standard of quality we'd demand for our own use.
          </p>
        </div>

        {/* Values */}
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-700">What We Stand For</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
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

        {/* QA Process */}
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-700 mb-2">From Synthesis to Your Lab</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Our four-step quality pipeline ensures every peptide meets the highest analytical standards before it ships.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {process.map(({ Icon, title, desc }, i) => (
            <div key={title} className="relative bg-card border border-border rounded-2xl p-6">
              <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mt-2">
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
