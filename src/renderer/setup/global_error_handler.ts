import * as Sentry from '@sentry/react'
import { getLogger } from '../lib/utils'

const log = getLogger('GlobalErrorHandler')

// 检查是否为 ResizeObserver 无害错误
const isResizeObserverError = (message?: string): boolean => {
  if (!message) return false
  return (
    message.includes('ResizeObserver loop completed with undelivered notifications') ||
    message.includes('ResizeObserver loop limit exceeded')
  )
}

// 在最早阶段捕获 ResizeObserver 错误（捕获阶段）
window.addEventListener('error', (event) => {
  if (isResizeObserverError(event.message)) {
    event.stopImmediatePropagation()
    event.preventDefault()
    return false
  }
}, true) // 使用捕获阶段

// 拦截 webpack-dev-server 的错误处理
if (process.env.NODE_ENV === 'development') {
  // 覆盖 window.onerror 以在 webpack overlay 之前拦截
  const originalOnError = window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    if (typeof message === 'string' && isResizeObserverError(message)) {
      return true // 阻止错误传播
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error)
    }
    return false
  }
}

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  // 忽略 ResizeObserver 的无害错误
  if (isResizeObserverError(event.message)) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  log.error('Global error caught:', event.error)

  Sentry.withScope((scope) => {
    scope.setTag('errorType', 'global')
    scope.setLevel('error')
    scope.setContext('errorEvent', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      source: event.error?.stack || 'No stack trace available',
    })
    Sentry.captureException(event.error || new Error(event.message))
  })
})

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  log.error('Unhandled promise rejection:', event.reason)

  Sentry.withScope((scope) => {
    scope.setTag('errorType', 'unhandledRejection')
    scope.setLevel('error')
    scope.setContext('promiseRejection', {
      reason: event.reason,
      promise: event.promise?.toString() || 'Unknown promise',
    })

    const error =
      event.reason instanceof Error ? event.reason : new Error(`Unhandled promise rejection: ${event.reason}`)

    Sentry.captureException(error)
  })

  // Prevent the default behavior (console error)
  // event.preventDefault()
})

// Console error interceptor (optional, for additional logging)
const originalConsoleError = console.error
const reportedErrors = new WeakSet()
const reportedMessages = new Set<string>()

console.error = (...args: unknown[]) => {
  // 检查是否为 ResizeObserver 无害错误，直接忽略不打印
  const firstArg = args[0]
  if (typeof firstArg === 'string' && isResizeObserverError(firstArg)) {
    return // 完全抑制 ResizeObserver 错误
  }

  // Still call the original console.error
  originalConsoleError.apply(console, args)

  // Early exit for non-error cases
  if (args.length === 0) return

  // Check if any argument is an actual Error object
  const errorObjects = args.filter((arg) => arg instanceof Error)

  // If we have Error objects, use them for detection
  if (errorObjects.length > 0) {
    for (const error of errorObjects) {
      // Avoid duplicate reporting
      if (reportedErrors.has(error)) continue

      // Check if this is a genuine error type we care about
      if (
        error instanceof TypeError ||
        error instanceof ReferenceError ||
        error instanceof RangeError ||
        error instanceof EvalError ||
        error instanceof URIError
      ) {
        reportedErrors.add(error)

        log.error('Console error that might be uncaught:', error)

        Sentry.withScope((scope) => {
          scope.setTag('errorType', 'console')
          scope.setLevel('warning')
          scope.setContext('consoleError', {
            name: error.name,
            message: error.message,
            stack: error.stack,
          })
          Sentry.captureException(error)
        })
      }
    }
    return
  }

  // Fallback to string analysis for non-Error objects
  const errorMessage = args.join(' ')

  // Create a simple hash for duplicate detection
  const messageHash = errorMessage.substring(0, 100)
  if (reportedMessages.has(messageHash)) return

  // Only check string patterns if no Error objects were found
  if (
    errorMessage.includes('cannot read properties of undefined') ||
    errorMessage.includes('Cannot read property') ||
    errorMessage.includes('TypeError:') ||
    errorMessage.includes('ReferenceError:')
  ) {
    reportedMessages.add(messageHash)

    log.error('Console error that might be uncaught:', errorMessage)

    Sentry.withScope((scope) => {
      scope.setTag('errorType', 'console')
      scope.setLevel('warning')
      scope.setContext('consoleError', {
        message: errorMessage,
        args: args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))),
      })
      Sentry.captureMessage(errorMessage, 'warning')
    })
  }
}

log.info('Global error handlers initialized')
