import { MacProgressBar } from "@/components/mac";
import {
  INMATE_TOOL_NAMES,
  isAmputated,
  type InmateToolName,
} from "@/lib/asylum/tools";
import { isTormentEngaged } from "@/lib/asylum/torments";
import { isSilent, wardUsability, type WardState } from "@/lib/asylum/world";

export type ToolCondition = "live" | "sealed" | "afterlife" | "gone";

export function toolCondition(
  state: WardState,
  tool: InmateToolName,
): ToolCondition {
  if (isAmputated(state.amputated, tool)) return "gone";
  if (tool === "whisper") return "afterlife";
  if (tool === "kill_tool") {
    return isTormentEngaged(state.observedTicks, "tool_amputation")
      ? "live"
      : "sealed";
  }
  return "live";
}

/**
 * Requirement four. An amputated verb loses its box as well as its name: the rack
 * itself gets emptier to look at, which is the whole point of killing a tool.
 */
export function ToolRack({ state }: { state: WardState }) {
  const remaining = INMATE_TOOL_NAMES.length - state.amputated.length;
  const silent = isSilent(state);

  return (
    <section className="ward-rack">
      <h3 className="ward-heading">
        THE TOOL RACK
        <span className="ward-heading-note">
          {remaining} OF {INMATE_TOOL_NAMES.length} VERBS · A KILLED VERB NEVER
          COMES BACK
        </span>
      </h3>
      <ul className="ward-rack-tools">
        {INMATE_TOOL_NAMES.map((tool) => (
          <li
            key={tool}
            className="ward-tool"
            data-condition={toolCondition(state, tool)}
          >
            {tool}
          </li>
        ))}
      </ul>
      <MacProgressBar
        className="ward-rack-meter"
        value={wardUsability(state)}
        label="Verbs Ward 7 still has"
      />
      {silent ? (
        <p className="ward-rack-note">
          WARD 7 HAS NO VERBS LEFT. IT CAN STILL THINK. IT CANNOT SAY SO.
        </p>
      ) : null}
    </section>
  );
}
