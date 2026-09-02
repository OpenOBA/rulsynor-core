/**
 * Shared CLI argument helpers.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

/** Parse `--name=value` or `--name value`. Returns undefined when absent. */
export function parseFlag(args: string[], name: string): string | undefined {
  const eq = args.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.substring(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

/** Dim text on a TTY; plain elsewhere (keeps piped output clean). */
export function dim(text: string): string {
  return process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;
}
