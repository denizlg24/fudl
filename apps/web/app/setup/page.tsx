"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { useForm, type ControllerRenderProps } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { setupSchema, type SetupValues } from "@repo/types/validations";
import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@repo/ui/components/spinner";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function SetupPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const form = useForm<SetupValues>({
    resolver: standardSchemaResolver(setupSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace("/login");
    }
  }, [session, sessionPending, router]);

  // Check if user already has an org — redirect to dashboard
  useEffect(() => {
    if (!session) return;
    authClient.organization.list().then(({ data: orgs }) => {
      if (orgs && orgs.length > 0) {
        router.replace("/dashboard");
      }
    });
  }, [session, router]);

  // Auto-generate slug from name
  const nameValue = form.watch("name");
  useEffect(() => {
    if (!slugManuallyEdited && nameValue) {
      form.setValue("slug", slugify(nameValue), { shouldValidate: true });
    }
  }, [nameValue, slugManuallyEdited, form]);

  const onSubmit = useCallback(
    async (values: SetupValues) => {
      setServerError(null);

      // Check if slug is taken
      const { data: slugCheck } = await authClient.organization.checkSlug({
        slug: values.slug,
      });

      if (slugCheck && !slugCheck.status) {
        form.setError("slug", { message: "This slug is already taken" });
        return;
      }

      // Create the organization
      const { data: org, error } = await authClient.organization.create({
        name: values.name,
        slug: values.slug,
      });

      if (error) {
        setServerError(error.message || "Failed to create team");
        return;
      }

      if (org) {
        // Set as active org and go to dashboard
        await authClient.organization.setActive({
          organizationId: org.id,
        });
        router.push("/dashboard");
      }
    },
    [form, router],
  );

  if (sessionPending) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Create your team</CardTitle>
          <CardDescription>
            Set up your organization to start managing your team and game
            footage.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {serverError}
                </div>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<SetupValues, "name">;
                }) => (
                  <FormItem>
                    <FormLabel>Team name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Riverside Raptors"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The display name for your organization.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<SetupValues, "slug">;
                }) => (
                  <FormItem>
                    <FormLabel>URL slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="riverside-raptors"
                        {...field}
                        onChange={(e) => {
                          setSlugManuallyEdited(true);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Used in URLs to identify your team. Lowercase letters,
                      numbers, and hyphens only.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="mt-6">
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Creating team..."
                  : "Create team"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </main>
  );
}
