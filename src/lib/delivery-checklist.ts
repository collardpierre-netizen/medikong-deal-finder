/** Points de contrôle de la réception d'un bon de livraison (PDF papier + page en ligne). */
export const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "packages", label: "Nombre de colis reçus conforme au bon de livraison" },
  { key: "packaging", label: "Emballages intacts, aucun colis ouvert ou écrasé" },
  { key: "quantities", label: "Quantités reçues conformes aux quantités livrées" },
  { key: "batch_expiry", label: "Numéros de lot et dates de péremption (DLU) vérifiés" },
  { key: "temperature", label: "Chaîne du froid respectée (si applicable)" },
  { key: "documents", label: "Documents d'accompagnement présents et lisibles" },
];
