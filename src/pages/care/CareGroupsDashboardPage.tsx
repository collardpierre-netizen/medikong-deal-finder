import { useParams } from "react-router-dom";
import { CarePlaceholder } from "@/components/care/CarePlaceholder";

export default function CareGroupsDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <CarePlaceholder
      title="Tableau de bord multi-groupes"
      subtitle={slug ? `Groupe : ${slug}` : undefined}
      description="Écran livré à l'étape back-office minimal."
    />
  );
}
