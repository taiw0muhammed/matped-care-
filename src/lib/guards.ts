import type { Role, User, Child } from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentUser } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    await logAudit(user.id, null, "FORBIDDEN", { attemptedRoles: roles, userRole: user.role });
    throw new HttpError(403, "You do not have permission to perform this action");
  }
  return user;
}

/**
 * Load a child and verify the acting user is authorized to see it:
 * - ADMIN: everything
 * - NURSE: children they manage, or children where they are the assigned nurse,
 *   plus children whose records they were granted (all of a nurse's children are
 *   theirs via nurseId)
 * - PARENT: only children where a Guardian link exists for them
 * Returns the child (with guardian users included) or throws 404 to avoid
 * leaking the existence of other users' records.
 */
export async function getAuthorizedChild(childId: string, user: User): Promise<Child> {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: {
      guardians: { include: { user: true } },
      nurse: true,
    },
  });
  if (!child) throw new HttpError(404, "Child not found");

  const allowed =
    user.role === "ADMIN" ||
    (user.role === "NURSE" && child.nurseId === user.id) ||
    (user.role === "PARENT" && child.guardians.some((g) => g.userId === user.id));

  if (!allowed) {
    await logAudit(user.id, null, "DENIED_CHILD_ACCESS", { childId });
    throw new HttpError(404, "Child not found");
  }
  return child;
}

export async function logAudit(
  userId: string | null,
  childId: string | null,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, childId, action, details: (details ?? undefined) as object },
    });
  } catch {
    // Auditing must never break the request path.
  }
}