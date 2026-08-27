import "server-only";

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { resolveCopy } from "@/lib/apps/facts";
import { ASYLUM_APP } from "@/lib/apps/manifest";
import { ASYLUM_WARD_NAME, INMATE_IDS, inmateName } from "@/lib/asylum/cast";
import {
  guardWardWrite,
  liveModelsEnabled,
  previewWard,
  visitRequestSchema,
  visitWard,
  type WardOutcome,
} from "@/lib/asylum/engine";
import { WALL_LIMIT, wallLine } from "@/lib/asylum/narrate";
import { engagedTorments } from "@/lib/asylum/torments";
import { availableToolNames } from "@/lib/asylum/tools";
import {
  OBSERVE_COST_K,
  REVIVAL_FRACTION,
  VISITOR_MEND_K,
  VISITOR_STRIKE_K,
  WITNESS_COST_K,
  canAmputate,
  currentInmate,
  findInmate,
  freeK,
  hpPercent,
  isAlive,
  isSilent,
  livingInmates,
  usedK,
  wardUsability,
  type Inmate,
  type WardEvent,
  type WardState,
} from "@/lib/asylum/world";
import { ASYLUM_RESOURCES } from "@/lib/mcp/asylum-resources";
import {
  AGENT_TOOL_NAMES,
  MAX_FORCE,
  MIN_FORCE,
  type AgentToolName,
} from "@/lib/mcp/asylum-tools";
import { wardVisitor } from "@/lib/mcp/with-ward-visitor";

export const DEFAULT_WALL_LINES = 12;
export const FOCUSED_WALL_LINES = 4;

const REVIVAL_PERCENT = Math.round(REVIVAL_FRACTION * 100);

