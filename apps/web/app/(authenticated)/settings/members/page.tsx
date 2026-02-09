"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Spinner } from "@repo/ui/components/spinner";
import { Label } from "@repo/ui/components/label";
import { useForm, type ControllerRenderProps } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["member", "admin"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface MemberData {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface InvitationData {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
}

interface InviteLinkData {
  id: string;
  token: string;
  role: string;
  maxUses: number;
  useCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

function getWebAppUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

export default function MembersSettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMemberRole, setCurrentMemberRole] = useState<string | null>(
    null,
  );
  const [inviteLinks, setInviteLinks] = useState<InviteLinkData[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkRole, setLinkRole] = useState<"member" | "admin">("member");
  const [linkMaxUses, setLinkMaxUses] = useState(25);
  const [linkExpiresInHours, setLinkExpiresInHours] = useState(168); // 7 days

  const isOwnerOrAdmin =
    currentMemberRole === "owner" || currentMemberRole === "admin";

  const form = useForm<InviteValues>({
    resolver: standardSchemaResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  const activeOrgId = activeOrg?.id;

  const loadData = useCallback(async () => {
    if (!activeOrgId) return;

    setLoading(true);
    try {
      const [membersRes, invitationsRes, roleRes, linksRes] = await Promise.all(
        [
          authClient.organization.listMembers({
            query: { organizationId: activeOrgId },
          }),
          authClient.organization.listInvitations({
            query: { organizationId: activeOrgId },
          }),
          authClient.organization.getActiveMemberRole(),
          fetch(`${API_URL}/orgs/${activeOrgId}/invite-links`, {
            credentials: "include",
          }).then((r) => (r.ok ? r.json() : null)),
        ],
      );

      if (membersRes.data) {
        setMembers(
          membersRes.data.members.map((member) => ({
            ...member,
            createdAt: member.createdAt.toString(),
            user: {
              ...member.user,
              image: member.user.image ? member.user.image.toString() : null,
            },
          })),
        );
      }
      if (invitationsRes.data) {
        setInvitations(
          invitationsRes.data.map((invitation) => ({
            ...invitation,
            expiresAt: invitation.expiresAt.toString(),
          })),
        );
      }
      if (roleRes.data) {
        setCurrentMemberRole(roleRes.data.role);
      }
      if (linksRes?.links) {
        setInviteLinks(linksRes.links);
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onInvite = useCallback(
    async (values: InviteValues) => {
      if (!activeOrgId) return;

      const { error } = await authClient.organization.inviteMember({
        email: values.email,
        role: values.role,
        organizationId: activeOrgId,
      });

      if (error) {
        toast.error(error.message || "Failed to send invitation");
        return;
      }

      toast.success(`Invitation sent to ${values.email}`);
      form.reset();
      loadData();
    },
    [activeOrgId, form, loadData],
  );

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || "Failed to cancel invitation");
        return;
      }

      toast.success("Invitation cancelled");
      loadData();
    },
    [loadData],
  );

  const removeMember = useCallback(
    async (memberIdOrEmail: string) => {
      if (!activeOrgId) return;

      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail,
        organizationId: activeOrgId,
      });

      if (error) {
        toast.error(error.message || "Failed to remove member");
        return;
      }

      toast.success("Member removed");
      loadData();
    },
    [activeOrgId, loadData],
  );

  const generateInviteLink = useCallback(async () => {
    if (!activeOrgId) return;

    setGeneratingLink(true);
    try {
      const res = await fetch(
        `${API_URL}/orgs/${activeOrgId}/invite-links`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: linkRole,
            maxUses: linkMaxUses,
            expiresInHours: linkExpiresInHours,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to generate invite link");
        return;
      }

      const data = await res.json();
      const link = data.link;
      const inviteUrl = `${getWebAppUrl()}/invite?token=${link.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link generated and copied to clipboard");
      loadData();
    } finally {
      setGeneratingLink(false);
    }
  }, [activeOrgId, linkRole, linkMaxUses, linkExpiresInHours, loadData]);

  const revokeInviteLink = useCallback(
    async (linkId: string) => {
      if (!activeOrgId) return;

      const res = await fetch(
        `${API_URL}/orgs/${activeOrgId}/invite-links/${linkId}`,
        { method: "DELETE", credentials: "include" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to revoke invite link");
        return;
      }

      toast.success("Invite link revoked");
      loadData();
    },
    [activeOrgId, loadData],
  );

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const orgName = activeOrg?.name || "Team";

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending",
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <h1 className="text-lg font-semibold tracking-tight">FUDL</h1>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">{orgName}</span>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground">Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
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
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Members</h2>
          <p className="text-muted-foreground">
            Manage who has access to {orgName}.
          </p>
        </div>

        {/* Invite form — only for owners and admins */}
        {isOwnerOrAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite a member</CardTitle>
              <CardDescription>
                Send an invitation email to add someone to your team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onInvite)}
                  className="flex items-end gap-3"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<InviteValues, "email">;
                    }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="player@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<InviteValues, "role">;
                    }) => (
                      <FormItem className="w-32">
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Sending..." : "Send invite"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Members list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Team members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    {isOwnerOrAdmin && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {member.user.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </TableCell>
                      {isOwnerOrAdmin && (
                        <TableCell>
                          {member.role !== "owner" &&
                            member.user.id !== session?.user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMember(member.user.email)}
                              >
                                Remove
                              </Button>
                            )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending invitations */}
        {isOwnerOrAdmin && pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pending invitations ({pendingInvitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="text-sm">
                        {invitation.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {invitation.role || "member"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelInvitation(invitation.id)}
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Invite links */}
        {isOwnerOrAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite links</CardTitle>
              <CardDescription>
                Generate secure, time-limited invite links to share with people
                who want to join your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Generate new link form */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="link-role">Role</Label>
                    <Select
                      value={linkRole}
                      onValueChange={(v) =>
                        setLinkRole(v as "member" | "admin")
                      }
                    >
                      <SelectTrigger id="link-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link-max-uses">Max uses</Label>
                    <Input
                      id="link-max-uses"
                      type="number"
                      min={1}
                      max={1000}
                      value={linkMaxUses}
                      onChange={(e) =>
                        setLinkMaxUses(Number(e.target.value) || 25)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link-expires">Expires in</Label>
                    <Select
                      value={String(linkExpiresInHours)}
                      onValueChange={(v) => setLinkExpiresInHours(Number(v))}
                    >
                      <SelectTrigger id="link-expires">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="24">1 day</SelectItem>
                        <SelectItem value="48">2 days</SelectItem>
                        <SelectItem value="168">7 days</SelectItem>
                        <SelectItem value="720">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={generateInviteLink} disabled={generatingLink}>
                  {generatingLink ? "Generating..." : "Generate invite link"}
                </Button>
              </div>

              {/* Active invite links */}
              {inviteLinks.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Active links ({inviteLinks.filter((l) => l.active).length}
                      )
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Uses</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inviteLinks.map((link) => (
                          <TableRow key={link.id}>
                            <TableCell className="font-mono text-xs max-w-[120px] truncate">
                              {link.token.slice(0, 12)}...
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{link.role}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {link.useCount} / {link.maxUses}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(link.expiresAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {link.active ? (
                                <Badge variant="default">Active</Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {link.revokedAt ? "Revoked" : "Expired"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {link.active && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const url = `${getWebAppUrl()}/invite?token=${link.token}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success(
                                          "Link copied to clipboard",
                                        );
                                      }}
                                    >
                                      Copy
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => revokeInviteLink(link.id)}
                                    >
                                      Revoke
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
