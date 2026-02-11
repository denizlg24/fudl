import { requireAuth, getServerOrg } from "../../lib/auth";
import { roleBadgeVariant, getRoleDisplayName } from "@repo/types";
import { Badge } from "@repo/ui/components/badge";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Separator } from "@repo/ui/components/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Users } from "lucide-react";
import { NoTeamState } from "../components/no-team-state";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface MemberData {
  id: string;
  role: string;
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

function MemberRow({
  member,
  isSelf,
}: {
  member: MemberData;
  isSelf: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors">
      <Avatar className="size-10">
        <AvatarFallback className="text-sm">
          {getInitials(member.user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {member.user.name}
          {isSelf && (
            <span className="text-muted-foreground font-normal"> (you)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {member.user.email}
        </p>
      </div>

      <Badge variant={roleBadgeVariant(member.role)}>
        {getRoleDisplayName(member.role)}
      </Badge>
    </div>
  );
}

export default async function RosterPage() {
  const session = await requireAuth();
  const org = await getServerOrg();

  if (!org) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <NoTeamState message="Join or create a team to see the roster." />
      </div>
    );
  }

  const members = (org.members ?? []) as MemberData[];
  const orgName = org.name || "Team";
  const currentUserId = session.user.id;

  // Group members by role: owners/coaches first, then players
  const coaches = members.filter(
    (m) => m.role === "owner" || m.role === "admin",
  );
  const players = members.filter(
    (m) => m.role !== "owner" && m.role !== "admin",
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orgName} &middot; {members.length} member
          {members.length !== 1 ? "s" : ""}
        </p>
      </div>

      {members.length === 0 ? (
        <Empty className="min-h-75">
          <EmptyMedia>
            <Users className="size-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No team members</EmptyTitle>
            <EmptyDescription>
              This team doesn&apos;t have any members yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-8">
          {/* Coaches section */}
          {coaches.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Coaches ({coaches.length})
              </h2>
              <Separator className="mb-2" />
              <div className="space-y-1">
                {coaches.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isSelf={member.user.id === currentUserId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Players section */}
          {players.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Players ({players.length})
              </h2>
              <Separator className="mb-2" />
              <div className="space-y-1">
                {players.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isSelf={member.user.id === currentUserId}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
