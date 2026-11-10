import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory rate limiting map keyed by IP address
const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((value, key) => {
    if (value.resetTime <= now) {
      rateLimitMap.delete(key);
    }
  });
}, 5 * 60 * 1000);

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Checks if a request exceeds rate limits.
 * Returns null if allowed, or a 429 NextResponse if rate limit is exceeded.
 */
export function enforceRateLimit(
  req: NextRequest, 
  maxRequests: number = 60, 
  windowMs: number = 60 * 1000
): NextResponse | null {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || record.resetTime <= now) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs
    });
    return null;
  }

  record.count += 1;

  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: 'Terlalu banyak permintaan (Rate limit exceeded). Silakan coba lagi beberapa saat.',
        retryAfterSeconds: retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter)
        }
      }
    );
  }

  return null;
}
