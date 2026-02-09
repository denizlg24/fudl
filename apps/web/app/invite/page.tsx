"use client";

import { authClient } from "@repo/auth/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Spinner } from "@repo/ui/components/spinner";
import Link from "next/link";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface InvitationInfo {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  organizationName: string;
}

interface TokenInfo {
  organizationName: string;
  role: string;
  expiresAt: string;
}

// ─── Token-based invite flow ──────────────────────────────────────────────────

function TokenInviteFlow({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate token (no auth required)
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/invite-links/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(
            data?.error || "This invite link is invalid or has expired.",
          );
          return;
        }
        const data = await res.json();
        setTokenInfo(data);
      })
      .catch(() => {
        setError("Failed to validate invite link. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const acceptToken = useCallback(async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/invite-links/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || data?.message || "Failed to accept invite.");
        setAccepting(false);
        return;
      }

      setAccepted(true);
      toast.success("Welcome to the team! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch {
      setError("Failed to accept invite. Please try again.");
      setAccepting(false);
    }
  }, [token, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6" />
      </main>
    );
  }

  // Token is invalid or expired — show error
  if (error && !tokenInfo) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Invalid invite link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                Go home
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Not logged in — prompt to sign in / register
  if (!sessionPending && !session) {
    const redirectParam = encodeURIComponent(`/invite?token=${token}`);

    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">
              Join {tokenInfo?.organizationName}
            </CardTitle>
            <CardDescription>
              You&apos;ve been invited to join as{" "}
              <span className="font-medium">{tokenInfo?.role || "member"}</span>
              . Sign in or create an account to continue.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2">
            <Link href={`/login?redirect=${redirectParam}`} className="w-full">
              <Button className="w-full">Sign in</Button>
            </Link>
            <Link
              href={`/register?redirect=${redirectParam}`}
              className="w-full"
            >
              <Button variant="outline" className="w-full">
                Create account
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (sessionPending) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6" />
      </main>
    );
  }

  // Accepted state
  if (accepted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to the team!</CardTitle>
            <CardDescription>
              You&apos;ve joined {tokenInfo?.organizationName}. Redirecting to
              the dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <Spinner className="size-5" />
          </CardContent>
        </Card>
      </main>
    );
  }

  // Error during acceptance
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" className="w-full">
                Go to dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Show join confirmation
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            Join {tokenInfo?.organizationName}
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as{" "}
            <span className="font-medium">{tokenInfo?.role || "member"}</span>.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-2">
          <Button className="flex-1" onClick={acceptToken} disabled={accepting}>
            {accepting ? "Joining..." : "Join team"}
          </Button>
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}

// ─── Email invitation flow (existing) ─────────────────────────────────────────

function EmailInviteFlow({ invitationId }: { invitationId: string | null }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Load user's pending invitations
  useEffect(() => {
    if (sessionPending || !session) return;

    setLoading(true);
    authClient.organization
      .listUserInvitations()
      .then(({ data }) => {
        if (data) {
          const pendingInvites = data.filter((inv) => inv.status === "pending");
          setInvitations(pendingInvites);
        }
      })
      .finally(() => setLoading(false));
  }, [session, sessionPending]);

  const acceptInvitation = useCallback(
    async (id: string) => {
      setAccepting(true);
      setError(null);

      const { error: err } = await authClient.organization.acceptInvitation({
        invitationId: id,
      });

      if (err) {
        setError(err.message || "Failed to accept invitation");
        setAccepting(false);
        return;
      }

      setAccepted(true);
      toast.success("Invitation accepted! Redirecting to dashboard...");

      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    },
    [router],
  );

  // If we have a specific invitation ID, try to accept it directly
  useEffect(() => {
    if (invitationId && session && !sessionPending && !accepting && !accepted) {
      acceptInvitation(invitationId);
    }
  }, [
    invitationId,
    session,
    sessionPending,
    acceptInvitation,
    accepting,
    accepted,
  ]);

  // Not logged in
  if (!sessionPending && !session) {
    const redirectParam = invitationId
      ? encodeURIComponent(`/invite?id=${invitationId}`)
      : "";

    const loginUrl = redirectParam
      ? `/login?redirect=${redirectParam}`
      : "/login";
    const registerUrl = redirectParam
      ? `/register?redirect=${redirectParam}`
      : "/register";

    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">You&apos;ve been invited</CardTitle>
            <CardDescription>
              Sign in or create an account to accept this invitation and join
              the team.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2">
            <Link href={loginUrl} className="w-full">
              <Button className="w-full">Sign in</Button>
            </Link>
            <Link href={registerUrl} className="w-full">
              <Button variant="outline" className="w-full">
                Create account
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (sessionPending || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6" />
      </main>
    );
  }

  // Accepted state
  if (accepted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to the team!</CardTitle>
            <CardDescription>
              Your invitation has been accepted. Redirecting you to the
              dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <Spinner className="size-5" />
          </CardContent>
        </Card>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" className="w-full">
                Go to dashboard
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Show list of pending invitations
  if (invitations.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">No pending invitations</CardTitle>
            <CardDescription>
              You don&apos;t have any pending team invitations.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                Go home
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-center">
          Pending invitations
        </h2>
        {invitations.map((invitation) => (
          <Card key={invitation.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {invitation.organizationName}
              </CardTitle>
              <CardDescription>
                Invited as{" "}
                <span className="font-medium">
                  {invitation.role || "member"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => acceptInvitation(invitation.id)}
                disabled={accepting}
              >
                {accepting ? "Accepting..." : "Accept"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  await authClient.organization.rejectInvitation({
                    invitationId: invitation.id,
                  });
                  toast.success("Invitation declined");
                  setInvitations((prev) =>
                    prev.filter((i) => i.id !== invitation.id),
                  );
                }}
              >
                Decline
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invitationId = searchParams.get("id");

  // Token-based invite link (secure)
  if (token) {
    return <TokenInviteFlow token={token} />;
  }

  // Email-based invitation (existing flow)
  return <EmailInviteFlow invitationId={invitationId} />;
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <Spinner className="size-6" />
        </main>
      }
    >
      <InvitePageContent />
    </Suspense>
  );
}
