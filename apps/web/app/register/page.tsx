import { RegisterForm } from "../components/auth";
import { Suspense } from "react";

async function RegisterFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  return <RegisterForm redirectTo={params.redirect} />;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense>
        <RegisterFormWrapper searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
