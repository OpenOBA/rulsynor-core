/**
 * logger — lightweight structured logger (zero-dependency, replaces rulsynor's RulsynorLogger)
 *
 * Interface compatible with rulsynor RulsynorLogger (debug/verbose/log/warn/error),
 * but drops the @nestjs/common LoggerService dependency and AsyncLocalStorage trace context,
 * keeping core zero-dependency (only node built-in process + JSON).
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-21 (M2 stripped rulsynor-logger dependency)
 * @license MIT
 */

type LogLevel = 'debug' | 'verbose' | 'log' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  verbose: 1,
  log: 2,
  warn: 3,
  error: 4,
};

export class RulsynorLogger {
  private readonly context: string;

  constructor(context?: string) {
    this.context = context ?? 'Rulsynor';
  }

  debug(message: string, meta?: unknown): void {
    this.write('debug', message, meta);
  }

  verbose(message: string, meta?: unknown): void {
    this.write('verbose', message, meta);
  }

  log(message: string, meta?: unknown): void {
    this.write('log', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const minLevel = process.env['LOG_LEVEL'] as LogLevel | undefined;
    if (minLevel && (LOG_LEVELS[level] ?? 2) < (LOG_LEVELS[minLevel] ?? 2)) {
      return;
    }
    const entry: Record<string, unknown> = {
      t: new Date().toISOString(),
      l: level,
      c: this.context,
      m: message,
    };
    if (meta !== undefined) entry.extra = meta;
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
