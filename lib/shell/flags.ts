export const SHELL_FLAG = "SHELL_ENABLED";

export const SHELL_OFF = "0";

export function isShellEnabled(value: string | undefined): boolean {
  return value?.trim() !== SHELL_OFF;
}

export function shellEnabled(): boolean {
  return isShellEnabled(process.env[SHELL_FLAG]);
}
