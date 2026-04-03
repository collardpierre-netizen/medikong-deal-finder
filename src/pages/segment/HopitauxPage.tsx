import SegmentLandingPage from "@/components/segment/SegmentLandingPage";
import { segmentPages } from "@/data/segment-pages-data";
export default function HopitauxPage() {
  return <SegmentLandingPage data={segmentPages.hopitaux} />;
}
