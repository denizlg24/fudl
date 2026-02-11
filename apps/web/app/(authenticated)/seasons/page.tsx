import { requireAuth, getServerOrg, getActiveMember } from "../../lib/auth";
import { headers } from "next/headers";
import { SeasonsContent } from "./seasons-content";
import { NoTeamState } from "../components/no-team-state";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

async function fetchSeasons(orgId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/seasons`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.seasons || [];
}

export default async function SeasonsPage() {
  await requireAuth();
  const org = await getServerOrg();

  if (!org) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <NoTeamState message="Join or create a team to manage seasons." />
      </div>
    );
  }

  const reqHeaders = await headers();
  const cookie = reqHeaders.get("cookie") || "";

  const [seasons, activeMember] = await Promise.all([
    fetchSeasons(org.id, cookie),
    getActiveMember(),
  ]);

  const role = activeMember?.role ?? "member";

  return (
    <SeasonsContent initialSeasons={seasons} role={role} activeOrgId={org.id} />
  );
}
