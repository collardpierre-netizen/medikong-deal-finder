import { TrustProcessLayout } from "@/components/trust/TrustProcessLayout";

interface LegalContentProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalContent({ title, lastUpdated, children }: LegalContentProps) {
  return (
    <TrustProcessLayout>
      <section className="bg-[#F8FAFC]">
        <div className="max-w-[800px] mx-auto px-4 md:px-12 py-14 md:py-16 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-mk-navy tracking-tight">{title}</h1>
        </div>
      </section>
      <div className="max-w-[800px] mx-auto px-4 md:px-12 py-10 md:py-14">
        <p className="text-xs text-muted-foreground italic text-center mb-8">Dernière mise à jour : {lastUpdated}</p>
        <div className="legal-prose">{children}</div>
      </div>
    </TrustProcessLayout>
  );
}
