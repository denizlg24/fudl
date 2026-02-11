import { requireAuth, getServerOrg, getActiveMember } from "../../lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UploadContent } from "./upload-content";
import { NoTeamState } from "../components/no-team-state";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

async function fetchGames(orgId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/games`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.games || [];
}

async function fetchSeasons(orgId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/seasons`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.seasons || [];
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const org = await getServerOrg();

  if (!org) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <NoTeamState message="Join or create a team to upload videos." />
      </div>
    );
  }

  const activeMember = await getActiveMember();
  const role = activeMember?.role ?? "member";

  // Only coaches can upload
  if (role === "member") {
    redirect("/dashboard");
  }

  const reqHeaders = await headers();
  const cookie = reqHeaders.get("cookie") || "";

  const resolvedParams = await searchParams;
  const preselectedGameId =
    typeof resolvedParams.gameId === "string" ? resolvedParams.gameId : null;

  const [games, seasons] = await Promise.all([
    fetchGames(org.id, cookie),
    fetchSeasons(org.id, cookie),
  ]);

  return (
    <UploadContent
      activeOrgId={org.id}
      games={games}
      seasons={seasons}
      preselectedGameId={preselectedGameId}
    />
  );
}
