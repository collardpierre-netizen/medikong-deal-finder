import { Navigate } from "react-router-dom";

// VendorLogistics redirects to VendorShipments — the dedicated shipments page
export default function VendorLogistics() {
  return <Navigate to="/vendor/shipments" replace />;
}