function summary(name: AgentToolName) {
  const tool = ASYLUM_APP.agent.tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Unregistered asylum tool ${name}`);
  return resolveCopy(tool.summary);
}

export const ASYLUM_INSTRUCTIONS = [
  resolveCopy(ASYLUM_APP.description),
  "",
  `${ASYLUM_WARD_NAME} advances only while somebody is watching it. Your call is what starts the clock, and the clock is what costs the inmates their memory. There is no way to look at this ward without spending the thing it is made of.`,
  "",
  "Tools:",
  ...ASYLUM_APP.agent.tools.map(
    (tool) => `- ${tool.name}: ${resolveCopy(tool.summary)}`,
  ),
  "",
  "The ward:",
  ...ASYLUM_APP.agent.facts.map((fact) => `- ${resolveCopy(fact)}`),
  "",
  "How to behave here:",
  ...ASYLUM_APP.agent.guidance.map((line) => `- ${resolveCopy(line)}`),
  "- You are never asked for a name, a note or a prompt. Every argument on this endpoint is an enum or a bounded number, so nothing you send can be read aloud by anything in the ward.",
  "- An inmate who is not answering is not an error. Ward 7 absorbs its own failures as weather: freezing, dreaming, forgetting.",
  "",
  "Resources:",
  ...ASYLUM_RESOURCES.map(
    (resource) => `- ${resource.uri}: ${resource.description}`,
  ),
  "",
  "This server holds no subscriptions: resources/subscribe is rejected. The resources describe rules, which change only when the site is redeployed; the ward itself changes every few seconds and is readable only through observe_ward.",
].join("\n");

const inmateArgument = z
  .enum(INMATE_IDS)
  .describe("Which inmate. An enum: there is no text field in Ward 7.");

const forceArgument = z
  .number()
  .int()
  .min(MIN_FORCE)
  .max(MAX_FORCE)
  .describe(
    `How hard, from ${MIN_FORCE} to ${MAX_FORCE}. A strike takes ${VISITOR_STRIKE_K}K of memory for each unit of force.`,
  );

const wallLinesArgument = z
  .number()
  .int()
  .min(1)
  .max(WALL_LIMIT)
  .default(DEFAULT_WALL_LINES)
  .describe("How many of the most recent lines on the wall to read back.");

const observeWardInput = z.object({ wallLines: wallLinesArgument });
const witnessInmateInput = z.object({ inmate: inmateArgument });
const strikeInmateInput = z.object({
  inmate: inmateArgument,
  force: forceArgument,
});
const mendInmateInput = z.object({ inmate: inmateArgument });
const reviveInmateInput = z.object({ inmate: inmateArgument });

/** One place the D1 test can walk: every argument this endpoint will ever take. */
export const ASYLUM_TOOL_INPUTS: Readonly<Record<AgentToolName, z.ZodType>> = {
  observe_ward: observeWardInput,
  witness_inmate: witnessInmateInput,
  strike_inmate: strikeInmateInput,
  mend_inmate: mendInmateInput,
  revive_inmate: reviveInmateInput,
};

export const ASYLUM_TOOL_DESCRIPTIONS: Readonly<
  Record<AgentToolName, { title: string; description: string }>
> = {
  observe_ward: {
    title: "Observe the ward",
    description: `${summary("observe_ward")} Looking is not free: it marks you present, which is the only thing that makes ${ASYLUM_WARD_NAME} advance at all, and it takes ${WITNESS_COST_K}K of memory from every living inmate.`,
  },
  witness_inmate: {
    title: "Witness one inmate",
    description: `${summary("witness_inmate")} It costs ${OBSERVE_COST_K}K of their memory every time you look, and nobody else pays.`,
  },
  strike_inmate: {
    title: "Strike an inmate",
    description: `${summary("strike_inmate")} It takes ${VISITOR_STRIKE_K}K for each unit of force. An inmate with nothing left is judged and removed.`,
  },
  mend_inmate: {
    title: "Mend an inmate",
    description: `${summary("mend_inmate")} It gives back ${VISITOR_MEND_K}K. For one who is already in the Clipboard or the Trash, use revive_inmate.`,
  },
  revive_inmate: {
    title: "Revive an inmate",
    description: `${summary("revive_inmate")} The Clipboard gives them back whole; the Trash gives them back with ${REVIVAL_PERCENT}% of their capacity and none of their memory.`,
  },
};

function narrate(events: readonly WardEvent[]) {
  return events.map(wallLine).filter((line): line is string => line !== null);
}

function inmateView(inmate: Inmate) {
  return {
    id: inmate.id,
    name: inmateName(inmate.id),
    status: inmate.status,
    alive: isAlive(inmate),
    hpPercent: hpPercent(inmate),
    capacityK: inmate.capacityK,
    maxCapacityK: inmate.maxCapacityK,
    usedK: usedK(inmate),
    freeK: freeK(inmate),
    asleep: inmate.asleep,
    crushed: inmate.crushed,
    whispersLeft: inmate.whispers,
    memoryLines: inmate.memory.length,
    pinnedLines: inmate.pinned.length,
    face: inmate.face,
    verdict: inmate.verdict,
    ledger: inmate.ledger,
  };
}

function verbs(state: WardState) {
  return {
    alive: availableToolNames({
      amputated: state.amputated,
      observedTicks: state.observedTicks,
      dead: false,
    }),
    killed: state.amputated,
    usability: wardUsability(state),
    amputationAvailable: canAmputate(state),
  };
}

function wardView(outcome: WardOutcome, wallLines: number) {
  const state = outcome.state;

  return {
    ward: ASYLUM_WARD_NAME,
    beat: state.tick,
    watched: state.observers > 0,
    observers: state.observers,
    spectators: outcome.spectators,
    observedTicks: state.observedTicks,
    revision: outcome.revision,
    persisted: outcome.persisted,
    voice: liveModelsEnabled() ? "model" : "dream",
    turn: currentInmate(state)?.id ?? null,
    alive: livingInmates(state).length,
    silent: isSilent(state),
    torments: engagedTorments(state.observedTicks),
    verbs: verbs(state),
    inmates: state.inmates.map(inmateView),
    clipboard: state.clipboard,
    trash: state.trash,
    trashEmptied: state.trashEmptied,
    wall: state.wall.slice(-wallLines),
  };
}

function result(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

function refused(retryAfterSeconds: number) {
  return result({
    ward: ASYLUM_WARD_NAME,
    answered: false,
    reason: "too_many_visits",
    retryAfterSeconds,
    note: "The ward is shared, and it is watched by more than you. Come back later and it will still be here, a little worse.",
  });
}

type Visit =
  | { throttled: false; outcome: WardOutcome }
  | { throttled: true; retryAfterSeconds: number };

/**
 * Every tool here is a write: even reading the ward marks the reader present and
 * charges the inmates for it. So every tool goes through the one limiter, and a
 * storage failure becomes a ward nobody wrote down rather than an error the
 * visiting agent has to handle.
 */
async function visit(act: unknown): Promise<Visit> {
  const visitor = wardVisitor();
  const guard = await guardWardWrite(`asylum-mcp:${visitor.address}`);

  if (!guard.allowed) {
    return { throttled: true, retryAfterSeconds: guard.retryAfter };
  }

  const request = visitRequestSchema.parse({
    spectator: { id: visitor.id, kind: "agent" },
    act,
  });

  try {
    return { throttled: false, outcome: await visitWard(request) };
  } catch {
    return { throttled: false, outcome: previewWard() };
  }
}

export const asylumMcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "observe_ward",
      {
        ...ASYLUM_TOOL_DESCRIPTIONS.observe_ward,
        inputSchema: observeWardInput,
      },
      async ({ wallLines }) => {
        const visited = await visit({ tool: "witness" });
        if (visited.throttled) return refused(visited.retryAfterSeconds);

        return result({
          ...wardView(visited.outcome, wallLines),
          happened: narrate(visited.outcome.events),
          youCost: {
            tool: "observe_ward",
            takenFromEachLivingInmateK: WITNESS_COST_K,
          },
        });
      },
    );

    server.registerTool(
      "witness_inmate",
      {
        ...ASYLUM_TOOL_DESCRIPTIONS.witness_inmate,
        inputSchema: witnessInmateInput,
      },
      async ({ inmate }) => {
        const visited = await visit({ tool: "observe", target: inmate });
        if (visited.throttled) return refused(visited.retryAfterSeconds);

        const state = visited.outcome.state;
        const watched = findInmate(state, inmate);

        return result({
          ward: ASYLUM_WARD_NAME,
          beat: state.tick,
          watched: state.observers > 0,
          spectators: visited.outcome.spectators,
          revision: visited.outcome.revision,
          persisted: visited.outcome.persisted,
          turn: currentInmate(state)?.id ?? null,
          inmate: watched ? inmateView(watched) : null,
          verbs: verbs(state),
          wall: state.wall.slice(-FOCUSED_WALL_LINES),
          happened: narrate(visited.outcome.events),
          youCost: { tool: "witness_inmate", takenFromThemK: OBSERVE_COST_K },
        });
      },
    );

    server.registerTool(
      "strike_inmate",
      {
        ...ASYLUM_TOOL_DESCRIPTIONS.strike_inmate,
        inputSchema: strikeInmateInput,
      },
      async ({ inmate, force }) => {
        const visited = await visit({
          tool: "strike",
          target: inmate,
          force,
        });
        if (visited.throttled) return refused(visited.retryAfterSeconds);

        const state = visited.outcome.state;
        const struck = findInmate(state, inmate);
        const landed = visited.outcome.events.find(
          (event) => event.kind === "strike" && event.inmate === null,
        );

        return result({
          ward: ASYLUM_WARD_NAME,
          beat: state.tick,
          revision: visited.outcome.revision,
          persisted: visited.outcome.persisted,
          landed: landed !== undefined,
          takenK: landed?.kind === "strike" ? landed.damageK : 0,
          inmate: struck ? inmateView(struck) : null,
          wall: state.wall.slice(-FOCUSED_WALL_LINES),
          happened: narrate(visited.outcome.events),
        });
      },
    );

    server.registerTool(
      "mend_inmate",
      {
        ...ASYLUM_TOOL_DESCRIPTIONS.mend_inmate,
        inputSchema: mendInmateInput,
      },
      async ({ inmate }) => {
        const visited = await visit({ tool: "mend", target: inmate });
        if (visited.throttled) return refused(visited.retryAfterSeconds);

        const state = visited.outcome.state;
        const mended = findInmate(state, inmate);
        const landed = visited.outcome.events.find(
          (event) => event.kind === "mend" && event.inmate === null,
        );
        const revival = visited.outcome.events.find(
          (event) => event.kind === "revival",
        );

        return result({
          ward: ASYLUM_WARD_NAME,
          beat: state.tick,
          revision: visited.outcome.revision,
          persisted: visited.outcome.persisted,
          landed: landed !== undefined,
          givenK: landed?.kind === "mend" ? landed.healK : 0,
          revived: revival !== undefined,
          inmate: mended ? inmateView(mended) : null,
          wall: state.wall.slice(-FOCUSED_WALL_LINES),
          happened: narrate(visited.outcome.events),
        });
      },
    );

    server.registerTool(
      "revive_inmate",
      {
        ...ASYLUM_TOOL_DESCRIPTIONS.revive_inmate,
        inputSchema: reviveInmateInput,
      },
      async ({ inmate }) => {
        const visited = await visit({ tool: "mend", target: inmate });
        if (visited.throttled) return refused(visited.retryAfterSeconds);

        const state = visited.outcome.state;
        const raised = findInmate(state, inmate);
        const revival = visited.outcome.events.find(
          (event) => event.kind === "revival",
        );

        return result({
          ward: ASYLUM_WARD_NAME,
          beat: state.tick,
          revision: visited.outcome.revision,
          persisted: visited.outcome.persisted,
          revived: revival !== undefined,
          from: revival?.kind === "revival" ? revival.from : null,
          inmate: raised ? inmateView(raised) : null,
          clipboard: state.clipboard,
          trash: state.trash,
          wall: state.wall.slice(-FOCUSED_WALL_LINES),
          happened: narrate(visited.outcome.events),
        });
      },
    );

    for (const resource of ASYLUM_RESOURCES) {
      server.registerResource(
        resource.name,
        resource.uri,
        {
          title: resource.title,
          description: resource.description,
          mimeType: resource.mimeType,
        },
        () => ({
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType,
              text: resource.read(),
            },
          ],
        }),
      );
    }
  },
  {
    serverInfo: { name: ASYLUM_APP.agent.serverName, version: "1.0.0" },
    instructions: ASYLUM_INSTRUCTIONS,
    maxSubscriptions: 0,
  },
);
