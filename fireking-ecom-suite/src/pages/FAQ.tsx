import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';

export default function FAQPage() {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
      <div className="text-center mb-12">
        <p className="text-primary font-semibold text-sm mb-2 uppercase tracking-widest">Help Center</p>
        <h1 className="font-display text-3xl sm:text-4xl font-700 text-foreground">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mt-3 text-lg">Everything you need to know about our products and policies.</p>
      </div>
      <div className="space-y-3">
        {[...state.faqs].sort((a, b) => a.sortOrder - b.sortOrder).map(faq => (
          <div key={faq.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === faq.id ? null : faq.id)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="font-display font-600 text-sm sm:text-base pr-4">{faq.question}</span>
              {open === faq.id ? <ChevronUp className="w-4 h-4 shrink-0 text-primary" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
            </button>
            {open === faq.id && (
              <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4 animate-fade-in">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
