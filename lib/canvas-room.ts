import { CANVAS_ROOM_ID } from "@/lib/canvas";

type RoomEnvironment = { readonly [key: string]: string | undefined };

export function resolveRoomId(env: RoomEnvironment = process.env) {
  if (env.CANVAS_ROOM_ID) return env.CANVAS_ROOM_ID;

  return env.VERCEL_ENV === "production"
    ? CANVAS_ROOM_ID
    : `${CANVAS_ROOM_ID}:${env.VERCEL_ENV ?? "development"}`;
}

export function isProductionRoom(env: RoomEnvironment = process.env) {
  return resolveRoomId(env) === CANVAS_ROOM_ID;
}

export function assertDisposableRoom(env: RoomEnvironment = process.env) {
  if (!isProductionRoom(env)) return;

  throw new Error(
    [
      "Refusing to run destructive tests against the production canvas room.",
      `Resolved room: ${resolveRoomId(env)}`,
      "These tests clear the canvas and empty the Trash. Unset CANVAS_ROOM_ID,",
      "or point DATABASE_URL at a scratch database, before running them.",
    ].join(" "),
  );
}
