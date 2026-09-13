import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/login");
  return <Shell role="ADMIN" name={user.fullName}>{children}</Shell>;
}