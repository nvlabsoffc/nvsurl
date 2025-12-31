import gistService from '../services/github.js';
import { generateSlug, validateSlug, validateUrl } from '../utils/slugGenerator.js';
import { ApiResponse } from '../utils/responseFormatter.js';
import { validateShortenRequest } from '../utils/validator.js';

// In-memory cache dengan TTL (Time To Live)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

let serverStartTime = Date.now();

const getUptime = () => {
  const uptime = Date.now() - serverStartTime;
  const hours = Math.floor(uptime / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

// GET / - Homepage
export const getHome = async (req, res) => {
  try {
    const stats = await gistService.getStats();
    res.render('index', {
      title: 'NVSURL - URL Shortener',
      stats: stats || { totalLinks: 0, totalClicks: 0 },
      domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`,
      error: null // Pastikan error didefinisikan
    });
  } catch (error) {
    console.error('Home error:', error);
    res.render('index', {
      title: 'NVSURL - URL Shortener',
      stats: { totalLinks: 0, totalClicks: 0 },
      domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`,
      error: 'Failed to load statistics'
    });
  }
};

// Helper untuk cache
const cache = {
  set: (key, value) => {
    memoryCache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  },
  
  get: (key) => {
    if (!memoryCache.has(key)) return null;
    
    const cached = memoryCache.get(key);
    const age = Date.now() - cached.timestamp;
    
    // Check if cache is expired
    if (age > CACHE_TTL) {
      memoryCache.delete(key);
      return null;
    }
    
    return cached.data;
  },
  
  delete: (key) => {
    memoryCache.delete(key);
  },
  
  clear: () => {
    memoryCache.clear();
  },
  
  stats: () => {
    return {
      size: memoryCache.size,
      ttl: CACHE_TTL / 1000 + ' seconds'
    };
  }
};

// GET /r/:slug - Redirect to URL
export const redirectToUrl = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Check cache first
    const cachedLink = cache.get(slug);
    if (cachedLink) {
      // Update clicks async
      gistService.incrementClick(slug).catch(console.error);
      
      // Update cache
      cache.set(slug, {
        ...cachedLink,
        clicks: (cachedLink.clicks || 0) + 1
      });
      
      return res.redirect(301, cachedLink.originalUrl);
    }

    // Get from Gist
    const link = await gistService.getLink(slug);
    if (!link) {
      return res.redirect('/?error=link-not-found');
    }

    // Update clicks
    const updatedLink = await gistService.incrementClick(slug);
    
    // Cache the link
    cache.set(slug, updatedLink || link);

    res.redirect(301, link.originalUrl);

  } catch (error) {
    console.error('Redirect error:', error);
    res.redirect('/?error=server-error');
  }
};

