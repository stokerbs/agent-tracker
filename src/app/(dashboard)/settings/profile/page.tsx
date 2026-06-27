import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { userHasPin } from "@/lib/security/pin-status";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { SetPinSection } from "@/components/settings/set-pin-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_META } from "@/lib/constants";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const t = await getTranslations("profile");
  const tUsers = await getTranslations("users.roles");
  const roleMeta = ROLE_META[profile.role];
  const hasPin = await userHasPin(profile.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p>{profile.full_name}</p>
              <Badge className={`mt-1 ${roleMeta.badge}`}>
                {tUsers(profile.role)}
              </Badge>
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

      <SetPinSection hasPin={hasPin} />

      <DeleteAccountSection />
    </div>
  );
}
