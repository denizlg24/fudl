import { Suspense } from "react";
import { ResetPasswordContent } from "./reset-password-content";

async function ResetPasswordWrapper({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordContent token={params.token} />;
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense>
        <ResetPasswordWrapper searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
