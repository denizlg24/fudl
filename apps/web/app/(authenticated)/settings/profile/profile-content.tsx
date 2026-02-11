"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  SPORT_OPTIONS,
  POSITIONS_BY_SPORT,
  isSport,
  type Sport,
} from "@repo/types/profile";
import {
  profileSchema,
  changePasswordSchema,
  validateProfilePosition,
  type ProfileValues,
  type ChangePasswordValues,
} from "@repo/types/validations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useTheme } from "next-themes";
import Link from "next/link";
import { toast } from "sonner";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import type { ControllerRenderProps } from "react-hook-form";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Parse a date string (ISO or YYYY-MM-DD) into a Date, or null if invalid/empty. */
function parseDateString(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/** Convert a Date to an ISO string for storage, or empty string if null. */
function dateToIsoString(date: Date | null): string {
  return date ? date.toISOString() : "";
}

export interface ProfileInitialData {
  userName: string;
  userEmail: string;
  activeOrgId: string | undefined;
  orgs: Array<{ id: string; name: string; slug: string }>;
  soleOwnedOrgNames: string[];
  profile: {
    sport: string;
    position: string;
    heightCm: string;
    weightKg: string;
    dateOfBirth: string;
    city: string;
    country: string;
    jerseyNumber: string;
    bio: string;
    instagramHandle: string;
    twitterHandle: string;
  };
}

export function ProfileSettingsContent({
  initialData,
}: {
  initialData: ProfileInitialData;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const {
    userName: initialName,
    userEmail: initialEmail,
    activeOrgId,
    orgs,
  } = initialData;
  const { profile } = initialData;

  const profileForm = useForm<ProfileValues>({
    resolver: standardSchemaResolver(profileSchema),
    defaultValues: {
      name: initialName,
      bio: profile.bio,
      sport: (profile.sport as ProfileValues["sport"]) || "",
      position: profile.position || "",
      jerseyNumber: profile.jerseyNumber ? Number(profile.jerseyNumber) : null,
      heightCm: profile.heightCm ? Number(profile.heightCm) : null,
      weightKg: profile.weightKg ? Number(profile.weightKg) : null,
      dateOfBirth: profile.dateOfBirth || "",
      city: profile.city,
      country: profile.country,
      instagramHandle: profile.instagramHandle,
      twitterHandle: profile.twitterHandle,
    },
  });

  const watchedSport = profileForm.watch("sport");
  const positionOptions =
    watchedSport && isSport(watchedSport)
      ? POSITIONS_BY_SPORT[watchedSport as Sport]
      : [];

  const handleSaveProfile = async (values: ProfileValues) => {
    const positionError = validateProfilePosition(values);
    if (positionError) {
      profileForm.setError("position", { message: positionError });
      return;
    }

    const updates: Record<string, unknown> = {
      name: values.name,
      bio: values.bio || null,
      sport: values.sport || null,
      position: values.position || null,
      jerseyNumber: values.jerseyNumber ?? null,
      heightCm: values.heightCm ?? null,
      weightKg: values.weightKg ?? null,
      dateOfBirth: values.dateOfBirth || null,
      city: values.city || null,
      country: values.country || null,
      instagramHandle: values.instagramHandle || null,
      twitterHandle: values.twitterHandle || null,
    };

    if (values.sport && values.position) {
      const validPositions = isSport(values.sport)
        ? POSITIONS_BY_SPORT[values.sport as Sport]
        : [];
      if (!validPositions.includes(values.position)) {
        updates.position = null;
        profileForm.setValue("position", "");
      }
    }

    const { error } = await authClient.updateUser(
      updates as Record<string, string | number | null>,
    );
    if (error) {
      const message = error.message || "Failed to save profile";
      if (
        message.toLowerCase().includes("date") ||
        message.toLowerCase().includes("datetime")
      ) {
        toast.error(
          "Invalid date format. Please use the date picker to select a valid date.",
        );
      } else {
        toast.error(message);
      }
      return;
    }
    toast.success("Profile saved");
    profileForm.reset(values);
  };

  // ---------- Email change ----------
  const [emailValue, setEmailValue] = useState(initialEmail);
  const [savingEmail, setSavingEmail] = useState(false);

  const handleSaveEmail = async () => {
    if (!emailValue || emailValue === initialEmail) return;
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await authClient.changeEmail({
        newEmail: emailValue,
      });
      if (error) {
        toast.error(error.message || "Failed to update email");
        return;
      }
      toast.success(
        `Verification email sent to ${emailValue}. Please check your inbox.`,
      );
    } finally {
      setSavingEmail(false);
    }
  };

  const passwordForm = useForm<ChangePasswordValues>({
    resolver: standardSchemaResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const [passwordOpen, setPasswordOpen] = useState(false);

  const handleChangePassword = async (values: ChangePasswordValues) => {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: false,
    });
    if (error) {
      passwordForm.setError("currentPassword", {
        message: error.message || "Failed to change password",
      });
      return;
    }
    toast.success("Password updated");
    setPasswordOpen(false);
    passwordForm.reset();
  };

  const [orgsList, setOrgsList] = useState(orgs);

  const handleSwitchOrg = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    router.refresh();
  };

  const handleLeaveOrg = async (orgId: string) => {
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: initialEmail,
      organizationId: orgId,
    });
    if (error) {
      toast.error(error.message || "Failed to leave team");
      return;
    }
    toast.success("You have left the team");
    setOrgsList((prev) => prev.filter((o) => o.id !== orgId));
  };

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const soleOwnedOrgNames = initialData.soleOwnedOrgNames;

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await authClient.deleteUser({});
      if (error) {
        toast.error(error.message || "Failed to initiate account deletion");
        return;
      }
      toast.success(
        "Check your email — click the confirmation link to complete account deletion.",
        { duration: 10000 },
      );
      setDeleteConfirmText("");
    } catch {
      toast.error("Failed to initiate account deletion");
    } finally {
      setIsDeleting(false);
    }
  };

  const profileName = profileForm.watch("name");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-16">
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
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal account settings.
        </p>
      </div>

      <div className="space-y-10">
        {/* Avatar & Identity */}
        <section>
          <div className="flex items-center gap-4">
            <Avatar className="size-18">
              <AvatarFallback className="text-xl">
                {getInitials(profileName || initialName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xl font-semibold">
                {profileName || initialName}
              </p>
              <p className="text-sm text-muted-foreground">
                {emailValue || initialEmail}
              </p>
              <p className="text-sm text-muted-foreground">
                Member of {orgsList.length} team
                {orgsList.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </section>

        {/* Profile Form */}
        <section>
          {/* Save button */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Personal Information & Profile Details
            </h2>
            <Button
              onClick={profileForm.handleSubmit(handleSaveProfile)}
              disabled={
                profileForm.formState.isSubmitting ||
                !profileForm.formState.isDirty
              }
              className="min-w-30"
            >
              {profileForm.formState.isSubmitting ? (
                <Spinner className="size-4" />
              ) : (
                "Save changes"
              )}
            </Button>
          </div>

          <Separator className="mb-6" />

          <Form {...profileForm}>
            <form className="space-y-6">
              {/* Display name */}
              <FormField
                control={profileForm.control}
                name="name"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<ProfileValues, "name">;
                }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email address</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      emailValue === initialEmail || savingEmail || !emailValue
                    }
                    onClick={handleSaveEmail}
                    className="min-w-25"
                  >
                    {savingEmail ? (
                      <Spinner className="size-4" />
                    ) : (
                      "Update email"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Changing your email will require re-verification.
                </p>
              </div>

              {/* Bio */}
              <FormField
                control={profileForm.control}
                name="bio"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<ProfileValues, "bio">;
                }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us a bit about yourself..."
                        rows={3}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sport */}
              <FormField
                control={profileForm.control}
                name="sport"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<ProfileValues, "sport">;
                }) => (
                  <FormItem>
                    <FormLabel>Sport</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Clear position if sport changes and position is invalid
                        const currentPosition =
                          profileForm.getValues("position");
                        if (currentPosition && isSport(val)) {
                          const validPositions =
                            POSITIONS_BY_SPORT[val as Sport];
                          if (!validPositions.includes(currentPosition)) {
                            profileForm.setValue("position", "");
                          }
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your sport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Position */}
              {watchedSport && positionOptions.length > 0 && (
                <FormField
                  control={profileForm.control}
                  name="position"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<ProfileValues, "position">;
                  }) => (
                    <FormItem>
                      <FormLabel>
                        {isSport(watchedSport) && watchedSport === "BJJ"
                          ? "Belt Rank"
                          : "Position"}
                      </FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isSport(watchedSport) && watchedSport === "BJJ"
                                  ? "Select your belt"
                                  : "Select your position"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {positionOptions.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {pos}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Jersey Number */}
              <FormField
                control={profileForm.control}
                name="jerseyNumber"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<ProfileValues, "jerseyNumber">;
                }) => (
                  <FormItem>
                    <FormLabel>Jersey Number</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={999}
                        placeholder="e.g. 7"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? null : Number(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Height & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="heightCm"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<ProfileValues, "heightCm">;
                  }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={50}
                          max={300}
                          placeholder="e.g. 180"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === "" ? null : Number(val));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="weightKg"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<ProfileValues, "weightKg">;
                  }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={20}
                          max={500}
                          step={0.1}
                          placeholder="e.g. 75"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === "" ? null : Number(val));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date of Birth */}
              <FormField
                control={profileForm.control}
                name="dateOfBirth"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<ProfileValues, "dateOfBirth">;
                }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={parseDateString(field.value)}
                        onChange={(date) => {
                          field.onChange(dateToIsoString(date));
                        }}
                        placeholder="Select your date of birth"
                        toDate={new Date()}
                        dateFormat="MMM d, yyyy"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City & Country */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="city"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<ProfileValues, "city">;
                  }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Austin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="country"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<ProfileValues, "country">;
                  }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. USA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <p className="text-sm font-medium">Social Media</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="instagramHandle"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<
                        ProfileValues,
                        "instagramHandle"
                      >;
                    }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">
                          Instagram
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@handle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="twitterHandle"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<
                        ProfileValues,
                        "twitterHandle"
                      >;
                    }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">
                          X / Twitter
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@handle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </section>

        {/* Password */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Password</h2>
          <Separator className="mb-6" />

          <Collapsible open={passwordOpen} onOpenChange={setPasswordOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
              {passwordOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Change password
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4">
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(handleChangePassword)}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<
                        ChangePasswordValues,
                        "currentPassword"
                      >;
                    }) => (
                      <FormItem>
                        <FormLabel>Current password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<
                        ChangePasswordValues,
                        "newPassword"
                      >;
                    }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Must be at least 8 characters.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({
                      field,
                    }: {
                      field: ControllerRenderProps<
                        ChangePasswordValues,
                        "confirmPassword"
                      >;
                    }) => (
                      <FormItem>
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPasswordOpen(false);
                        passwordForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={passwordForm.formState.isSubmitting}
                    >
                      {passwordForm.formState.isSubmitting ? (
                        <Spinner className="size-4" />
                      ) : (
                        "Update password"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CollapsibleContent>
          </Collapsible>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <Separator className="mb-6" />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { value: "light", label: "Light", Icon: Sun },
                  { value: "dark", label: "Dark", Icon: Moon },
                  { value: "system", label: "System", Icon: Monitor },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent/50 ${
                    theme === value
                      ? "border-primary ring-2 ring-primary"
                      : "border-border"
                  }`}
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Teams */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Teams</h2>
          <Separator className="mb-6" />

          {orgsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not a member of any teams.
            </p>
          ) : (
            <div className="space-y-1">
              {orgsList.map((org) => {
                const isActive = org.id === activeOrgId;

                return (
                  <div
                    key={org.id}
                    className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {org.slug}
                      </p>
                    </div>

                    {isActive ? (
                      <Badge variant="outline" className="gap-1">
                        <Check className="size-3" />
                        Active
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSwitchOrg(org.id)}
                        >
                          Switch
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              Leave
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Leave {org.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                You&apos;ll lose access to all team data. You
                                can rejoin if invited again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleLeaveOrg(org.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Leave team
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 6: Danger Zone */}
        <section>
          <h2 className="text-lg font-semibold text-destructive mb-4">
            Danger Zone
          </h2>
          <Separator className="mb-6" />

          <div className="border border-destructive/50 rounded-lg p-6">
            <h3 className="text-sm font-semibold">Delete account</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete your account and all personal data. You will be
              removed from all teams.
            </p>
            {soleOwnedOrgNames.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-destructive">
                  You must transfer ownership of{" "}
                  <strong>{soleOwnedOrgNames.join(", ")}</strong> before you can
                  delete your account.
                </p>
                <p className="text-sm">
                  <Link
                    href="/settings/team"
                    className="text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    Go to Team Settings
                  </Link>{" "}
                  to transfer ownership.
                </p>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={soleOwnedOrgNames.length > 0}
                  >
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will send a confirmation email to{" "}
                      <strong>{initialEmail}</strong>. Click the link in the
                      email to permanently delete your account. You must be
                      logged in when you click the link.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="pb-2">
                    <Label className="text-sm">Type DELETE to confirm:</Label>
                    <Input
                      className="mt-2"
                      placeholder="DELETE"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteConfirmText !== "DELETE" || isDeleting}
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Spinner className="size-4 mr-2" />
                          Sending...
                        </>
                      ) : (
                        "Send confirmation email"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
