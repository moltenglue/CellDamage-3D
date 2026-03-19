import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    players: 0,
    matches: 0,
    serverTime: new Date().toISOString(),
  });
});

// Game stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalMatches: 0,
    activeMatches: 0,
    totalPlayers: 0,
    onlinePlayers: 0,
  });
});

// Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  
  // Placeholder leaderboard data
  res.json({
    leaderboard: [],
    total: 0,
    limit,
  });
});

// Match history endpoint
app.get('/api/matches/:playerId', (req, res) => {
  const { playerId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  
  res.json({
    playerId,
    matches: [],
    total: 0,
    limit,
  });
});

// Player profile endpoint
app.get('/api/players/:playerId', (req, res) => {
  const { playerId } = req.params;
  
  res.json({
    playerId,
    name: 'Unknown',
    stats: {
      matches: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      score: 0,
    },
    createdAt: new Date().toISOString(),
  });
});

// Serve the game client
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🎮 CellDamage 3D Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
