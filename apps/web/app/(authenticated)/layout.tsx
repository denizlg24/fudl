"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@repo/ui/components/spinner";

/**
 * Layout for authenticated pages.
 * Handles session check, org resolution, and provides the app shell.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { data: activeOrg, isPending: orgPending } =
    authClient.useActiveOrganization();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPending || orgPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    // If no active org, check if user has any
    if (!activeOrg) {
      authClient.organization.list().then(({ data: orgs }) => {
        if (!orgs || orgs.length === 0) {
          router.replace("/setup");
        } else {
          const firstOrg = orgs[0];
          if (firstOrg) {
            authClient.organization
              .setActive({ organizationId: firstOrg.id })
              .then(() => setReady(true));
          }
        }
      });
    } else {
      setReady(true);
    }
  }, [session, isPending, activeOrg, orgPending, router]);

  if (isPending || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return <>{children}</>;
}
