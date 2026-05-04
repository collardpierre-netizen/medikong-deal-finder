import { useEffect } from "react";

export default function PitchdeckRedirect() {
  useEffect(() => {
    window.location.replace("/pitchdeck-medikong.pdf");
  }, []);
  return null;
}
