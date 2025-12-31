import express from 'express';
import {
  getHome,
  shortenUrl,
  redirectToUrl,
  getGlobalStats,
  getLinkStats,
  healthCheck,
  deleteLink,
  getAllLinkData,
  clearCache // Tambah ini
} from '../controllers/linkController.js';
import { apiLimiter, createLinkLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply rate limiting to all API routes
router.use('/shorten', apiLimiter);
router.use('/stats', apiLimiter);
router.use('/health', apiLimiter);
router.use('/delete.html', apiLimiter);

// Web Pages
router.get('/', getHome);
router.get('/delete.html', deleteLink);
router.post('/delete.html', deleteLink);

// API Endpoints
router.post('/shorten', createLinkLimiter, shortenUrl);
router.get('/stats', getGlobalStats);
router.get('/stats/:slug', getLinkStats);
router.get('/health', healthCheck);
router.get('/linkdata', getAllLinkData);
router.get('/clear-cache', clearCache); // Tambah ini

// Redirect (must be last)
router.get('/r/:slug', redirectToUrl);

export default router;
