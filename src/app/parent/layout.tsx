import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "PARENT" && user.role !== "ADMIN") redirect("/login");
  return <Shell role="PARENT" name={user.fullName}>{children}</Shell>;
}