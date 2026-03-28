import type { CookieEntry } from "@/data/legal-data";

export function CookieTable({ cookies }: { cookies: CookieEntry[] }) {
  return (
    <div className="w-full border border-mk-line rounded-xl overflow-hidden my-5">
      <table className="w-full">
        <thead>
          <tr>
            <th className="px-5 py-3.5 text-left text-xs font-bold text-muted-foreground bg-[#F8FAFC] border-b border-mk-line">Nom</th>
            <th className="px-5 py-3.5 text-left text-xs font-bold text-muted-foreground bg-[#F8FAFC] border-b border-mk-line">Finalité</th>
            <th className="px-5 py-3.5 text-left text-xs font-bold text-muted-foreground bg-[#F8FAFC] border-b border-mk-line">Durée</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map(c => (
            <tr key={c.name} className="border-b border-mk-line last:border-0">
              <td className="px-5 py-3.5 text-sm font-medium text-mk-navy">{c.name}</td>
              <td className="px-5 py-3.5 text-sm text-foreground">{c.purpose}</td>
              <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
