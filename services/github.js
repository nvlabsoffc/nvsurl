import axios from 'axios';

export class GistService {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.username = process.env.GITHUB_USERNAME;
    this.gistId = process.env.GIST_ID;
    this.gistName = process.env.GIST_NAME || 'links.json';
    
    this.api = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NVSURL-Shortener'
      },
      timeout: 10000
    });
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 5 menit
    this.lastCacheClear = Date.now();
  }

  async initialize() {
    if (!this.gistId) {
      try {
        const response = await this.api.post('/gists', {
          description: 'URL Shortener Database',
          public: false,
          files: {
            [this.gistName]: {
              content: JSON.stringify({
                links: {},
                createdAt: new Date().toISOString(),
                version: '1.0'
              }, null, 2)
            }
          }
        });
        
        this.gistId = response.data.id;
        console.log(`✅ Gist created: ${this.gistId}`);
        return response.data;
      } catch (error) {
        console.error('❌ Failed to create Gist:', error.message);
        throw error;
      }
    }
    
    try {
      await this.api.get(`/gists/${this.gistId}`);
      console.log(`✅ Using existing Gist: ${this.gistId}`);
    } catch (error) {
      console.error('❌ Gist not found. Creating new one...');
      this.gistId = null;
      return await this.initialize();
    }
  }

  async readData() {
    try {
      const response = await this.api.get(`/gists/${this.gistId}`);
      const file = response.data.files[this.gistName];
      if (!file) throw new Error('Gist file not found');
      return JSON.parse(file.content);
    } catch (error) {
      console.error('Error reading Gist:', error.message);
      return { links: {}, createdAt: new Date().toISOString() };
    }
  }

  async writeData(data) {
    try {
      await this.api.patch(`/gists/${this.gistId}`, {
        description: `URL Shortener (${Object.keys(data.links || {}).length} links)`,
        files: {
          [this.gistName]: {
            content: JSON.stringify({
              ...data,
              updatedAt: new Date().toISOString(),
              totalLinks: Object.keys(data.links || {}).length
            }, null, 2)
          }
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Error writing to Gist:', error.message);
      throw error;
    }
  }

  async createLink(slug, linkData) {
    const data = await this.readData();
    if (!data.links) data.links = {};
    
    data.links[slug] = {
      ...linkData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await this.writeData(data);
    return data.links[slug];
  }

  async getLink(slug) {
    const data = await this.readData();
    return data.links?.[slug] || null;
  }

  async deleteLink(slug) {
    const data = await this.readData();
    
    if (data.links && data.links[slug]) {
      delete data.links[slug];
      await this.writeData(data);
      return { success: true, deletedSlug: slug };
    }
    
    return { success: false, message: 'Link not found' };
  }

  async getAllLinks() {
    const data = await this.readData();
    return data.links || {};
  }

  async getStats() {
    const data = await this.readData();
    const links = data.links || {};
    
    return {
      totalLinks: Object.keys(links).length,
      totalClicks: Object.values(links).reduce((sum, link) => sum + (link.clicks || 0), 0),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async incrementClick(slug) {
    const link = await this.getLink(slug);
    if (!link) return null;
    
    link.clicks = (link.clicks || 0) + 1;
    link.lastAccessed = new Date().toISOString();
    
    const data = await this.readData();
    data.links[slug] = link;
    await this.writeData(data);
    
    return link;
  }

  async getLink(slug) {
    // Check cache first
    if (this.cache.has(slug)) {
      const cached = this.cache.get(slug);
      // Check if cache is still valid (less than 5 minutes old)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
      // Cache expired, remove it
      this.cache.delete(slug);
    }
    
    const data = await this.readData();
    const link = data.links?.[slug] || null;
    
    // Cache the result
    if (link) {
      this.cache.set(slug, {
        data: link,
        timestamp: Date.now()
      });
    }
    
    return link;
  }
  
  async deleteLink(slug) {
    const data = await this.readData();
    
    if (data.links && data.links[slug]) {
      delete data.links[slug];
      await this.writeData(data);
      
      // Clear from cache
      this.cache.delete(slug);
      
      return { success: true, deletedSlug: slug };
    }
    
    return { success: false, message: 'Link not found' };
  }
  
  // Clear all cache
  clearCache() {
    this.cache.clear();
    this.lastCacheClear = Date.now();
    console.log('🧹 Cache cleared');
  }
  
  // Clear cache for specific slug
  clearSlugCache(slug) {
    this.cache.delete(slug);
  }
  
  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      lastClear: new Date(this.lastCacheClear).toISOString(),
      timeout: this.cacheTimeout / 1000 + ' seconds'
    };
  }
}

// Singleton instance
const gistService = new GistService();
export default gistService;
