import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_META } from "@/lib/constants";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const roleMeta = ROLE_META[profile.role];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My Profile" description="Manage your account details." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p>{profile.full_name}</p>
              <Badge className={`mt-1 ${roleMeta.badge}`}>{roleMeta.label}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultName={profile.full_name ?? ""}
            defaultPhone={profile.phone ?? ""}
            email={profile.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