// POST /shorten - Create short URL
export const shortenUrl = async (req, res) => {
  try {
    const validation = validateShortenRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json(
        ApiResponse.error(validation.errors.join(', '))
      );
    }

    const { originalUrl, customSlug, title, description } = req.body;
    let slug = customSlug;

    // Generate slug if not provided
    if (!slug) {
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        slug = generateSlug();
        const existing = await gistService.getLink(slug);
        if (!existing) isUnique = true;
        attempts++;
      }
      
      if (!isUnique) {
        return res.status(500).json(
          ApiResponse.error('Failed to generate unique slug')
        );
      }
    } else {
      // Check if custom slug exists
      const existing = await gistService.getLink(slug);
      if (existing) {
        return res.status(409).json(
          ApiResponse.error('Slug already exists')
        );
      }
    }

    // Create link data
    const linkData = {
      originalUrl,
      slug,
      shortUrl: `${process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`}/r/${slug}`,
      clicks: 0,
      title: title || null,
      description: description || null,
      isActive: true,
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        createdVia: 'API'
      }
    };

    // Save to Gist
    const createdLink = await gistService.createLink(slug, linkData);
    
    // Cache the link
    cache.set(slug, createdLink);

    res.status(201).json(
      ApiResponse.success(createdLink, 'URL shortened successfully')
    );

  } catch (error) {
    console.error('Shorten error:', error);
    res.status(500).json(
      ApiResponse.error('Failed to shorten URL')
    );
  }
};

// GET /stats/:slug - Link statistics
export const getLinkStats = async (req, res) => {
  try {
    const { slug } = req.params;
    const link = await gistService.getLink(slug);
    
    if (!link) {
      return res.status(404).json(
        ApiResponse.error('Link not found')
      );
    }
    
    res.json(ApiResponse.success(link, 'Link statistics'));
    
  } catch (error) {
    console.error('Link stats error:', error);
    res.status(500).json(ApiResponse.error('Failed to get link stats'));
  }
};

// GET /delete.html - Delete page and action
export const deleteLink = async (req, res) => {
  const { slug } = req.query;
  
  // Jika slug tidak ada, tampilkan form input
  if (!slug) {
    return res.render('delete', {
      title: 'Delete URL - NVSURL',
      domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`
    });
  }
  
  try {
    const link = await gistService.getLink(slug);
    
    // Jika POST request, proses penghapusan
    if (req.method === 'POST') {
      if (!link) {
        // Jika ingin JSON response
        if (req.headers['content-type'] === 'application/json') {
          return res.status(404).json(
            ApiResponse.error('Link not found')
          );
        }
        
        return res.render('delete', {
          title: 'Delete URL - NVSURL',
          error: 'Link not found',
          slug,
          domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`
        });
      }
      
      // Delete the link
      const result = await gistService.deleteLink(slug);
      
      // Clear from ALL caches
      cache.delete(slug);
      gistService.clearSlugCache(slug);
      
      // Jika request JSON, kembalikan JSON
      if (req.headers['content-type'] === 'application/json') {
        return res.json(
          ApiResponse.success(
            { deletedSlug: slug, originalUrl: link.originalUrl },
            'Link deleted successfully'
          )
        );
      }
      
      // Jika form submission, render HTML
      return res.render('delete', {
        title: 'Delete URL - NVSURL',
        success: true,
        deletedSlug: slug,
        originalUrl: link.originalUrl,
        domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`
      });
    }
    
    // GET request - tampilkan halaman konfirmasi
    res.render('delete', {
      title: 'Delete URL - NVSURL',
      slug,
      link: link || null,
      domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.render('delete', {
      title: 'Delete URL - NVSURL',
      error: 'Failed to process deletion',
      slug,
      domain: process.env.APP_DOMAIN || `http://localhost:${process.env.PORT || 3000}`
    });
  }
};

// GET /stats - Global statistics
export const getGlobalStats = async (req, res) => {
  try {
    const stats = await gistService.getStats();
    const memoryUsage = process.memoryUsage();
    const cacheStats = cache.stats();
    const gistCacheStats = gistService.getCacheStats();
    
    const responseData = {
      ...stats,
      server: {
        uptime: getUptime(),
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100
        },
        cache: {
          memoryCache: cacheStats,
          gistCache: gistCacheStats
        },
        nodeVersion: process.version
      },
      rateLimit: {
        maxPerHour: process.env.MAX_REQUESTS_PER_HOUR || 35
      }
    };

    res.json(ApiResponse.success(responseData, 'Global statistics'));

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json(ApiResponse.error('Failed to get statistics'));
  }
};

// GET /health - Health check
export const healthCheck = async (req, res) => {
  try {
    const stats = await gistService.getStats();
    const cacheStats = cache.stats();
    
    const healthData = {
      status: 'healthy',
      uptime: getUptime(),
      gist: {
        connected: true,
        totalLinks: stats.totalLinks,
        totalClicks: stats.totalClicks
      },
      cache: cacheStats,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100
      }
    };

    res.json(ApiResponse.success(healthData, 'Server is healthy'));

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json(
      ApiResponse.error('Service unhealthy - Gist connection failed', 'SERVICE_UNHEALTHY')
    );
  }
};

// GET /clear-cache - Clear all cache (admin endpoint)
export const clearCache = async (req, res) => {
  const { adminKey } = req.query;
  
  // Simple admin authentication
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json(
      ApiResponse.error('Unauthorized', 'UNAUTHORIZED')
    );
  }
  
  try {
    // Clear all caches
    cache.clear();
    gistService.clearCache();
    
    res.json(
      ApiResponse.success(
        { clearedAt: new Date().toISOString() },
        'All caches cleared successfully'
      )
    );
    
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json(ApiResponse.error('Failed to clear cache'));
  }
};

// GET /linkdata - Admin only (all links data)
export const getAllLinkData = async (req, res) => {
  const { adminKey } = req.query;
  
  // Simple admin authentication
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json(
      ApiResponse.error('Unauthorized', 'UNAUTHORIZED')
    );
  }
  
  try {
    const links = await gistService.getAllLinks();
    const stats = await gistService.getStats();
    
    const responseData = {
      links,
      stats,
      metadata: {
        totalLinks: Object.keys(links).length,
        exportTime: new Date().toISOString()
      }
    };
    
    res.json(ApiResponse.success(responseData, 'All link data retrieved'));
    
  } catch (error) {
    console.error('Get all links error:', error);
    res.status(500).json(ApiResponse.error('Failed to retrieve link data'));
  }
};
