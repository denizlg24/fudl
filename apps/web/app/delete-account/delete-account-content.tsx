"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Spinner } from "@repo/ui/components/spinner";
import { Label } from "@repo/ui/components/label";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type DeleteState = "confirm" | "deleting" | "success" | "error" | "no-token";

export function DeleteAccountContent({ token }: { token?: string }) {
  const router = useRouter();
  const [state, setState] = useState<DeleteState>(
    token ? "confirm" : "no-token",
  );
  const [confirmText, setConfirmText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleDelete = async () => {
    if (!token || confirmText !== "DELETE") return;

    setState("deleting");

    try {
      const { error } = await authClient.deleteUser({
        token,
      });

      if (error) {
        setErrorMessage(error.message || "Account deletion failed");
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setErrorMessage("An unexpected error occurred");
      setState("error");
    }
  };

  if (state === "no-token") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="size-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Missing token</CardTitle>
          <CardDescription>
            No deletion token was found. Please use the link from your
            confirmation email.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/" className="w-full">
            <Button variant="outline" className="w-full">
              Go to home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (state === "deleting") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Deleting your account</CardTitle>
          <CardDescription>Please wait...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="size-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Account deleted</CardTitle>
          <CardDescription>
            Your account has been permanently deleted. We&apos;re sorry to see
            you go.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push("/login")}>
            Go to Sign in
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="size-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Deletion failed</CardTitle>
          <CardDescription>
            {errorMessage ||
              "The deletion link may be expired or invalid. You must be logged in to delete your account."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2">
          <Link href="/settings/profile" className="w-full">
            <Button variant="outline" className="w-full">
              Back to Profile Settings
            </Button>
          </Link>
          <Link href="/" className="w-full">
            <Button variant="ghost" className="w-full">
              Go to home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Confirm state
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="size-12 text-destructive" />
        </div>
        <CardTitle className="text-2xl text-destructive">
          Delete your account?
        </CardTitle>
        <CardDescription>
          This action is permanent and cannot be undone. All your personal data
          will be removed and you will be removed from all teams.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Type DELETE to confirm:</Label>
          <Input
            placeholder="DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          variant="destructive"
          className="w-full"
          disabled={confirmText !== "DELETE"}
          onClick={handleDelete}
        >
          Permanently delete my account
        </Button>
        <Link href="/settings/profile" className="w-full">
          <Button variant="ghost" className="w-full">
            Cancel
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
