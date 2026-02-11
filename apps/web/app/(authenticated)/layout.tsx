import { requireAuth, getServerOrg, listUserOrgs } from "../lib/auth";
import { NavBar } from "./components/nav-bar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  const [org, orgsList] = await Promise.all([
    session.session.activeOrganizationId ? getServerOrg() : null,
    listUserOrgs(),
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

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        userName={userName}
        userEmail={userEmail}
        orgName={orgName}
        activeOrgId={activeOrgId}
        orgs={orgs}
      />
      <main>{children}</main>
    </div>
  );
}
