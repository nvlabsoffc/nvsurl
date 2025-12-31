import rateLimit from 'express-rate-limit';

const maxRequests = parseInt(process.env.MAX_REQUESTS_PER_HOUR) || 35;

export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: maxRequests,
  message: {
    success: false,
    message: `Too many requests. Maximum ${maxRequests} requests per hour.`
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const createLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many link creation attempts. Please wait 15 minutes.'
  }
});
