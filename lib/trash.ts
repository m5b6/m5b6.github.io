import { z } from "zod";
import { participantNameSchema } from "@/lib/participant-name";

export const MAX_TRASH_ENTRIES = 25;

export type TrashEntry = {
  revision: number;
  pixelCount: number;
  discardedBy: string;
  discardedAt: string;
};

export type TrashSnapshot = { entries: TrashEntry[] };

export type RestoreResult =
  | { restored: false }
  | { restored: true; revision: number; pixelCount: number };

export const trashEntrySchema = z.object({
  revision: z.number().int().gte(0),
  pixelCount: z.number().int().gte(0),
  discardedBy: z.string(),
  discardedAt: z.string(),
});

export const trashSnapshotSchema = z.object({
  entries: z.array(trashEntrySchema).max(MAX_TRASH_ENTRIES),
});

const actorSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9:-]+$/),
  name: participantNameSchema,
});

export const trashRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("putBack"),
    participant: actorSchema,
    revision: z.number().int().gte(0).optional(),
  }),
  z.object({
    action: z.literal("empty"),
    participant: actorSchema,
  }),
]);

export type TrashRequest = z.infer<typeof trashRequestSchema>;

export function totalTrashedPixels(entries: readonly TrashEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.pixelCount, 0);
}

export function describeTrash(entries: readonly TrashEntry[]) {
  if (entries.length === 0) return "The Trash is empty.";

  const pixels = totalTrashedPixels(entries);
  const paintings = entries.length === 1 ? "1 painting" : `${entries.length} paintings`;
  const dots = pixels === 1 ? "1 pixel" : `${pixels.toLocaleString("en-US")} pixels`;

  return `${paintings}, ${dots}`;
}
