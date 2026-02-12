import { notFound } from "next/navigation";
import { requireAuth, getServerOrg, getActiveMember } from "../../../lib/auth";
import { headers } from "next/headers";
import { GamePlayback } from "./game-playback";
import { NoTeamState } from "../../components/no-team-state";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

async function fetchGameDetail(orgId: string, gameId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/games/${gameId}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.game || null;
}

async function fetchAllGames(orgId: string, cookie: string) {
  const res = await fetch(`${API_URL}/orgs/${orgId}/games`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.games || [];
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  await requireAuth();
  const org = await getServerOrg();

  if (!org) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <NoTeamState message="Join or create a team to view games." />
      </div>
    );
  }

  const { gameId } = await params;
  const reqHeaders = await headers();
  const cookie = reqHeaders.get("cookie") || "";

  const [game, allGames, activeMember] = await Promise.all([
    fetchGameDetail(org.id, gameId, cookie),
    fetchAllGames(org.id, cookie),
    getActiveMember(),
  ]);

  if (!game) {
    notFound();
  }

  const role = activeMember?.role ?? "member";

  // Map allGames to sidebar-friendly shape
  const sidebarGames = allGames.map((g: Record<string, unknown>) => ({
    id: g.id as string,
    title: g.title as string,
    date: g.date as string | null,
    seasonId: g.seasonId as string,
    season: g.season as { id: string; name: string } | null,
    tags:
      (g.tags as Array<{ id: string; name: string; category: string }>) ?? [],
    videoCount: (g._count as Record<string, number>)?.videos ?? 0,
  }));

  return <GamePlayback game={game} sidebarGames={sidebarGames} role={role} />;
}
