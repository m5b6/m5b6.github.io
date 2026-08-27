import { inmateName } from "@/lib/asylum/cast";
import {
  findInmate,
  type Inmate,
  type WardState,
} from "@/lib/asylum/world";
import { InmateFace } from "./inmate-face";

function whisperNote(inmate: Inmate) {
  if (inmate.whispers <= 0) return "OUT OF WHISPERS";
  return inmate.whispers === 1 ? "1 WHISPER LEFT" : `${inmate.whispers} WHISPERS LEFT`;
}

function Soul({ inmate }: { inmate: Inmate }) {
  return (
    <li className="ward-soul">
      <InmateFace spec={inmate.face} size={28} />
      <span className="ward-soul-name">{inmateName(inmate.id)}</span>
      <span className="ward-soul-note">{whisperNote(inmate)}</span>
    </li>
  );
}

/**
 * Requirement three. Heaven has one slot and the next arrival erases whoever is
 * standing in it; the Trash keeps everybody until somebody empties it, and the
 * dead spend what is left of themselves whispering to the living.
 */
export function Afterlife({ state }: { state: WardState }) {
  const blessed = state.clipboard === null ? null : findInmate(state, state.clipboard);
  const damned = state.trash
    .map((id) => findInmate(state, id))
    .filter((inmate): inmate is Inmate => inmate !== null);

  return (
    <section className="ward-afterlife">
      <div className="ward-slot" data-slot="clipboard">
        <h3 className="ward-heading">
          THE CLIPBOARD
          <span className="ward-heading-note">HOLDS ONE</span>
        </h3>
        {blessed ? (
          <ul className="ward-souls">
            <Soul inmate={blessed} />
          </ul>
        ) : (
          <p className="ward-slot-empty">EMPTY. THE NEXT GOOD DEATH TAKES IT.</p>
        )}
      </div>

      <div className="ward-slot" data-slot="trash">
        <h3 className="ward-heading">
          THE TRASH
          <span className="ward-heading-note">
            {state.trashEmptied > 0
              ? `EMPTIED ${state.trashEmptied}×`
              : "NEVER EMPTIED"}
          </span>
        </h3>
        {damned.length > 0 ? (
          <ul className="ward-souls">
            {damned.map((inmate) => (
              <Soul key={inmate.id} inmate={inmate} />
            ))}
          </ul>
        ) : (
          <p className="ward-slot-empty">EMPTY. NOBODY HAS EARNED IT YET.</p>
        )}
      </div>
    </section>
  );
}
