import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import gistService from './services/github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5480;

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    
    if (res.statusCode >= 400) {
      console.error(`❌ ${logMessage}`);
    } else if (req.path.startsWith('/r/')) {
      console.log(`↗️  ${logMessage}`);
    } else if (req.path === '/delete.html') {
      console.log(`🗑️  ${logMessage} - Slug: ${req.query.slug || 'none'}`);
    } else if (req.path === '/shorten') {
      console.log(`🔗 ${logMessage}`);
    } else if (req.path === '/clear-cache') {
      console.log(`🧹 ${logMessage} - Cache cleared`);
    } else {
      console.log(`📄 ${logMessage}`);
    }
  });
  
  next();
});

// Routes
app.use('/', routes);

// 404 Handler - HARUS SETELAH SEMUA ROUTES
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).render('404', { 
    title: '404 Not Found',
    url: req.url,
    NODE_ENV: process.env.NODE_ENV || 'development'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  console.error(err.stack);
  
  res.status(500).render('500', {
    title: '500 Server Error',
    error: err.message,
    NODE_ENV: process.env.NODE_ENV || 'development'
  });
});

// Start Server
async function startServer() {
  try {
    // Initialize Gist
    await gistService.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Domain: ${process.env.APP_DOMAIN || `http://localhost:${PORT}`}`);
      console.log(`📊 Rate limit: ${process.env.MAX_REQUESTS_PER_HOUR || 100} requests/hour`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      console.log('\n📋 Available Endpoints:');
      console.log('══════════════════════════════════════════════════');
      console.log('  GET    /                    - Homepage');
      console.log('  POST   /shorten             - Create short URL');
      console.log('  GET    /r/:slug             - Redirect to URL');
      console.log('  GET    /stats               - Global statistics');
      console.log('  GET    /stats/:slug         - Link statistics');
      console.log('  GET    /health              - Health check');
      console.log('  GET    /delete.html?slug=   - Delete page');
      console.log('  POST   /delete.html?slug=   - Delete action');
      console.log('  GET    /linkdata?adminKey=  - All data (admin)');
      console.log('  GET    /clear-cache?adminKey= - Clear cache (admin)');
      console.log('══════════════════════════════════════════════════');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
