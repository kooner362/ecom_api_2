import { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <div className="text-center mb-12">
        <p className="text-primary font-semibold text-sm mb-2 uppercase tracking-widest">Get in Touch</p>
        <h1 className="font-display text-3xl sm:text-4xl font-700">Contact Us</h1>
        <p className="text-muted-foreground mt-3">We're here to help. Reach out and we'll respond within one business day.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Info */}
        <div className="space-y-5">
          {[
            { Icon: Mail, title: 'Email', lines: ['info@realcanadianpeptides.ca', 'orders@realcanadianpeptides.ca'] },
            // { Icon: Phone, title: 'Phone', lines: ['1-800-FIRE-KING', 'Mon–Fri, 9am–6pm ET'] },
            // { Icon: MapPin, title: 'Address', lines: ['100 Sparks Way', 'Toronto, ON M5V 1A1'] },
          ].map(({ Icon, title, lines }) => (
            <div key={title} className="flex gap-4 bg-card border border-border rounded-xl p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-600 text-sm mb-1">{title}</p>
                {lines.map(l => <p key={l} className="text-sm text-muted-foreground">{l}</p>)}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          {sent ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
              <h3 className="font-display font-700 text-xl mb-2">Message Sent!</h3>
              <p className="text-muted-foreground">Thanks, {form.name}. We'll get back to you at {form.email} shortly.</p>
              <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="mt-5 text-sm text-primary hover:underline">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} required className="input-clean" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} required className="input-clean" placeholder="jane@example.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Subject *</label>
                <select name="subject" value={form.subject} onChange={handleChange} required className="input-clean">
                  <option value="">Select a topic…</option>
                  <option>Order Inquiry</option>
                  <option>Product Question</option>
                  <option>Bulk / Event Pricing</option>
                  <option>Shipping</option>
                  <option>Returns / Refunds</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Message *</label>
                <textarea name="message" value={form.message} onChange={handleChange} required rows={5}
                  className="input-clean resize-none" placeholder="How can we help?" />
              </div>
              <button type="submit" className="btn-fire w-full py-3.5 justify-center">Send Message</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
