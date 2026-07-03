import { redirect } from "next/navigation";

// Consolidated into the tabbed /gps-devices page. Kept as a redirect so old
// bookmarks / links don't 404. The credentials UI now lives under the
// "credentials" tab (see gps-devices/credentials-panel.tsx).
export default function Gps903CredentialsPage() {
  redirect("/gps-devices?tab=credentials");
}
