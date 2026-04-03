import SegmentLandingPage from "@/components/segment/SegmentLandingPage";
import { segmentPages } from "@/data/segment-pages-data";
export default function CabinetsMedicauxPage() {
  return <SegmentLandingPage data={segmentPages["cabinets-medicaux"]} />;
}
