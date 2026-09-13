import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";

export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "NURSE" && user.role !== "ADMIN") redirect("/parent");
  return <Shell role={user.role} name={user.fullName}>{children}</Shell>;
}