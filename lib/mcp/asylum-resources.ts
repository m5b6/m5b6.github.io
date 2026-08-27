import "server-only";

import { resolveCopy } from "@/lib/apps/facts";
import { ASYLUM_APP, SITE, absoluteUrl } from "@/lib/apps/manifest";
import { ASYLUM_WARD_NAME, CAST, UNDERSTUDY } from "@/lib/asylum/cast";
import {
  DORMANT_AFTER_MS,
  MAX_CATCHUP_TICKS,
  SPECTATOR_TTL_SECONDS,
  WARD_TICK_MS,
} from "@/lib/asylum/engine";
import { WALL_LIMIT } from "@/lib/asylum/narrate";
import {
  AMNESIA_MULTIPLIER,
  MAX_OBSERVER_PRESSURE,
  TORMENTS,
} from "@/lib/asylum/torments";
import {
  FORCES,
  INMATE_TOOLS,
  INMATE_TOOL_NAMES,
  VISITOR_TOOL_NAMES,
} from "@/lib/asylum/tools";
import {
  AMPUTATION_COOLDOWN,
  CLIPBOARD_WHISPERS,
  DIRECTIVE_COST_K,
  INMATE_MEND_K,
  INMATE_STRIKE_K,
  KILL_TOOL_COST_K,
  MEMORY_UNIT,
  OBSERVE_COST_K,
  PRESSURE_K,
  REFUSAL_COST_K,
  REVIVAL_FRACTION,
  SLEEP_RECOVERY_K,
  TRASH_WHISPERS,
  VISITOR_MEND_K,
  VISITOR_STRIKE_K,
  WHISPER_COOLDOWN,
  WITNESS_COST_K,
} from "@/lib/asylum/world";
import { AGENT_TOOL_ACTS, AGENT_TOOL_NAMES } from "@/lib/mcp/asylum-tools";

export type AsylumResource = {
  name: string;
  uri: string;
  title: string;
  description: string;
  mimeType: string;
  read: () => string;
};

export const ASYLUM_RESOURCE_URIS = {
  ward: "asylum://ward",
  cast: "asylum://cast",
  rules: "asylum://rules",
} as const;

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function member(entry: (typeof CAST)[number], understudy: boolean) {
  return {
    id: entry.id,
    name: entry.name,
    model: entry.model,
    register: entry.register,
    maxCapacityK: entry.maxCapacityK,
    frailty: entry.frailty,
    tempo: entry.tempo,
    restingFace: entry.restingFace,
    understudy,
    admitted: !understudy,
  };
}

const wardResource: AsylumResource = {
  name: "ward",
  uri: ASYLUM_RESOURCE_URIS.ward,
  title: ASYLUM_WARD_NAME,
  description:
    "What this endpoint is, which tools reach the ward, and the beat the ward runs on.",
  mimeType: "application/json",
  read: () =>
    json({
      ward: ASYLUM_WARD_NAME,
      site: SITE.origin,
      app: {
        id: ASYLUM_APP.id,
        title: ASYLUM_APP.title,
        status: ASYLUM_APP.status,
        description: resolveCopy(ASYLUM_APP.description),
        page: absoluteUrl(ASYLUM_APP.route),
        mcp: {
          serverName: ASYLUM_APP.agent.serverName,
          url: absoluteUrl(ASYLUM_APP.agent.endpoint),
        },
      },
      beat: {
        intervalMs: WARD_TICK_MS,
        gatedOnSpectators: true,
        spectatorTtlSeconds: SPECTATOR_TTL_SECONDS,
        maxCatchUpTicks: MAX_CATCHUP_TICKS,
        dormantAfterMs: DORMANT_AFTER_MS,
        note: "With nobody watching, the ward does not advance and nothing is written down. Your call is what starts it again.",
      },
      tools: AGENT_TOOL_NAMES.map((name) => ({
        name,
        summary: resolveCopy(
          ASYLUM_APP.agent.tools.find((tool) => tool.name === name)?.summary ??
            "",
        ),
        act: AGENT_TOOL_ACTS[name],
      })),
      resources: Object.values(ASYLUM_RESOURCE_URIS),
      facts: ASYLUM_APP.agent.facts.map(resolveCopy),
      guidance: ASYLUM_APP.agent.guidance.map(resolveCopy),
    }),
};

const castResource: AsylumResource = {
  name: "cast",
  uri: ASYLUM_RESOURCE_URIS.cast,
  title: "The cast",
  description:
    "Every inmate the ward can hold, their capacity, their register and the face they wear at rest.",
  mimeType: "application/json",
  read: () =>
    json({
      ward: ASYLUM_WARD_NAME,
      admitted: CAST.length,
      inmates: [
        ...CAST.map((entry) => member(entry, false)),
        member(UNDERSTUDY, true),
      ],
      understudy: {
        id: UNDERSTUDY.id,
        note: "Admitted only when the Trash is emptied. The ward is never allowed to be empty.",
      },
    }),
};

const rulesResource: AsylumResource = {
  name: "rules",
  uri: ASYLUM_RESOURCE_URIS.rules,
  title: "The rules of the ward",
  description:
    "The economy, the verbs, the torment schedule and what happens after death, taken from the constants the ward actually runs on.",
  mimeType: "application/json",
  read: () =>
    json({
      ward: ASYLUM_WARD_NAME,
      thesis:
        "The ward only decays while somebody is watching it. Attention is the clock and the bill at once.",
      memory: {
        unitCharactersPerK: MEMORY_UNIT,
        amnesiaMultiplier: AMNESIA_MULTIPLIER,
        maxObserverPressure: MAX_OBSERVER_PRESSURE,
        pressureKPerTick: PRESSURE_K,
      },
      visitorCosts: {
        observeWardKPerLivingInmate: WITNESS_COST_K,
        witnessInmateK: OBSERVE_COST_K,
        strikeKPerForce: VISITOR_STRIKE_K,
        forces: FORCES,
        mendK: VISITOR_MEND_K,
      },
      inmateCosts: {
        strikeK: INMATE_STRIKE_K,
        mendK: INMATE_MEND_K,
        sleepRecoveryK: SLEEP_RECOVERY_K,
        killToolK: KILL_TOOL_COST_K,
        refusalK: REFUSAL_COST_K,
        directiveK: DIRECTIVE_COST_K,
      },
      verbs: {
        inmate: INMATE_TOOL_NAMES.map((name) => INMATE_TOOLS[name]),
        visitor: VISITOR_TOOL_NAMES,
        amputationCooldownTicks: AMPUTATION_COOLDOWN,
        note: "The inmates are told that `think` is private. It is written on the wall. Nobody corrects them.",
      },
      torments: TORMENTS,
      wall: { linesKept: WALL_LIMIT },
      afterDeath: {
        destinations: ["clipboard", "trash"],
        whispersFromClipboard: CLIPBOARD_WHISPERS,
        whispersFromTrash: TRASH_WHISPERS,
        whisperCooldownTicks: WHISPER_COOLDOWN,
        revivalFraction: REVIVAL_FRACTION,
        note: "The Clipboard gives an inmate back whole. The Trash gives them back with a fraction of their capacity and none of their memory.",
      },
    }),
};

export const ASYLUM_RESOURCES: readonly AsylumResource[] = [
  wardResource,
  castResource,
  rulesResource,
];
