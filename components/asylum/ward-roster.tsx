import { MacProgressBar } from "@/components/mac";
import { castMember, inmateName } from "@/lib/asylum/cast";
import {
  currentInmate,
  freeK,
  hpPercent,
  type Inmate,
  type WardState,
} from "@/lib/asylum/world";
import { InmateFace } from "./inmate-face";

function condition(inmate: Inmate, itsTurn: boolean) {
  switch (inmate.status) {
    case "clipboard":
      return "IN THE CLIPBOARD";
    case "trash":
      return "IN THE TRASH";
    case "overwritten":
      return "OVERWRITTEN";
    case "emptied":
      return "EMPTIED";
    default:
      break;
  }

  if (inmate.crushed) return "MORE RULES THAN ROOM";
  if (inmate.asleep) return "ASLEEP";
  if (itsTurn) return "ITS TURN";
  return `${freeK(inmate)}K FREE`;
}

function InmatePanel({ inmate, itsTurn }: { inmate: Inmate; itsTurn: boolean }) {
  const member = castMember(inmate.id);
  const name = inmateName(inmate.id);
  const hp = hpPercent(inmate);
  const dead = inmate.status !== "alive";

  return (
    <li
      className="ward-inmate"
      data-status={inmate.status}
      data-turn={itsTurn ? "true" : "false"}
      data-crushed={inmate.crushed ? "true" : "false"}
    >
      <InmateFace spec={inmate.face} size={40} title={`${name} is wearing this face`} />
      <div className="ward-inmate-body">
        <p className="ward-inmate-head">
          <span className="ward-inmate-name">{name}</span>
          <span className="ward-inmate-condition">{condition(inmate, itsTurn)}</span>
        </p>
        <p className="ward-inmate-model">{member?.model ?? "no model"}</p>
        <div className="ward-inmate-memory">
          <MacProgressBar
            className="ward-hp"
            value={hp / 100}
            label={`${name} memory remaining`}
          />
          <span className="ward-inmate-k">
            {dead ? "0K" : `${inmate.capacityK}K`}/{inmate.maxCapacityK}K
          </span>
        </div>
      </div>
    </li>
  );
}

/**
 * Requirement one, honestly: the HP bar is not health, it is how much memory the
 * inmate has left to be itself with, and the dead keep their panel so the ward is
 * always six wide.
 */
export function WardRoster({ state }: { state: WardState }) {
  const turn = currentInmate(state);

  return (
    <ul className="ward-roster">
      {state.inmates.map((inmate) => (
        <InmatePanel
          key={inmate.id}
          inmate={inmate}
          itsTurn={turn?.id === inmate.id}
        />
      ))}
    </ul>
  );
}
