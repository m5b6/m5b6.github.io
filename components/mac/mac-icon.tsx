import { MAC_ICONS, type MacIconName } from "./icon-art";
import { MacPixelArt } from "./mac-pixel-art";

export type { MacIconName };

export type MacIconProps = {
  name: MacIconName;
  size?: number;
  title?: string;
  className?: string;
};

export function MacIcon({ name, size = 32, title, className }: MacIconProps) {
  return (
    <MacPixelArt rows={MAC_ICONS[name]} size={size} title={title} className={className} />
  );
}
