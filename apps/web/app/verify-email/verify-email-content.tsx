"use client";

import { useEffect, useState } from "react";
import { authClient } from "@repo/auth/client";
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
import { Input } from "@repo/ui/components/input";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

type VerifyState = "verifying" | "success" | "error" | "no-token";

export function VerifyEmailContent({
  token,
  redirect,
}: {
  token?: string;
  redirect?: string;
}) {
  const [state, setState] = useState<VerifyState>(
    token ? "verifying" : "no-token",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verify() {
      const { error } = await authClient.verifyEmail({
        query: { token: token! },
      });

      if (cancelled) return;

      if (error) {
        setErrorMessage(error.message || "Verification failed");
        setState("error");
      } else {
        setState("success");
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await authClient.sendVerificationEmail({
        email: resendEmail,
        callbackURL: redirect || "/",
      });
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  };

  const loginHref = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : "/login";

  if (state === "verifying") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verifying your email</CardTitle>
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
          <CardTitle className="text-2xl">Email verified</CardTitle>
          <CardDescription>
            Your email has been verified successfully. You can now sign in.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={loginHref} className="w-full">
            <Button className="w-full">Go to Sign in</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (state === "no-token") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="size-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Missing token</CardTitle>
          <CardDescription>
            No verification token was found. Please use the link from your
            verification email.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={loginHref} className="w-full">
            <Button variant="outline" className="w-full">
              Back to Sign in
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Error state
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <XCircle className="size-12 text-destructive" />
        </div>
        <CardTitle className="text-2xl">Verification failed</CardTitle>
        <CardDescription>
          {errorMessage || "The verification link may be expired or invalid."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {resendSent ? (
          <p className="text-sm text-center text-muted-foreground">
            A new verification email has been sent. Check your inbox.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Enter your email to receive a new verification link:
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleResend}
                disabled={!resendEmail || resendLoading}
                variant="outline"
              >
                {resendLoading ? <Spinner className="size-4" /> : "Resend"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link href={loginHref} className="w-full">
          <Button variant="outline" className="w-full">
            Back to Sign in
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
