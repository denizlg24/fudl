"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@repo/ui/components/spinner";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    // Check if user has any organizations
    authClient.organization.list().then(({ data: orgs }) => {
      if (!orgs || orgs.length === 0) {
        // No org yet — send to setup
        router.replace("/setup");
      } else {
        // Has orgs — set the first as active and go to dashboard
        const firstOrg = orgs[0];
        if (firstOrg) {
          authClient.organization
            .setActive({ organizationId: firstOrg.id })
            .then(() => {
              router.replace("/dashboard");
            });
        }
      }
    });
  }, [session, isPending, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Spinner className="size-6" />
    </main>
  );
}
