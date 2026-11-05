import { auditLogs } from "@/lib/db/schema";
import { clientIp } from "@/lib/api";

type Executor = { insert: (t: typeof auditLogs) => { values: (v: typeof auditLogs.$inferInsert) => PromiseLike<unknown> } };

export function audit(
  x: Executor,
  req: Request | null,
  e: {
    workspaceId: string | null; actorId: string | null; action: string; targetType: string;
    targetId?: string | null; before?: unknown; after?: unknown;
  },
) {
  return x.insert(auditLogs).values({
    workspaceId: e.workspaceId, actorId: e.actorId, action: e.action, targetType: e.targetType,
    targetId: e.targetId ?? null, before: e.before ?? null, after: e.after ?? null,
    ip: req ? clientIp(req) : null, userAgent: req?.headers.get("user-agent") ?? null,
  });
}
