import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { APPLE_MENU_ID, ShellMenuBar, type ShellMenuModel } from "./shell-menu-bar";
import { formatClock } from "./shell-clock";

function menus(onSelect = vi.fn()): ShellMenuModel[] {
  return [
    {
      id: APPLE_MENU_ID,
      title: "Apple",
      label: "Apple",
      entries: [
        { kind: "item", id: "about", label: "About This Macintosh…", onSelect },
        { kind: "separator", id: "sep" },
        { kind: "item", id: "asylum", label: "The Asylum", disabled: true },
      ],
    },
    {
      id: "file",
      title: "File",
      entries: [
        { kind: "item", id: "open", label: "Open Trash", onSelect },
        { kind: "item", id: "put", label: "Put Back", onSelect },
      ],
    },
    { id: "special", title: "Special", entries: [{ kind: "item", id: "empty", label: "Empty Trash…", onSelect }] },
  ];
}

function Harness({ onSelect }: { onSelect?: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ShellMenuBar
      menus={menus(onSelect ? vi.fn(onSelect) : undefined)}
      openId={openId}
      onOpenChange={setOpenId}
      clock={<span>Sat 10:30 AM</span>}
    />
  );
}

function title(name: string) {
  return screen
    .getAllByRole("button", { name })
    .find((button) => button.classList.contains("mac-menu-title"))!;
}

describe("the screen menu bar", () => {
  test("opens on click and closes on a second click", () => {
    render(<Harness />);
    const apple = title("Apple");

    expect(apple).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(apple);
    expect(apple).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(apple);
    expect(apple).toHaveAttribute("aria-expanded", "false");
  });

  test("does not open on hover, the way a Macintosh never did", () => {
    render(<Harness />);
    fireEvent.pointerEnter(title("File").closest("li")!);
    expect(title("File")).toHaveAttribute("aria-expanded", "false");
  });

  test("switches menus on hover once one is already open", () => {
    render(<Harness />);
    fireEvent.click(title("Apple"));
    fireEvent.pointerEnter(title("File").closest("li")!);
    expect(title("File")).toHaveAttribute("aria-expanded", "true");
    expect(title("Apple")).toHaveAttribute("aria-expanded", "false");
  });

  test("walks the bar with the arrow keys", () => {
    render(<Harness />);
    const apple = title("Apple");
    apple.focus();

    fireEvent.keyDown(apple, { key: "ArrowRight" });
    expect(document.activeElement).toBe(title("File"));

    fireEvent.keyDown(title("File"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(apple);
  });

  test("opens the focused menu with ArrowDown and closes it with Escape", () => {
    render(<Harness />);
    const file = title("File");
    file.focus();

    fireEvent.keyDown(file, { key: "ArrowDown" });
    expect(file).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(file, { key: "Escape" });
    expect(file).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(file);
  });

  test("moves between the items of an open menu", () => {
    render(<Harness />);
    fireEvent.click(title("File"));
    const items = screen
      .getAllByRole("button")
      .filter((button) => button.closest('[role="menu"]'))
      .filter((button) => /Open Trash|Put Back/.test(button.textContent ?? ""));

    items[0].focus();
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(title("File"));
  });

  test("closes the menu after an item is chosen", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.click(title("Special"));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Empty Trash…" })
        .find((button) => button.closest('[role="menu"]'))!,
    );

    expect(onSelect).toHaveBeenCalledOnce();
    expect(title("Special")).toHaveAttribute("aria-expanded", "false");
  });

  test("skips a disabled item when arrowing through a menu", () => {
    render(<Harness />);
    fireEvent.click(title("Apple"));
    const about = screen
      .getAllByRole("button", { name: "About This Macintosh…" })
      .find((button) => button.closest('[role="menu"]'))!;

    about.focus();
    fireEvent.keyDown(about, { key: "ArrowDown" });
    expect(document.activeElement).toBe(about);
  });

  test("carries a clock on the right", () => {
    render(<Harness />);
    expect(screen.getByText("Sat 10:30 AM")).toBeInTheDocument();
    expect(document.querySelector(".shell-menu-spacer")).not.toBeNull();
  });
});

describe("the menu bar clock", () => {
  test("reads the Macintosh way", () => {
    const label = formatClock(new Date("2026-08-22T15:04:00Z"), "en-US");
    expect(label).toMatch(/^[A-Z][a-z]{2},? \d{1,2}:\d{2}\s?(AM|PM)$/);
  });
});
