"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import {
  roleBadgeVariant,
  getRoleDisplayName,
  isOwnerRole,
  isCoachRole,
  ASSIGNABLE_ROLES,
} from "@repo/types";
import {
  inviteSchema,
  teamNameSchema,
  inviteLinkSchema,
  type InviteValues,
} from "@repo/types/validations";
import Link from "next/link";
import {
  ChevronLeft,
  MoreHorizontal,
  UserPlus,
  Copy,
  Ban,
  ShieldAlert,
  X,
  Check,
  ArrowRightLeft,
} from "lucide-react";
import type { ControllerRenderProps } from "react-hook-form";
import { clientEnv } from "@repo/env/web";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

export interface MemberData {
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

export interface InvitationData {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
}

export interface InviteLinkData {
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

export interface TeamSettingsInitialData {
  members: MemberData[];
  invitations: InvitationData[];
  inviteLinks: InviteLinkData[];
  currentMemberRole: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgCreatedAt: string;
  currentUserId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getWebAppUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return clientEnv.NEXT_PUBLIC_APP_URL;
}

function formatJoinedDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return `Joined ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

function formatExpiryDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d < now) return "Expired";
  return `Expires ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export function TeamSettingsContent({
  initialData,
}: {
  initialData: TeamSettingsInitialData;
}) {
  const router = useRouter();

  const [members, setMembers] = useState(initialData.members);
  const [invitations, setInvitations] = useState(initialData.invitations);
  const [inviteLinks, setInviteLinks] = useState(initialData.inviteLinks);
  const [currentMemberRole, setCurrentMemberRole] = useState(
    initialData.currentMemberRole,
  );

  const activeOrgId = initialData.orgId;
  const currentUserId = initialData.currentUserId;
  const isOwner = isOwnerRole(currentMemberRole);
  const isOwnerOrAdmin = isCoachRole(currentMemberRole);

  // Team name editing
  const [editingName, setEditingName] = useState(false);
  const [teamNameValue, setTeamNameValue] = useState(initialData.orgName);
  const [savingName, setSavingName] = useState(false);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Invite link generation
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkRole, setLinkRole] = useState<"admin" | "member">("member");
  const [linkMaxUses, setLinkMaxUses] = useState(25);
  const [linkExpiresInHours, setLinkExpiresInHours] = useState(168);

  // Delete confirmation
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Ownership transfer
  const [transferTarget, setTransferTarget] = useState<MemberData | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Inline error/feedback state
  const [actionError, setActionError] = useState<string | null>(null);
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [linkGeneratedCopied, setLinkGeneratedCopied] = useState(false);

  const form = useForm<InviteValues>({
    resolver: standardSchemaResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });

  const reloadData = async () => {
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
    } catch {
      // Data stays at current state
    }
  };

  // If not owner/admin, show permission denied
  if (!isOwnerOrAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <Empty className="min-h-100">
          <EmptyMedia>
            <ShieldAlert className="size-16 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              You don&apos;t have permission to access team settings.
            </EmptyTitle>
            <EmptyDescription>
              Only coaches and the team owner can manage settings.
            </EmptyDescription>
          </EmptyHeader>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard" className="gap-2">
                <ChevronLeft className="size-4" />
                Back to games
              </Link>
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  const orgName = initialData.orgName;
  const orgSlug = initialData.orgSlug;
  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending",
  );
  const activeLinks = inviteLinks.filter((l) => l.active);

  const handleSaveTeamName = async () => {
    const result = teamNameSchema.safeParse({ name: teamNameValue });
    if (!result.success) {
      setTeamNameError(result.error.issues[0]?.message || "Invalid team name");
      return;
    }
    setTeamNameError(null);
    setSavingName(true);
    try {
      const { error } = await authClient.organization.update({
        data: { name: result.data.name },
        organizationId: activeOrgId,
      });
      if (error) {
        setTeamNameError(error.message || "Failed to update team name");
      } else {
        setEditingName(false);
      }
    } finally {
      setSavingName(false);
    }
  };

