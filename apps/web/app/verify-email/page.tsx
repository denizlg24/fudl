import { Suspense } from "react";
import { VerifyEmailContent } from "./verify-email-content";

async function VerifyEmailWrapper({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  return <VerifyEmailContent token={params.token} redirect={params.redirect} />;
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense>
        <VerifyEmailWrapper searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
