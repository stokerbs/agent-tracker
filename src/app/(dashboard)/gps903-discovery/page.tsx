import { redirect } from "next/navigation";

// Consolidated into the tabbed /gps-devices page. Kept as a redirect so old
// bookmarks / links don't 404. The discovery UI now lives under the "discovery"
// tab (see gps-devices/discovery-panel.tsx).
export default function Gps903DiscoveryPage() {
  redirect("/gps-devices?tab=discovery");
}
