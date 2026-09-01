/**
 * logger — 轻量结构化日志器（零依赖，替代 rulsynor 的 RulsynorLogger）
 *
 * 接口与 rulsynor RulsynorLogger 兼容（debug/verbose/log/warn/error），
 * 但去掉 @nestjs/common 的 LoggerService 依赖与 AsyncLocalStorage trace context，
 * 保持 core 零依赖（仅 node 内置 process + JSON）。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-21（M2 剥离 rulsynor-logger 依赖）
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
