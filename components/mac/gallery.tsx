"use client";

import { useState } from "react";
import {
  MAC_ICON_NAMES,
  MacAlert,
  MacAppleIcon,
  MacButton,
  MacCheckbox,
  MacDesktop,
  MacDesktopIcon,
  MacDesktopIcons,
  MacDesktopSurface,
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
} from "./index";

const SAMPLE_LINES = [
  "System 6.0.8",
  "Chicago 12 is the interface face.",
  "Geneva 9 is the label face.",
  "Monaco is the monospaced face.",
  "Every border is one hard pixel.",
  "Nothing is rounded. Nothing glows.",
];

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gallery-row">
      <h3 className="gallery-heading">{title}</h3>
      <div className="gallery-items">{children}</div>
    </section>
  );
}

export function MacGallery() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [checked, setChecked] = useState(true);
  const [choice, setChoice] = useState("fat-bits");
  const [selectedIcon, setSelectedIcon] = useState("canvas");
  const [alertOpen, setAlertOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggle = (id: string) => setOpenMenu((current) => (current === id ? null : id));

  return (
    <div className="gallery">
      <MacMenuBar>
        <MacMenu
          title={<MacAppleIcon />}
          label="Apple"
          open={openMenu === "apple"}
          onToggle={() => toggle("apple")}
          onPointerEnter={() => openMenu && setOpenMenu("apple")}
        >
          <MacMenuItem label="About This Macintosh…" onSelect={() => setOpenMenu(null)} />
          <MacMenuSeparator />
          <MacMenuItem label="Control Panels" onSelect={() => setOpenMenu(null)} />
          <MacMenuItem label="Chooser" disabled />
        </MacMenu>
        <MacMenu
          title="File"
          open={openMenu === "file"}
          onToggle={() => toggle("file")}
          onPointerEnter={() => openMenu && setOpenMenu("file")}
        >
          <MacMenuItem label="New" shortcut="⌘N" onSelect={() => setOpenMenu(null)} />
          <MacMenuItem label="Open…" shortcut="⌘O" onSelect={() => setOpenMenu(null)} />
          <MacMenuSeparator />
          <MacMenuItem label="Close" shortcut="⌘W" disabled />
          <MacMenuItem label="Quit" shortcut="⌘Q" onSelect={() => setOpenMenu(null)} />
        </MacMenu>
        <MacMenu
          title="Edit"
          open={openMenu === "edit"}
          onToggle={() => toggle("edit")}
          onPointerEnter={() => openMenu && setOpenMenu("edit")}
        >
          <MacMenuItem label="Undo" shortcut="⌘Z" onSelect={() => setOpenMenu(null)} />
          <MacMenuSeparator />
          <MacMenuItem label="Cut" shortcut="⌘X" disabled />
          <MacMenuItem label="Copy" shortcut="⌘C" disabled />
          <MacMenuItem label="Fat Bits" shortcut="⌘F" checked onSelect={() => setOpenMenu(null)} />
        </MacMenu>
        <MacMenu title="Special" disabled open={false}>
          <MacMenuItem label="Restart" />
        </MacMenu>
      </MacMenuBar>

      <div className="gallery-body">
        <h1 className="gallery-title">Macintosh Component Library</h1>
        <p className="mac-text-small gallery-note">
          Every control on this page is a component from components/mac. Nothing here is a raw
          HTML control and nothing here names a colour.
        </p>

        <Row title="Windows">
          <div className="gallery-stage">
            <MacWindow
              title="Shared Paint"
              className="gallery-window"
              style={{ top: 10, left: 10, width: 280, height: 190 }}
              onClose={() => undefined}
              onCollapse={() => setCollapsed((value) => !value)}
              onZoom={() => undefined}
              collapsed={collapsed}
              dragHandleProps={{}}
              resizeHandleProps={{}}
              status={
                <>
                  <span>19,842 pixels</span>
                  <span>3 painters</span>
                </>
              }
            >
              <MacWindowPane>
                {SAMPLE_LINES.slice(0, 3).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </MacWindowPane>
            </MacWindow>

            <MacWindow
              title="Inactive Window"
              className="gallery-window"
              style={{ top: 40, left: 310, width: 250, height: 150 }}
              active={false}
              onClose={() => undefined}
              onCollapse={() => undefined}
              onZoom={() => undefined}
            >
              <MacWindowPane>
                <p className="mac-text-small">
                  System 7 hides the close and zoom boxes and drops the title-bar stripes when a
                  window loses focus.
                </p>
              </MacWindowPane>
            </MacWindow>

            <MacWindow
              title="Collapsed"
              className="gallery-window"
              style={{ top: 210, left: 10, width: 280 }}
              collapsed
              onClose={() => undefined}
              onCollapse={() => undefined}
              onZoom={() => undefined}
            >
              <MacWindowPane>Hidden while collapsed.</MacWindowPane>
            </MacWindow>
          </div>
        </Row>

        <Row title="Buttons">
          <MacButton onClick={() => undefined}>Cancel</MacButton>
          <MacButton variant="default" onClick={() => undefined}>
            OK
          </MacButton>
          <MacButton disabled>Disabled</MacButton>
        </Row>

        <Row title="Choices">
          <MacCheckbox
            label="Show Fat Bits"
            checked={checked}
            onChange={(event) => setChecked(event.currentTarget.checked)}
          />
          <MacCheckbox label="Disabled option" disabled />
          <MacRadio
            label="Fat Bits"
            name="gallery-tool"
            checked={choice === "fat-bits"}
            onChange={() => setChoice("fat-bits")}
          />
          <MacRadio
            label="Brush"
            name="gallery-tool"
            checked={choice === "brush"}
            onChange={() => setChoice("brush")}
          />
        </Row>

        <Row title="Fields">
          <div className="gallery-fields">
            <MacField label="Name" defaultValue="Matias" />
            <MacField label="Colour" defaultValue="black" hint="Palette names only." />
            <MacField label="Notes" stacked defaultValue="Stacked field row" />
            <MacFieldRow>
              <span className="mac-field-label">Brush</span>
              <MacButton>Smaller</MacButton>
              <MacButton>Larger</MacButton>
            </MacFieldRow>
          </div>
        </Row>

        <Row title="Progress">
          <div className="gallery-fields">
            <MacProgressBar label="Loading pixels" value={0.35} />
            <MacProgressBar label="Working" indeterminate />
          </div>
        </Row>

        <Row title="Separator and status bar">
          <div className="gallery-fields">
            <span className="mac-text-small">Above the rule</span>
            <MacSeparator />
            <span className="mac-text-small">Below the rule</span>
            <MacStatusBar>
              <span>320 x 180</span>
              <span>1-bit</span>
            </MacStatusBar>
          </div>
        </Row>

        <Row title="Scroll area and text styles">
          <MacScrollArea framed className="gallery-scroll">
            {[...SAMPLE_LINES, ...SAMPLE_LINES].map((line, index) => (
              <p key={`${line}-${index}`} className="mac-text-technical">
                {line}
              </p>
            ))}
          </MacScrollArea>
          <div className="gallery-fields">
            <p>mac-text-base is Chicago 12.</p>
            <p className="mac-text-small">mac-text-small is Geneva 9.</p>
            <p className="mac-text-technical">mac-text-technical 0123 illl MMMM</p>
            <p className="mac-text-mono">mac-text-mono 0123 illl MMMM</p>
          </div>
        </Row>

        <Row title="Desktop">
          <div className="gallery-desktop">
            <MacDesktop pattern="dither">
              <MacMenuBar>
                <MacMenu title={<MacAppleIcon />} label="Apple">
                  <MacMenuItem label="About This Macintosh…" />
                </MacMenu>
                <MacMenu title="File">
                  <MacMenuItem label="New" shortcut="⌘N" />
                </MacMenu>
              </MacMenuBar>
              <MacDesktopSurface>
                <MacDesktopIcons>
                  <MacDesktopIcon icon="canvas" label="Shared Paint" selected />
                  <MacDesktopIcon icon="ward" label="The Asylum" />
                </MacDesktopIcons>
                <MacWindow
                  title="Shared Paint"
                  className="gallery-window"
                  style={{ top: 40, left: 24, width: 240, height: 130 }}
                  onClose={() => undefined}
                  onCollapse={() => undefined}
                  onZoom={() => undefined}
                >
                  <MacWindowPane>
                    <p className="mac-text-small">
                      One desktop, one menu bar, no dock. A collapsed window stays here as a
                      title bar.
                    </p>
                  </MacWindowPane>
                </MacWindow>
              </MacDesktopSurface>
            </MacDesktop>
          </div>
        </Row>

        <Row title="Desktop icons">
          <MacDesktopIcon
            icon="canvas"
            label="Shared Paint"
            selected={selectedIcon === "canvas"}
            onSelect={() => setSelectedIcon("canvas")}
          />
          <MacDesktopIcon
            icon="ward"
            label="The Asylum"
            selected={selectedIcon === "ward"}
            onSelect={() => setSelectedIcon("ward")}
          />
          <MacDesktopIcon
            icon="folder"
            label="Projects"
            selected={selectedIcon === "folder"}
            onSelect={() => setSelectedIcon("folder")}
          />
          <MacDesktopIcon
            icon="document"
            label="Read Me"
            selected={selectedIcon === "document"}
            onSelect={() => setSelectedIcon("document")}
          />
        </Row>

        <Row title="Icon set">
          {MAC_ICON_NAMES.map((name) => (
            <figure key={name} className="gallery-icon">
              <MacIcon name={name} title={name} />
              <figcaption className="mac-text-small">{name}</figcaption>
            </figure>
          ))}
        </Row>

        <Row title="Dialogs">
          <MacButton onClick={() => setAlertOpen(true)}>Show Alert</MacButton>
          <MacButton onClick={() => setDialogOpen(true)}>Show Dialog</MacButton>
        </Row>

        <Row title="Alert wells">
          <div className="gallery-alerts">
            {(["stop", "caution", "note"] as const).map((kind) => (
              <div key={kind} className="standard-dialog alert-box mac-dialog gallery-alert">
                <div className="alert-contents mac-dialog-body">
                  <MacIcon name={kind} className="mac-dialog-well" title={`${kind} alert`} />
                  <div className="mac-dialog-message">
                    The {kind} well. Chicago 12, one hard pixel of border, no rounding.
                  </div>
                </div>
                <div className="mac-dialog-actions">
                  <MacButton>Cancel</MacButton>
                  <MacButton variant="default">OK</MacButton>
                </div>
              </div>
            ))}
          </div>
        </Row>
      </div>

      <MacAlert
        open={alertOpen}
        kind="caution"
        label="Clear the canvas"
        actions={
          <>
            <MacButton onClick={() => setAlertOpen(false)}>Cancel</MacButton>
            <MacButton variant="default" onClick={() => setAlertOpen(false)}>
              Clear
            </MacButton>
          </>
        }
      >
        Clearing the canvas throws away 19,842 painted pixels. This cannot be undone.
      </MacAlert>

      <MacDialog
        open={dialogOpen}
        label="Preferences"
        actions={
          <>
            <MacButton onClick={() => setDialogOpen(false)}>Cancel</MacButton>
            <MacButton variant="default" onClick={() => setDialogOpen(false)}>
              OK
            </MacButton>
          </>
        }
      >
        <MacField label="Painter" defaultValue="anonymous" stacked />
        <MacCheckbox label="Show other cursors" defaultChecked />
      </MacDialog>
    </div>
  );
}
