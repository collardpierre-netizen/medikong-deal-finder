import SegmentLandingPage from "@/components/segment/SegmentLandingPage";
import { segmentPages } from "@/data/segment-pages-data";
export default function GrossistesPage() {
  return <SegmentLandingPage data={segmentPages.grossistes} />;
}
