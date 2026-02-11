import { Suspense } from "react";
import { DeleteAccountContent } from "./delete-account-content";

async function DeleteAccountWrapper({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <DeleteAccountContent token={params.token} />;
}

export default function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense>
        <DeleteAccountWrapper searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
