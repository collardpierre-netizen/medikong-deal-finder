import { useParams } from "react-router-dom";
import { CarePlaceholder } from "@/components/care/CarePlaceholder";

export default function CareGroupBackOfficePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <CarePlaceholder
      title="Back-office Groupe"
      subtitle={id ? `Identifiant : ${id}` : undefined}
      description="Écran livré à l'étape back-office minimal."
    />
  );
}
