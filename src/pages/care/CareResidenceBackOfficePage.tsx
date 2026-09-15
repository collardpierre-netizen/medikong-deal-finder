import { useParams } from "react-router-dom";
import { CarePlaceholder } from "@/components/care/CarePlaceholder";

export default function CareResidenceBackOfficePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <CarePlaceholder
      title="Back-office Résidence"
      subtitle={id ? `Identifiant : ${id}` : undefined}
      description="Création de résidence, chambres/résidents, produits, utilisateurs et PIN : étape suivante."
    />
  );
}
