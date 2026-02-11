import {
  requireAuth,
  getServerOrg,
  listUserOrgs,
  getActiveMember,
} from "../lib/auth";
import { NavBar } from "./components/nav-bar";
import { UploadStoreProvider } from "../lib/upload-store";
import { UploadIndicator } from "./components/upload-indicator";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  const hasActiveOrg = !!session.session.activeOrganizationId;

  const [org, orgsList, activeMember] = await Promise.all([
    hasActiveOrg ? getServerOrg() : null,
    listUserOrgs(),
    hasActiveOrg ? getActiveMember() : null,
  ]);

  const orgs = (orgsList ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
  }));

  const userName = session.user.name || "User";
  const userEmail = session.user.email || "";
  const orgName = org?.name ?? null;
  const activeOrgId = org?.id ?? null;
  const role = (activeMember as Record<string, unknown> | null)?.role as
    | string
    | null;

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        userName={userName}
        userEmail={userEmail}
        orgName={orgName}
        activeOrgId={activeOrgId}
        role={role ?? null}
        orgs={orgs}
      />
      <UploadStoreProvider>
        <main>{children}</main>
        <UploadIndicator />
      </UploadStoreProvider>
    </div>
  );
}
