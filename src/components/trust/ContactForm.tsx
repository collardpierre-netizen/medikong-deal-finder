import { useState } from "react";
import { Send } from "lucide-react";

export function ContactForm({ subjects }: { subjects: string[] }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", company: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-mk-navy mb-2">Message envoyé !</h3>
        <p className="text-sm text-muted-foreground">Nous vous répondrons sous 24h ouvrées.</p>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 border border-mk-line rounded-xl text-sm focus:outline-none focus:border-mk-blue transition-colors";
  const labelClass = "text-sm font-semibold text-mk-navy mb-1.5 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Prénom *</label>
          <input required className={inputClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Nom *</label>
          <input required className={inputClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Email professionnel *</label>
        <input required type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Établissement / Entreprise</label>
        <input className={inputClass} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Sujet *</label>
        <select required className={inputClass} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
          <option value="">Choisissez un sujet...</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Message *</label>
        <textarea required className={`${inputClass} min-h-[120px]`} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
      </div>
      <button type="submit" className="w-full bg-[#1B5BDA] hover:bg-[#1549b8] text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
        <Send size={16} /> Envoyer le message
      </button>
    </form>
  );
}
