"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const orgName = activeOrg?.name || "Team";
  const orgSlug = activeOrg?.slug || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">FUDL</h1>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">{orgName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings/members">
              <Button variant="ghost" size="sm">
                Settings
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/members">Team settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome to {orgName}. Manage your team and game footage here.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team</CardTitle>
              <CardDescription>Your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium">{orgName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Slug</span>
                <Badge variant="secondary">{orgSlug}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>
                Invite coaches and players to your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/members">
                <Button variant="outline" size="sm" className="w-full">
                  Manage members
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Game Footage</CardTitle>
              <CardDescription>Upload and analyze game videos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon. Video upload and AI analysis will be available in a
                future update.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
