import { notFound } from "next/navigation";
import { requireAuth, getServerOrg, getActiveMember } from "../../../lib/auth";
import { headers } from "next/headers";
import { GamePlayback } from "./game-playback";
import { NoTeamState } from "../../components/no-team-state";
import { clientEnv } from "@repo/env/web";
import type { AnnotationData } from "@repo/types";

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

async function fetchGameClips(
  orgId: string,
  gameId: string,
  cookie: string,
) {
  const res = await fetch(
    `${API_URL}/orgs/${orgId}/clips?gameId=${gameId}`,
    { headers: { cookie }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.clips || [];
}

async function fetchGameAnnotations(
  orgId: string,
  videoIds: string[],
  cookie: string,
): Promise<AnnotationData[]> {
  // Fetch annotations for all videos in parallel
  const results = await Promise.all(
    videoIds.map(async (videoId) => {
      const res = await fetch(
        `${API_URL}/orgs/${orgId}/annotations?videoId=${videoId}`,
        { headers: { cookie }, cache: "no-store" },
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.annotations || []) as AnnotationData[];
    }),
  );
  return results.flat();
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const session = await requireAuth();
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

  const [game, allGames, clips, activeMember] = await Promise.all([
    fetchGameDetail(org.id, gameId, cookie),
    fetchAllGames(org.id, cookie),
    fetchGameClips(org.id, gameId, cookie),
    getActiveMember(),
  ]);

  if (!game) {
    notFound();
  }

  // Fetch annotations for all videos in this game (needs video IDs from game data)
  const videoIds = (game.videos as Array<{ id: string }>).map(
    (v) => v.id,
  );
  const annotationsData =
    videoIds.length > 0
      ? await fetchGameAnnotations(org.id, videoIds, cookie)
      : [];

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

  return (
    <GamePlayback
      game={game}
      sidebarGames={sidebarGames}
      initialClips={clips}
      initialAnnotations={annotationsData}
      role={role}
      orgId={org.id}
      userId={session.user.id}
    />
  );
}
