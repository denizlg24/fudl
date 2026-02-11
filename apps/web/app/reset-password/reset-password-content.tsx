"use client";

import { useState } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import Link from "next/link";
import { useForm, type ControllerRenderProps } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@repo/types/validations";
import { CheckCircle2, XCircle } from "lucide-react";

export function ResetPasswordContent({ token }: { token?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="size-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Missing token</CardTitle>
          <CardDescription>
            No reset token was found. Please use the link from your password
            reset email.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/forgot-password" className="w-full">
            <Button variant="outline" className="w-full">
              Request new reset link
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setServerError(null);

    const { error } = await authClient.resetPassword({
      newPassword: values.newPassword,
      token: token!,
    });

    if (error) {
      setServerError(
        error.message || "Failed to reset password. The link may be expired.",
      );
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="size-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Password reset</CardTitle>
          <CardDescription>
            Your password has been reset successfully. You can now sign in with
            your new password.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full">Go to Sign in</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {serverError}
              </div>
            )}
            <FormField
              control={form.control}
              name="newPassword"
              render={({
                field,
              }: {
                field: ControllerRenderProps<
                  ResetPasswordValues,
                  "newPassword"
                >;
              }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="********"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({
                field,
              }: {
                field: ControllerRenderProps<
                  ResetPasswordValues,
                  "confirmPassword"
                >;
              }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="********"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              <Link href="/login" className="text-primary hover:underline">
                Back to Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
