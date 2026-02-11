import { requireAuth, listUserOrgs } from "../../../lib/auth";
import { prisma } from "@repo/db";
import {
  ProfileSettingsContent,
  type ProfileInitialData,
} from "./profile-content";

export default async function ProfileSettingsPage() {
  const session = await requireAuth();
  const orgs = await listUserOrgs();

  const user = session.user;

  const ownedMemberships = await prisma.member.findMany({
    where: { userId: session.user.id, role: "owner" },
    select: {
      organizationId: true,
      organization: { select: { name: true } },
    },
  });

  const soleOwnedOrgNames: string[] = [];
  for (const m of ownedMemberships) {
    const ownerCount = await prisma.member.count({
      where: { organizationId: m.organizationId, role: "owner" },
    });
    if (ownerCount <= 1) {
      soleOwnedOrgNames.push(m.organization.name);
    }
  }

  const initialData: ProfileInitialData = {
    userName: session.user.name || "User",
    userEmail: session.user.email || "",
    activeOrgId: session.session.activeOrganizationId ?? undefined,
    orgs: (orgs ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
    })),
    soleOwnedOrgNames,
    profile: {
      sport: user.sport || "",
      position: user.position || "",
      heightCm: user.heightCm ? user.heightCm.toString() : "",
      weightKg: user.weightKg ? user.weightKg.toString() : "",
      dateOfBirth: user.dateOfBirth
        ? user.dateOfBirth.slice(0, 10)
        : "",
      city: user.city || "",
      country: user.country || "",
      jerseyNumber: user.jerseyNumber ? user.jerseyNumber.toString() : "",
      bio: user.bio || "",
      instagramHandle: user.instagramHandle || "",
      twitterHandle: user.twitterHandle || "",
    },
  };

  return <ProfileSettingsContent initialData={initialData} />;
}
