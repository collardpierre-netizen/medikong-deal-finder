import SegmentLandingPage from "@/components/segment/SegmentLandingPage";
import { segmentPages } from "@/data/segment-pages-data";
export default function DentistesPage() {
  return <SegmentLandingPage data={segmentPages.dentistes} />;
}
