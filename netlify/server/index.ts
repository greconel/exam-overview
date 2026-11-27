import type { Config } from "@netlify/server";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { progress, tasks } from "../../db/schema.ts";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

const KEY_RE = /^[a-z0-9:_-]{1,80}$/i;

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  try {
    // Everything in one go: progress map + own tasks
    if (path === "/api/state" && req.method === "GET") {
      const [rows, taskRows] = await Promise.all([
        db.select().from(progress),
        db.select().from(tasks).orderBy(tasks.createdAt),
      ]);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      return json({ progress: map, tasks: taskRows });
    }

    // Set or clear one progress value
    if (path === "/api/progress" && req.method === "PUT") {
      const { key, value } = await readBody(req);
      if (typeof key !== "string" || !KEY_RE.test(key)) return json({ error: "Ongeldige sleutel" }, 400);
      if (value === null || value === undefined || value === "") {
        await db.delete(progress).where(eq(progress.key, key));
        return json({ ok: true });
      }
      if (typeof value !== "string" || value.length > 200) return json({ error: "Ongeldige waarde" }, 400);
      await db
        .insert(progress)
        .values({ key, value })
        .onConflictDoUpdate({ target: progress.key, set: { value, updatedAt: new Date() } });
      return json({ ok: true });
    }

    if (path === "/api/tasks" && req.method === "POST") {
      const { title, course } = await readBody(req);
      if (typeof title !== "string" || !title.trim() || title.length > 300) return json({ error: "Titel ontbreekt" }, 400);
      const [task] = await db
        .insert(tasks)
        .values({ title: title.trim(), course: typeof course === "string" ? course.slice(0, 40) : "" })
        .returning();
      return json(task, 201);
    }

    const m = path.match(/^\/api\/tasks\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      if (req.method === "PATCH") {
        const { done, title } = await readBody(req);
        const set: { done?: boolean; title?: string } = {};
        if (typeof done === "boolean") set.done = done;
        if (typeof title === "string" && title.trim()) set.title = title.trim().slice(0, 300);
        if (!Object.keys(set).length) return json({ error: "Niets te wijzigen" }, 400);
        const [task] = await db.update(tasks).set(set).where(eq(tasks.id, id)).returning();
        return task ? json(task) : json({ error: "Niet gevonden" }, 404);
      }
      if (req.method === "DELETE") {
        await db.delete(tasks).where(eq(tasks.id, id));
        return json({ ok: true });
      }
    }

    return json({ error: "Niet gevonden" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Serverfout" }, 500);
  }
};

export const config: Config = { path: "/api/*" };
