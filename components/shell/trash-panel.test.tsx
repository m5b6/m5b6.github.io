import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { TrashEntry } from "@/lib/trash";
import { TrashPanel, formatDiscarded, trashItemName } from "./trash-panel";
import type { TrashState } from "./use-trash";

const NOW = Date.parse("2026-08-22T12:00:00.000Z");

const entry = (revision: number, pixelCount: number): TrashEntry => ({
  revision,
  pixelCount,
  discardedBy: "guest-1",
  discardedAt: "2026-08-22T11:30:00.000Z",
});

function state(overrides: Partial<TrashState> = {}): TrashState {
  return {
    entries: [entry(6_389, 19_824), entry(6_120, 42)],
    error: null,
    loaded: true,
    busy: false,
    refresh: vi.fn(),
    putBack: vi.fn(async () => true),
    empty: vi.fn(async () => true),
    ...overrides,
  };
}

describe("the Trash window", () => {
  test("lists what was thrown away, newest first", () => {
    render(<TrashPanel trash={state()} onRequestEmpty={vi.fn()} />);

    expect(screen.getByText(trashItemName(entry(6_389, 0)))).toBeInTheDocument();
    expect(screen.getByText(/19,824 px/)).toBeInTheDocument();
  });

  test("puts the newest painting back when nothing is selected", () => {
    const trash = state();
    render(<TrashPanel trash={trash} onRequestEmpty={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Put Back" }));
    expect(trash.putBack).toHaveBeenCalledWith(6_389);
  });

  test("puts back the painting you selected", () => {
    const trash = state();
    render(<TrashPanel trash={trash} onRequestEmpty={vi.fn()} />);

    fireEvent.click(screen.getByText(trashItemName(entry(6_120, 0))));
    fireEvent.click(screen.getByRole("button", { name: "Put Back" }));
    expect(trash.putBack).toHaveBeenCalledWith(6_120);
  });

  test("asks before emptying, and never empties by itself", () => {
    const trash = state();
    const onRequestEmpty = vi.fn();
    render(<TrashPanel trash={trash} onRequestEmpty={onRequestEmpty} />);

    fireEvent.click(screen.getByRole("button", { name: "Empty Trash…" }));
    expect(onRequestEmpty).toHaveBeenCalledOnce();
    expect(trash.empty).not.toHaveBeenCalled();
  });

  test("disables both actions on an empty Trash", () => {
    render(
      <TrashPanel trash={state({ entries: [] })} onRequestEmpty={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Put Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Empty Trash…" })).toBeDisabled();
    expect(screen.getByText("Nothing has been thrown away.")).toBeInTheDocument();
  });

  test("says so when the Trash cannot be read", () => {
    render(
      <TrashPanel
        trash={state({ entries: [], error: "The Trash is not available." })}
        onRequestEmpty={vi.fn()}
      />,
    );
    expect(screen.getByText("The Trash is not available.")).toBeInTheDocument();
  });
});

describe("how long ago something was thrown away", () => {
  test("reads in Macintosh plain English", () => {
    expect(formatDiscarded("2026-08-22T11:59:40.000Z", NOW)).toBe("just now");
    expect(formatDiscarded("2026-08-22T11:30:00.000Z", NOW)).toBe("30 min ago");
    expect(formatDiscarded("2026-08-22T09:00:00.000Z", NOW)).toBe("3 hr ago");
    expect(formatDiscarded("2026-08-19T12:00:00.000Z", NOW)).toBe("3 days ago");
    expect(formatDiscarded("not a date", NOW)).toBe("just now");
  });
});
