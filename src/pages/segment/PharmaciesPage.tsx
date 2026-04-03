import SegmentLandingPage from "@/components/segment/SegmentLandingPage";
import { segmentPages } from "@/data/segment-pages-data";
export default function PharmaciesPage() {
  return <SegmentLandingPage data={segmentPages.pharmacies} />;
}
