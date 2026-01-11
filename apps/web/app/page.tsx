"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import Link from "next/link";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <main className="w-full min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">FUDL</CardTitle>
          <CardDescription>
            {session ? `Welcome, ${session.user.name || session.user.email}!` : "Authentication Test"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session ? (
            <>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Email:</span> {session.user.email}</p>
                <p><span className="text-muted-foreground">Name:</span> {session.user.name || "Not set"}</p>
                <p><span className="text-muted-foreground">Verified:</span> {session.user.emailVerified ? "Yes" : "No"}</p>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => authClient.signOut().then(() => window.location.reload())}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/login">
                <Button className="w-full">Login</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="w-full">Register</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
