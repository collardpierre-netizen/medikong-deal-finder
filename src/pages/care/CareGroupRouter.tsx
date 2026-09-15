import { useParams } from "react-router-dom";
import CareGroupsDashboardPage from "./CareGroupsDashboardPage";
import CareGroupBackOfficePage from "./CareGroupBackOfficePage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/groups/:param` sert deux écrans distincts (section 1 bis) :
 * - identifiant UUID → back-office Groupe
 * - slug             → tableau de bord multi-groupes
 */
export default function CareGroupRouter() {
  const { param } = useParams<{ param: string }>();
  return UUID_RE.test(param ?? "") ? <CareGroupBackOfficePage /> : <CareGroupsDashboardPage />;
}
