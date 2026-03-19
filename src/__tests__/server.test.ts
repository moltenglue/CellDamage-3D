import request from 'supertest';
import app from '../server/index';

describe('Express Server', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API Endpoints', () => {
    it('should return server status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body.status).toBe('online');
      expect(response.body.serverTime).toBeDefined();
    });

    it('should return stats', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalMatches');
      expect(response.body).toHaveProperty('activeMatches');
      expect(response.body).toHaveProperty('totalPlayers');
    });

    it('should return leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboard')
        .expect(200);

      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
    });

    it('should return player profile', async () => {
      const playerId = 'test_player';
      const response = await request(app)
        .get(`/api/players/${playerId}`)
        .expect(200);

      expect(response.body.playerId).toBe(playerId);
      expect(response.body).toHaveProperty('stats');
    });

    it('should return match history', async () => {
      const playerId = 'test_player';
      const response = await request(app)
        .get(`/api/matches/${playerId}`)
        .expect(200);

      expect(response.body.playerId).toBe(playerId);
      expect(response.body).toHaveProperty('matches');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Static Files', () => {
    it('should serve index.html at root', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
    });
  });
});
