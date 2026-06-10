export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: 'fixed' | 'linear' | 'exponential';
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const computeDelay = (
  base: number,
  attempt: number,
  backoff: NonNullable<RetryOptions['backoff']>,
): number => {
  switch (backoff) {
    case 'linear':
      return base * attempt;
    case 'exponential':
      return base * Math.pow(2, attempt - 1);
    case 'fixed':
    default:
      return base;
  }
};

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 200;
  const backoff = opts.backoff ?? 'exponential';

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLast = attempt === attempts;
      const shouldRetry = opts.shouldRetry ? opts.shouldRetry(error, attempt) : true;
      if (isLast || !shouldRetry) break;
      await sleep(computeDelay(delayMs, attempt, backoff));
    }
  }
  throw lastError;
}

export async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  opts: { timeoutMs?: number; intervalMs?: number; message?: string } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const intervalMs = opts.intervalMs ?? 250;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(opts.message ?? `condition not met within ${timeoutMs}ms`);
}
