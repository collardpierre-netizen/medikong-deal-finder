import { Layout } from "@/components/layout/Layout";
import { MailX } from "lucide-react";

export default function UnsubscribePage() {
  return (
    <Layout>
      <div className="mk-container py-20 text-center max-w-md mx-auto">
        <div className="flex flex-col items-center gap-5">
          <MailX className="w-12 h-12 text-mk-navy" />
          <h1 className="text-2xl font-bold text-mk-navy">Se désabonner</h1>
          <p className="text-mk-sec text-sm">
            Pour vous désabonner de nos emails, utilisez le lien de
            désabonnement présent en bas de chaque email que nous envoyons.
            Le désabonnement est pris en compte immédiatement.
          </p>
        </div>
      </div>
    </Layout>
  );
}
