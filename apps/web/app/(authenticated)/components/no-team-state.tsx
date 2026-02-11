import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Users } from "lucide-react";
import Link from "next/link";

export function NoTeamState({ message }: { message?: string }) {
  return (
    <Empty className="min-h-100">
      <EmptyMedia>
        <Users className="size-16 text-muted-foreground" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>No team selected</EmptyTitle>
        <EmptyDescription>
          {message ||
            "You need to be part of a team to access this page. Create or join a team from the dashboard."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