  const onInvite = async (values: InviteValues) => {
    const { error } = await authClient.organization.inviteMember({
      email: values.email,
      role: values.role,
      organizationId: activeOrgId,
    });
    if (error) {
      form.setError("root", {
        message: error.message || "Failed to send invitation",
      });
      return;
    }
    form.reset();
    setShowInviteForm(false);
    reloadData();
  };

  const cancelInvitation = async (invitationId: string) => {
    setActionError(null);
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (error) {
      setActionError(error.message || "Failed to cancel invitation");
      return;
    }
    reloadData();
  };

  const removeMember = async (memberIdOrEmail: string) => {
    setActionError(null);
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail,
      organizationId: activeOrgId,
    });
    if (error) {
      setActionError(error.message || "Failed to remove member");
      return;
    }
    reloadData();
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    setActionError(null);
    const { error } = await authClient.organization.updateMemberRole({
      memberId,
      role,
      organizationId: activeOrgId,
    });
    if (error) {
      setActionError(error.message || "Failed to update role");
      return;
    }
    reloadData();
  };

  const generateInviteLink = async () => {
    const result = inviteLinkSchema.safeParse({
      role: linkRole,
      maxUses: linkMaxUses,
      expiresInHours: linkExpiresInHours,
    });
    if (!result.success) {
      setInviteLinkError(
        result.error.issues[0]?.message || "Invalid invite link settings",
      );
      return;
    }
    setInviteLinkError(null);
    setGeneratingLink(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${activeOrgId}/invite-links`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: result.data.role,
          maxUses: result.data.maxUses,
          expiresInHours: result.data.expiresInHours,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setInviteLinkError(data?.error || "Failed to generate invite link");
        return;
      }
      const data = await res.json();
      const inviteUrl = `${getWebAppUrl()}/invite?token=${data.link.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      setLinkGeneratedCopied(true);
      setTimeout(() => setLinkGeneratedCopied(false), 2000);
      reloadData();
    } finally {
      setGeneratingLink(false);
    }
  };

  const revokeInviteLink = async (linkId: string) => {
    setActionError(null);
    const res = await fetch(
      `${API_URL}/orgs/${activeOrgId}/invite-links/${linkId}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) {
      setActionError("Failed to revoke invite link");
      return;
    }
    reloadData();
  };

  const handleDeleteTeam = async () => {
    setActionError(null);
    const { error } = await authClient.organization.delete({
      organizationId: activeOrgId,
    });
    if (error) {
      setActionError(error.message || "Failed to delete team");
      return;
    }
    router.push("/");
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    setActionError(null);
    try {
      // Promote target member to owner
      const { error: promoteError } =
        await authClient.organization.updateMemberRole({
          memberId: transferTarget.id,
          role: "owner",
          organizationId: activeOrgId,
        });
      if (promoteError) {
        setActionError(
          promoteError.message || "Failed to promote member to owner",
        );
        return;
      }

      // Demote self to admin (coach)
      const currentMember = members.find((m) => m.user.id === currentUserId);
      if (currentMember) {
        const { error: demoteError } =
          await authClient.organization.updateMemberRole({
            memberId: currentMember.id,
            role: "admin",
            organizationId: activeOrgId,
          });
        if (demoteError) {
          setActionError(
            demoteError.message || "Failed to update your role to coach",
          );
          // Ownership was already transferred, reload to reflect partial state
          reloadData();
          return;
        }
      }

      setCurrentMemberRole("admin");
      setTransferTarget(null);
      reloadData();
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="size-4" />
        Back to games
      </Link>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Team Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your team, members, and invite links.
        </p>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="flex items-center justify-between gap-2 mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{actionError}</p>
          <button
            type="button"
            className="shrink-0 text-destructive hover:text-destructive/80"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="space-y-10">
        {/* Team Profile */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Team Profile</h2>
          <Separator className="mb-6" />

          <div className="space-y-4">
            {/* Team name */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium w-32 shrink-0">
                Team name
              </span>
              <div className="flex-1 flex items-center gap-2">
                {editingName ? (
                  <>
                    <Input
                      value={teamNameValue}
                      onChange={(e) => setTeamNameValue(e.target.value)}
                      className="max-w-sm"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveTeamName}
                      disabled={savingName || teamNameValue.trim().length < 2}
                    >
                      {savingName ? <Spinner className="size-4" /> : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingName(false);
                        setTeamNameValue(orgName);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm">{orgName}</span>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingName(true)}
                        className="text-muted-foreground"
                      >
                        Edit
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {teamNameError && (
              <p className="text-sm text-destructive sm:ml-32 -mt-1">
                {teamNameError}
              </p>
            )}

            {/* Team slug */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
              <span className="text-sm font-medium w-32 shrink-0">
                Team slug
              </span>
              <div className="flex-1">
                <span className="text-sm">{orgSlug}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  fudl.app/t/{orgSlug}
                </p>
              </div>
            </div>

            {/* Created */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium w-32 shrink-0">Created</span>
              <span className="text-sm text-muted-foreground">
                {initialData.orgCreatedAt
                  ? new Date(initialData.orgCreatedAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )
                  : "\u2014"}
              </span>
            </div>
          </div>
        </section>

        {/* Members */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Members{" "}
            <span className="text-muted-foreground">({members.length})</span>
          </h2>
          <Separator className="mb-6" />

          <div className="space-y-1">
            {members.map((member) => {
              const isSelf = member.user.id === currentUserId;
              const isMemberOwner = isOwnerRole(member.role);
              const canModify =
                !isSelf &&
                !isMemberOwner &&
                (isOwner ||
                  (currentMemberRole === "admin" && member.role === "member"));

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">
                      {getInitials(member.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.user.email}
                    </p>
                  </div>

                  <Badge variant={roleBadgeVariant(member.role)}>
                    {getRoleDisplayName(member.role)}
                  </Badge>

                  <span className="text-sm text-muted-foreground hidden sm:block whitespace-nowrap">
                    {formatJoinedDate(member.createdAt)}
                  </span>

                  {canModify ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Change role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r.value}
                                onClick={() =>
                                  updateMemberRole(member.id, r.value)
                                }
                                disabled={member.role === r.value}
                              >
                                {r.label}
                                {member.role === r.value && (
                                  <Check className="size-4 ml-auto" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {isOwner && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setTransferTarget(member)}
                              className="gap-2"
                            >
                              <ArrowRightLeft className="size-4" />
                              Transfer ownership
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              Remove from team
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove {member.user.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                They will lose access to all team data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeMember(member.user.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>
              );
            })}

            {/* Invite member button */}
            <div className="flex justify-end pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="gap-2"
              >
                <UserPlus className="size-4" />
                Invite player
              </Button>
            </div>

            {/* Inline invite form */}
            {showInviteForm && (
              <div className="mt-3 border border-border rounded-lg p-4">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onInvite)}
                    className="space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row gap-3">
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
                          <FormItem className="w-full sm:w-32">
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
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {form.formState.errors.root && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.root.message}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowInviteForm(false);
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting ? (
                          <Spinner className="size-4" />
                        ) : (
                          "Send invite"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}

            {/* Transfer ownership confirmation dialog */}
            <AlertDialog
              open={!!transferTarget}
              onOpenChange={(open) => {
                if (!open) setTransferTarget(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will make <strong>{transferTarget?.user.name}</strong>{" "}
                    the owner of <strong>{orgName}</strong>. Your role will be
                    changed to Coach. This action can only be reversed by the
                    new owner.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isTransferring}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleTransferOwnership}
                    disabled={isTransferring}
                  >
                    {isTransferring ? (
                      <>
                        <Spinner className="size-4 mr-2" />
                        Transferring...
                      </>
                    ) : (
                      "Transfer ownership"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              Pending Invitations{" "}
              <span className="text-muted-foreground">
                ({pendingInvitations.length})
              </span>
            </h2>
            <Separator className="mb-6" />

            <div className="space-y-1">
              {pendingInvitations.map((inv) => {
                const isExpired = new Date(inv.expiresAt) < new Date();
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md"
                  >
                    <span className="text-sm font-medium flex-1 truncate">
                      {inv.email}
                    </span>
                    <Badge variant="outline">
                      {getRoleDisplayName(inv.role || "member")}
                    </Badge>
                    <span
                      className={`text-sm whitespace-nowrap ${
                        isExpired ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {formatExpiryDate(inv.expiresAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => cancelInvitation(inv.id)}
                    >
                      <X className="size-4" />
                      <span className="sr-only">Cancel invitation</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Invite Links */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Invite Links</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a shareable link that lets anyone join your team.
          </p>
          <Separator className="mb-6" />

          <div className="space-y-6">
            {/* Generation form */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={linkRole}
                    onValueChange={(v) => setLinkRole(v as "admin" | "member")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max uses</Label>
                  <Input
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
                  <Label>Expires in</Label>
                  <Select
                    value={String(linkExpiresInHours)}
                    onValueChange={(v) => setLinkExpiresInHours(Number(v))}
                  >
                    <SelectTrigger>
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
              {inviteLinkError && (
                <p className="text-sm text-destructive">{inviteLinkError}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                {linkGeneratedCopied && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Check className="size-3.5" />
                    Link copied
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={generateInviteLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? (
                    <Spinner className="size-4" />
                  ) : (
                    "Generate link"
                  )}
                </Button>
              </div>
            </div>

            {/* Active links */}
            {inviteLinks.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Active Links ({activeLinks.length})
                </p>
                {inviteLinks.map((link) => {
                  const isExpired = new Date(link.expiresAt) < new Date();
                  const isRevoked = !!link.revokedAt;
                  const statusText = isRevoked
                    ? "Revoked"
                    : isExpired
                      ? "Expired"
                      : "Active";

                  return (
                    <div
                      key={link.id}
                      className="border border-border rounded-lg p-3 space-y-1"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono truncate max-w-50">
                          ...{link.token.slice(0, 20)}
                        </span>
                        <Badge variant="outline">
                          {getRoleDisplayName(link.role)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {link.useCount}/{link.maxUses} used
                        </span>
                        <div className="flex-1" />
                        {link.active && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => {
                                const url = `${getWebAppUrl()}/invite?token=${link.token}`;
                                navigator.clipboard.writeText(url);
                                setCopiedLinkId(link.id);
                                setTimeout(() => setCopiedLinkId(null), 2000);
                              }}
                            >
                              {copiedLinkId === link.id ? (
                                <Check className="size-4" />
                              ) : (
                                <Copy className="size-4" />
                              )}
                              <span className="sr-only">Copy</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                >
                                  <Ban className="size-4" />
                                  <span className="sr-only">Revoke</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Revoke this link?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    It will no longer be usable by anyone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeInviteLink(link.id)}
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm ${
                            isExpired || isRevoked
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatExpiryDate(link.expiresAt)}
                        </span>
                        <Badge
                          variant={link.active ? "outline" : "secondary"}
                          className={
                            link.active
                              ? "border-green-500/50 text-green-600 dark:text-green-400"
                              : ""
                          }
                        >
                          {statusText}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        {isOwner && (
          <section>
            <h2 className="text-lg font-semibold text-destructive mb-4">
              Danger Zone
            </h2>
            <Separator className="mb-6" />

            <div className="border border-destructive/50 rounded-lg p-6">
              <h3 className="text-sm font-semibold">Delete team</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete this team and all its data.
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>

              <div className="flex justify-end mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete team
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {orgName}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all games, videos, seasons,
                        and analysis data for this team. All members will lose
                        access. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="pb-2">
                      <Label className="text-sm">
                        Type the team name to confirm:
                      </Label>
                      <Input
                        className="mt-2"
                        placeholder={orgName}
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmName("")}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteConfirmName !== orgName}
                        onClick={handleDeleteTeam}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete team
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
