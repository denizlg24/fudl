"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import { Users, Plus, Link as LinkIcon } from "lucide-react";

export function NoTeamDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const [inviteUrl, setInviteUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleJoinTeam = () => {
    setInviteError(null);

    if (!inviteUrl.trim()) {
      setInviteError("Please paste an invite link.");
      return;
    }

    // Parse the invite URL to extract the token
    try {
      const url = new URL(inviteUrl.trim());
      const token = url.searchParams.get("token");

      if (!token) {
        setInviteError(
          "Invalid invite link. The link should contain a token parameter.",
        );
        return;
      }

      setJoining(true);
      router.push(`/invite?token=${encodeURIComponent(token)}`);
    } catch {
      setInviteError("Invalid URL. Please paste the full invite link.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hey {userName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Get started by creating a team or joining one with an invite link.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Create a team */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                <Plus className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Create a team</CardTitle>
                <CardDescription>Start your own team</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <p className="text-sm text-muted-foreground mb-4">
              Set up a new team, invite players and coaches, and start uploading
              game footage.
            </p>
            <Button
              onClick={() => router.push("/setup")}
              className="w-full gap-2"
            >
              <Users className="size-4" />
              Create team
            </Button>
          </CardContent>
        </Card>

        {/* Join a team */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                <LinkIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Join a team</CardTitle>
                <CardDescription>Use an invite link</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-url" className="text-sm">
                  Invite link
                </Label>
                <Input
                  id="invite-url"
                  placeholder="fudl.app/invite?token=..."
                  value={inviteUrl}
                  onChange={(e) => {
                    setInviteUrl(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinTeam();
                  }}
                />
                {inviteError && (
                  <p className="text-sm text-destructive">{inviteError}</p>
                )}
              </div>
              <Button
                onClick={handleJoinTeam}
                variant="outline"
                className="w-full"
                disabled={joining || !inviteUrl.trim()}
              >
                {joining ? "Redirecting..." : "Join team"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <p className="text-sm text-center text-muted-foreground">
        Ask your coach or team admin for an invite link to join an existing
        team.
      </p>
    </div>
  );
}
