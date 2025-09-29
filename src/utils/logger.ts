export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SUCCESS = "SUCCESS",
}

export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString()
  }

  private static formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.formatTimestamp()
    const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : ""
    return `[${timestamp}] [${level}] ${message}${dataStr}`
  }

  static info(message: string, data?: any): void {
    console.log(this.formatMessage(LogLevel.INFO, message, data))
  }

  static warn(message: string, data?: any): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, data))
  }

  static error(message: string, error?: any): void {
    const errorData =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : error
    console.error(this.formatMessage(LogLevel.ERROR, message, errorData))
  }

  static success(message: string, data?: any): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message, data))
  }
}
