import {
  FORCES,
  VISITOR_TOOL_NAMES,
  type VisitorToolName,
} from "@/lib/asylum/tools";

export const AGENT_TOOL_NAMES = [
  "observe_ward",
  "witness_inmate",
  "strike_inmate",
  "mend_inmate",
  "revive_inmate",
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

/**
 * The visiting vocabulary renames the core's, it never extends it. Every tool a
 * visiting agent can call resolves to one `VisitorAct`, so the ward is only ever
 * reachable through a verb the pure core already models.
 */
export const AGENT_TOOL_ACTS: Readonly<Record<AgentToolName, VisitorToolName>> =
  {
    observe_ward: "witness",
    witness_inmate: "observe",
    strike_inmate: "strike",
    mend_inmate: "mend",
    revive_inmate: "mend",
  };

export const MIN_FORCE = Math.min(...FORCES);
export const MAX_FORCE = Math.max(...FORCES);

export function visitorToolsReachedByAgents(): VisitorToolName[] {
  const reached = new Set<VisitorToolName>(Object.values(AGENT_TOOL_ACTS));
  return VISITOR_TOOL_NAMES.filter((name) => reached.has(name));
}
