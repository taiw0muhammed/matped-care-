import type { Child, User } from "@prisma/client";
import { prisma } from "../prisma";
import { ADAPTERS, type NotificationPayload } from "./adapters";
import { computeDosePlan, type GivenDose } from "../immunization/logic";
import { ageInDays } from "../dates";

export interface ChildAlert {
  kind: "overdue" | "due_today" | "due_soon" | "growth";
  title: string;
  body: string;
  severity: "red" | "yellow" | "blue";
  channels: ("SMS" | "EMAIL" | "PUSH" | "WHATSAPP")[];
}

/**
 * Build alerts for a child from their dose plan and latest growth status.
 * Pure function — safe to unit test.
 */
export function buildAlerts(
  child: Pick<Child, "firstName" | "sex" | "dateOfBirth" | "status">,
  givenDoses: GivenDose[],
  now: Date,
  growthStatus?: "GREEN" | "YELLOW" | "RED" | null,
  dosePlan?: ReturnType<typeof computeDosePlan>,
): ChildAlert[] {
  const plan = dosePlan ?? computeDosePlan(child.dateOfBirth, givenDoses, now);
  const alerts: ChildAlert[] = [];
  if (child.status === "DECEASED" || child.status === "TRANSFERRED") return alerts;
  const name = child.firstName;

  if (plan.overdue.length > 0) {
    alerts.push({
      kind: "overdue",
      title: `${name}: ${plan.overdue.length} overdue vaccine${plan.overdue.length > 1 ? "s" : ""}`,
      body: `Overdue: ${plan.overdue.map((d) => d.name).join(", ")}. Please schedule a catch-up visit.`,
      severity: "red",
      channels: ["SMS", "EMAIL", "PUSH"],
    });
  }
  if (plan.dueToday.length > 0) {
    alerts.push({
      kind: "due_today",
      title: `${name}: vaccines due today`,
      body: `Due today: ${plan.dueToday.map((d) => d.name).join(", ")}.`,
      severity: "blue",
      channels: ["SMS", "EMAIL", "PUSH"],
    });
  }
  if (plan.dueSoon.length > 0) {
    alerts.push({
      kind: "due_soon",
      title: `${name}: ${plan.dueSoon.length} upcoming within 14 days`,
      body: `Upcoming: ${plan.dueSoon.map((d) => `${d.name} (${d.scheduledDate.toISOString().slice(0, 10)})`).join(", ")}.`,
      severity: "yellow",
      channels: ["EMAIL", "PUSH"],
    });
  }
  if (growthStatus === "RED") {
    alerts.push({
      kind: "growth",
      title: `${name}: growth pattern may need clinical review`,
      body: `Latest WHO assessment is RED for this ${child.sex === "MALE" ? "boy" : "girl"} (age ${ageInDays(child.dateOfBirth, now)} days). Please review with a clinician.`,
      severity: "red",
      channels: ["SMS", "EMAIL", "PUSH"],
    });
  } else if (growthStatus === "YELLOW") {
    alerts.push({
      kind: "growth",
      title: `${name}: growth pattern needs monitoring`,
      body: `Latest WHO assessment is YELLOW. Re-measure and follow the growth trend at the next visit.`,
      severity: "yellow",
      channels: ["EMAIL", "PUSH"],
    });
  }
  return alerts;
}

/**
 * Persist and dispatch alerts for all guardians of a child. Idempotent:
 * skips an alert if an identical unsent/SENT notification for this child,
 * title and channel exists within the last 24h (prevents re-notification
 * storms on every page load).
 */
export async function dispatchAlerts(
  childId: string,
  alerts: ChildAlert[],
  guardians: User[],
): Promise<number> {
  const priority: Record<string, number> = { SMS: 3, EMAIL: 2, PUSH: 1, WHATSAPP: 0 };
  let sent = 0;
  for (const alert of alerts) {
    // Pick the highest-priority reachable channel per guardian.
    const channels = alert.channels
      .filter((c) =>
        c === "EMAIL"
          ? guardians.some((g) => g.email)
          : c === "SMS" || c === "WHATSAPP"
            ? guardians.some((g) => g.phone)
            : true,
      )
      .sort((a, b) => priority[b] - priority[a]);
    if (channels.length === 0) continue;
    const channel = channels[0];

    const recent = await prisma.notification.findFirst({
      where: {
        childId,
        title: alert.title,
        channel,
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    });
    if (recent) continue;

    for (const guardian of guardians) {
      const to =
        channel === "EMAIL" ? guardian.email || "" : channel === "SMS" || channel === "WHATSAPP" ? guardian.phone || "" : "in-app";
      const payload: NotificationPayload = {
        to,
        title: alert.title,
        body: alert.body,
        channel,
      };
      const result = await ADAPTERS[channel](payload);
      await prisma.notification.create({
        data: {
          childId,
          userId: guardian.id,
          channel,
          status: result.ok ? "SENT" : "FAILED",
          title: alert.title,
          body: alert.body,
          meta: { provider: result.provider, detail: result.detail ?? null },
          sentAt: result.ok ? new Date() : null,
          error: result.ok ? null : result.detail ?? null,
        },
      });
      if (result.ok) sent += 1;
    }
  }
  return sent;
}