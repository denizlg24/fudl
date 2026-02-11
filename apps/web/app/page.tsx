import { getServerSession } from "./lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // Always go to dashboard
  redirect("/dashboard");
}
