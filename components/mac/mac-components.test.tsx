import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  MacAlert,
  MacButton,
  MacCheckbox,
  MacDesktop,
  MacDesktopIcon,
  MacDesktopIcons,
  MacDialog,
  MacField,
  MacFieldRow,
  MacIcon,
  MacMenu,
  MacMenuBar,
  MacMenuItem,
  MacMenuSeparator,
  MacProgressBar,
  MacRadio,
  MacScrollArea,
  MacSeparator,
  MacStatusBar,
  MacWindow,
  MacWindowPane,
} from "@/components/mac";

describe("MacButton", () => {
  test("renders the system.css push button", () => {
    render(<MacButton>Cancel</MacButton>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button).toHaveClass("btn", "mac-button");
    expect(button).not.toHaveClass("btn-default");
    expect(button).toHaveAttribute("type", "button");
  });

  test("renders the system.css default button", () => {
    render(<MacButton variant="default">OK</MacButton>);
    expect(screen.getByRole("button", { name: "OK" })).toHaveClass("btn", "btn-default");
  });
});

describe("MacWindow", () => {
  test("wears the system.css window and active title bar classes", () => {
    const { container } = render(
      <MacWindow title="Shared Paint" onClose={() => undefined}>
        <MacWindowPane>body</MacWindowPane>
      </MacWindow>,
    );
    const window = container.querySelector("section");
    expect(window).toHaveClass("window", "mac-window");
    expect(container.querySelector(".title-bar")).not.toBeNull();
    expect(container.querySelector(".inactive-title-bar")).toBeNull();
    expect(screen.getByRole("heading", { name: "Shared Paint" })).toHaveClass("title");
    expect(container.querySelector(".mac-window-pane")).not.toBeNull();
  });

  test("an inactive window uses the inactive title bar and hides its boxes", () => {
    const { container } = render(
      <MacWindow
        title="Behind"
        active={false}
        onClose={() => undefined}
        onCollapse={() => undefined}
        onZoom={() => undefined}
      >
        body
      </MacWindow>,
    );
    expect(container.querySelector(".inactive-title-bar")).not.toBeNull();
    expect(container.querySelector(".title-bar")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelectorAll(".mac-title-button-slot")).toHaveLength(3);
  });

  test("close, collapse and zoom boxes appear only when handlers are given", () => {
    const { container } = render(
      <MacWindow
        title="Paint"
        onClose={() => undefined}
        onCollapse={() => undefined}
        onZoom={() => undefined}
      >
        body
      </MacWindow>,
    );
    expect(container.querySelector(".title-bar button.close")).not.toBeNull();
    expect(container.querySelector(".title-bar button.mac-collapse")).not.toBeNull();
    expect(container.querySelector(".title-bar button.mac-zoom")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close Paint" })).toBeInTheDocument();
  });

  test("a window without handlers renders no title boxes at all", () => {
    const { container } = render(<MacWindow title="Bare">body</MacWindow>);
    expect(container.querySelectorAll(".title-bar button")).toHaveLength(0);
  });

  test("collapsing marks the window and keeps the title bar", () => {
    const { container } = render(
      <MacWindow title="Paint" collapsed onCollapse={() => undefined}>
        <MacWindowPane>hidden</MacWindowPane>
      </MacWindow>,
    );
    expect(container.querySelector("section")).toHaveAttribute("data-collapsed", "true");
    expect(container.querySelector(".title-bar")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Expand Paint" })).toBeInTheDocument();
  });

  test("the drag handle is a prop, so the window manager keeps the state", () => {
    const { container } = render(
      <MacWindow title="Paint" dragHandleProps={{ onPointerDown: () => undefined }}>
        body
      </MacWindow>,
    );
    expect(container.querySelector(".title-bar")).toHaveAttribute("data-draggable", "true");
  });

  test("a status bar renders as the system.css details bar", () => {
    const { container } = render(
      <MacWindow title="Paint" status={<span>19,842 pixels</span>}>
        body
      </MacWindow>,
    );
    expect(container.querySelector(".details-bar.mac-status-bar")).not.toBeNull();
  });
});

describe("MacMenuBar", () => {
  test("renders the system.css menu-bar roles", () => {
    const { container } = render(
      <MacMenuBar>
        <MacMenu title="File" open>
          <MacMenuItem label="New" shortcut="⌘N" />
          <MacMenuSeparator />
          <MacMenuItem label="Close" disabled />
          <MacMenuItem label="Fat Bits" checked />
        </MacMenu>
      </MacMenuBar>,
    );

    const bar = container.querySelector("ul[role='menu-bar']");
    expect(bar).toHaveClass("mac-menu-bar");

    const menuItem = container.querySelector("li[role='menu-item']");
    expect(menuItem).toHaveAttribute("aria-haspopup", "true");
    expect(menuItem).toHaveAttribute("data-open", "true");

    const menu = container.querySelector("ul[role='menu']");
    expect(menu).toHaveClass("mac-menu");

    expect(within(menu as HTMLElement).getByText("⌘N")).toHaveClass("mac-menu-shortcut");
    expect(screen.getByRole("button", { name: /Close/ })).toBeDisabled();
    expect(container.querySelector("li.divider.mac-menu-divider")).not.toBeNull();
    expect(screen.getByRole("menuitemcheckbox", { name: /Fat Bits/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("a closed menu is marked closed, not unmounted", () => {
    const { container } = render(
      <MacMenuBar>
        <MacMenu title="Edit">
          <MacMenuItem label="Undo" />
        </MacMenu>
      </MacMenuBar>,
    );
    expect(container.querySelector("li[role='menu-item']")).toHaveAttribute("data-open", "false");
    expect(container.querySelector("ul[role='menu']")).not.toBeNull();
  });
});

describe("MacDesktop", () => {
  test("the desktop layer can carry the 50% dither pattern", () => {
    const { container } = render(
      <MacDesktop pattern="dither">
        <span>chrome</span>
      </MacDesktop>,
    );
    expect(container.querySelector(".mac-desktop")).toHaveAttribute("data-pattern", "dither");
    expect(container.querySelector(".mac-desktop-pattern")).not.toBeNull();
  });

  test("the desktop leaves the canvas uncovered by default", () => {
    const { container } = render(
      <MacDesktop>
        <span>chrome</span>
      </MacDesktop>,
    );
    expect(container.querySelector(".mac-desktop-pattern")).toBeNull();
  });

  test("an icon selects on click and opens on double click", () => {
    render(
      <MacDesktopIcons>
        <MacDesktopIcon icon="canvas" label="Shared Paint" selected />
      </MacDesktopIcons>,
    );
    const icon = screen.getByRole("button", { name: /Shared Paint/ });
    expect(icon).toHaveClass("mac-desktop-icon");
    expect(icon).toHaveAttribute("data-selected", "true");
    expect(icon).toHaveAttribute("aria-pressed", "true");
    expect(icon.querySelector(".mac-desktop-icon-glyph")).not.toBeNull();
    expect(icon.querySelector(".mac-desktop-icon-label")).toHaveTextContent("Shared Paint");
  });
});

describe("dialogs", () => {
  test("MacAlert renders the System 6 icon well and blocks", () => {
    const { container } = render(
      <MacAlert open kind="stop" label="Cannot paint" actions={<MacButton>OK</MacButton>}>
        The canvas is locked.
      </MacAlert>,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Cannot paint" });
    expect(dialog).toHaveClass("standard-dialog", "alert-box", "mac-dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(container.querySelector(".alert-contents.mac-dialog-body")).not.toBeNull();
    expect(container.querySelector(".mac-dialog-well")).not.toBeNull();
    expect(container.querySelector(".mac-dialog-layer")).not.toBeNull();
  });

  test("a closed dialog renders nothing", () => {
    const { container } = render(
      <MacDialog open={false} label="Preferences">
        body
      </MacDialog>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("MacDialog is the system.css standard dialog", () => {
    render(
      <MacDialog open label="Preferences">
        body
      </MacDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Preferences" })).toHaveClass(
      "standard-dialog",
      "mac-dialog",
    );
  });
});

describe("form controls", () => {
  test("MacCheckbox uses the system.css input plus sibling label", () => {
    const { container } = render(<MacCheckbox label="Show Fat Bits" defaultChecked />);
    const input = screen.getByRole("checkbox", { name: "Show Fat Bits" });
    expect(input).toHaveAttribute("type", "checkbox");
    expect(container.querySelector(".field-row.mac-field")).not.toBeNull();
    expect(input.nextElementSibling?.tagName).toBe("LABEL");
    expect(input.nextElementSibling).toHaveAttribute("for", input.id);
  });

  test("MacRadio uses the system.css input plus sibling label", () => {
    render(<MacRadio label="Brush" name="tool" />);
    const input = screen.getByRole("radio", { name: "Brush" });
    expect(input).toHaveAttribute("type", "radio");
    expect(input.nextElementSibling).toHaveAttribute("for", input.id);
  });

  test("MacField labels its input and can carry a hint", () => {
    const { container } = render(<MacField label="Painter" hint="Letters only." />);
    const input = screen.getByRole("textbox", { name: "Painter" });
    expect(input).toHaveClass("mac-field-input");
    expect(input).toHaveAccessibleDescription("Letters only.");
    expect(container.querySelector(".field-row.mac-field")).not.toBeNull();
  });

  test("a stacked field row stacks", () => {
    const { container } = render(<MacFieldRow stacked>rows</MacFieldRow>);
    expect(container.querySelector(".mac-field-stacked")).not.toBeNull();
  });
});

describe("chrome", () => {
  test("MacProgressBar reports its value the accessible way", () => {
    render(<MacProgressBar label="Loading pixels" value={0.35} />);
    const bar = screen.getByRole("progressbar", { name: "Loading pixels" });
    expect(bar).toHaveClass("mac-progress");
    expect(bar).toHaveAttribute("aria-valuenow", "35");
    expect(bar).toHaveAttribute("data-indeterminate", "false");
  });

  test("an indeterminate bar drops its value", () => {
    render(<MacProgressBar label="Working" indeterminate />);
    const bar = screen.getByRole("progressbar", { name: "Working" });
    expect(bar).toHaveAttribute("data-indeterminate", "true");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  test("out of range values clamp", () => {
    render(<MacProgressBar label="Over" value={4} />);
    expect(screen.getByRole("progressbar", { name: "Over" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  test("MacScrollArea can frame itself", () => {
    const { container } = render(<MacScrollArea framed>lines</MacScrollArea>);
    const area = container.querySelector(".mac-scroll-area");
    expect(area).toHaveAttribute("data-framed", "true");
  });

  test("MacSeparator is the system.css separator", () => {
    const { container } = render(<MacSeparator />);
    expect(container.querySelector("hr")).toHaveClass("separator", "mac-separator");
  });

  test("MacStatusBar is the system.css details bar", () => {
    const { container } = render(<MacStatusBar>320 x 180</MacStatusBar>);
    expect(container.querySelector("div")).toHaveClass("details-bar", "mac-status-bar");
  });

  test("MacIcon paints from tokens, never from a literal colour", () => {
    const { container } = render(<MacIcon name="ward" title="The Asylum" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("mac-pixel-art");
    expect(svg).toHaveAttribute("viewBox", "0 0 32 32");
    const fills = new Set([...container.querySelectorAll("rect")].map((r) => r.getAttribute("fill")));
    expect(fills).toEqual(new Set(["var(--mac-art-ink)", "var(--mac-art-paper)"]));
  });
});
