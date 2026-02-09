import { LoginForm } from "../components/auth";
import { Suspense } from "react";

async function LoginFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm redirectTo={params.redirect} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense>
        <LoginFormWrapper searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
