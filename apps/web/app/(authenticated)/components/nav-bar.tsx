"use client";

import { authClient } from "@repo/auth/client";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import Link from "next/link";
import { Menu, LogOut, Settings, User } from "lucide-react";
import { isCoachRole } from "@repo/types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const NAV_LINKS: ReadonlyArray<{
  href: string;
  label: string;
  requiresOrg?: boolean;
  coachOnly?: boolean;
}> = [
  { href: "/dashboard", label: "Home" },
  { href: "/seasons", label: "Seasons", requiresOrg: true },
  { href: "/roster", label: "Roster", requiresOrg: true },
  { href: "/upload", label: "Upload", requiresOrg: true, coachOnly: true },
];

function NavLinks({
  pathname,
  hasOrg,
  role,
  onClick,
}: {
  pathname: string;
  hasOrg: boolean;
  role: string | null;
  onClick?: () => void;
}) {
  const isCoach = role ? isCoachRole(role) : false;
  return (
    <>
      {NAV_LINKS.filter(
        (link) => (!link.requiresOrg || hasOrg) && (!link.coachOnly || isCoach),
      ).map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClick}
            className={`relative px-1 py-1 text-sm transition-colors ${
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full sm:-mb-4.25" />
            )}
          </Link>
        );
      })}
    </>
  );
}

export interface NavBarProps {
  userName: string;
  userEmail: string;
  orgName: string | null;
  activeOrgId: string | null;
  role: string | null;
  orgs: Array<{ id: string; name: string; slug: string }>;
}

export function NavBar({
  userName,
  userEmail,
  activeOrgId,
  role,
  orgs,
}: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hasOrg = activeOrgId !== null;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const handleSwitchOrg = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 h-14 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            FUDL
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-4">
            <NavLinks pathname={pathname} hasOrg={hasOrg} role={role} />
          </nav>
        </div>

        {/* Right: Avatar + mobile menu */}
        <div className="flex items-center gap-2">
          {/* User avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="gap-2">
                  <User className="size-4" />
                  Profile settings
                </Link>
              </DropdownMenuItem>
              {hasOrg && (
                <DropdownMenuItem asChild>
                  <Link href="/settings/team" className="gap-2">
                    <Settings className="size-4" />
                    Team settings
                  </Link>
                </DropdownMenuItem>
              )}
              {orgs.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {/* Org switcher */}
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Teams
                  </DropdownMenuLabel>
                  {orgs.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => {
                        if (org.id !== activeOrgId) {
                          handleSwitchOrg(org.id);
                        }
                      }}
                      className="justify-between"
                    >
                      <span className="truncate">{org.name}</span>
                      {org.id === activeOrgId && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Active
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive gap-2"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>FUDL</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 px-4 pt-4">
                <NavLinks
                  pathname={pathname}
                  hasOrg={hasOrg}
                  role={role}
                  onClick={() => setMobileNavOpen(false)}
                />
                <Separator className="my-2" />
                <Link
                  href="/settings/profile"
                  onClick={() => setMobileNavOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground py-1"
                >
                  Profile settings
                </Link>
                {hasOrg && (
                  <Link
                    href="/settings/team"
                    onClick={() => setMobileNavOpen(false)}
                    className="text-sm text-muted-foreground hover:text-foreground py-1"
                  >
                    Team settings
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
