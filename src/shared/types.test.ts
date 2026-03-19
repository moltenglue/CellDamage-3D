import {
  generateId,
  vector3Distance,
  clamp,
  lerp,
  calculateMapSize,
  generateSpawnPoints,
  Vector3,
} from '../types';

describe('Shared Types - Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
    });
  });

  describe('vector3Distance', () => {
    it('should calculate distance between two points', () => {
      const a: Vector3 = { x: 0, y: 0, z: 0 };
      const b: Vector3 = { x: 3, y: 4, z: 0 };
      expect(vector3Distance(a, b)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const a: Vector3 = { x: 5, y: 5, z: 5 };
      expect(vector3Distance(a, a)).toBe(0);
    });

    it('should handle 3D distance correctly', () => {
      const a: Vector3 = { x: 1, y: 2, z: 2 };
      const b: Vector3 = { x: 4, y: 6, z: 2 };
      expect(vector3Distance(a, b)).toBe(5);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('should interpolate correctly', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('should clamp t to [0, 1]', () => {
      expect(lerp(0, 10, -0.5)).toBe(0);
      expect(lerp(0, 10, 1.5)).toBe(10);
    });
  });

  describe('calculateMapSize', () => {
    it('should return base size for 8 players', () => {
      expect(calculateMapSize(8)).toBe(1000);
    });

    it('should scale correctly for 16 players', () => {
      const size = calculateMapSize(16);
      expect(size).toBe(Math.floor(1000 * Math.sqrt(16 / 8)));
    });

    it('should scale correctly for 64 players', () => {
      const size = calculateMapSize(64);
      expect(size).toBe(Math.floor(1000 * Math.sqrt(64 / 8)));
    });
  });

  describe('generateSpawnPoints', () => {
    it('should generate correct number of spawn points', () => {
      const points = generateSpawnPoints(8, 1000);
      expect(points.length).toBe(8);
    });

    it('should generate points within map bounds', () => {
      const mapSize = 1000;
      const points = generateSpawnPoints(8, mapSize);
      const halfSize = mapSize / 2;

      points.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(-halfSize);
        expect(point.x).toBeLessThanOrEqual(halfSize);
        expect(point.z).toBeGreaterThanOrEqual(-halfSize);
        expect(point.z).toBeLessThanOrEqual(halfSize);
        expect(point.y).toBe(5);
      });
    });
  });
});
