import { Physics } from '../../client/physics/Physics';
import * as CANNON from 'cannon-es';

describe('Physics', () => {
  let physics: Physics;

  beforeEach(() => {
    physics = new Physics();
  });

  afterEach(() => {
    physics.dispose();
  });

  describe('World Creation', () => {
    it('should create physics world', () => {
      expect(physics).toBeDefined();
      expect(physics.getWorld()).toBeDefined();
    });

    it('should have gravity', () => {
      const world = physics.getWorld();
      expect(world.gravity).toBeDefined();
      expect(world.gravity.y).toBeLessThan(0); // Gravity should be negative
    });

    it('should create materials', () => {
      const defaultMaterial = physics.getMaterial('default');
      expect(defaultMaterial).toBeDefined();

      const groundMaterial = physics.getMaterial('ground');
      expect(groundMaterial).toBeDefined();

      const vehicleMaterial = physics.getMaterial('vehicle');
      expect(vehicleMaterial).toBeDefined();
    });
  });

  describe('Body Creation', () => {
    it('should create box body', () => {
      const body = physics.createBox('test_box', 1, 1, 1, {
        mass: 1,
        position: { x: 0, y: 5, z: 0 },
      });

      expect(body).toBeDefined();
      expect(physics.getBody('test_box')).toBe(body);
    });

    it('should create sphere body', () => {
      const body = physics.createSphere('test_sphere', 1, {
        mass: 1,
        position: { x: 0, y: 5, z: 0 },
      });

      expect(body).toBeDefined();
      expect(physics.getBody('test_sphere')).toBe(body);
    });

    it('should create cylinder body', () => {
      const body = physics.createCylinder('test_cylinder', 1, 1, 2, {
        mass: 1,
        position: { x: 0, y: 5, z: 0 },
      });

      expect(body).toBeDefined();
      expect(physics.getBody('test_cylinder')).toBe(body);
    });

    it('should remove body', () => {
      physics.createBox('removable', 1, 1, 1, { mass: 1 });
      
      expect(physics.getBody('removable')).toBeDefined();
      
      physics.removeBody('removable');
      
      expect(physics.getBody('removable')).toBeUndefined();
    });
  });

  describe('Step/Update', () => {
    it('should step physics world', () => {
      const initialTime = physics.getWorld().time;
      
      physics.step(1 / 60);
      
      expect(physics.getWorld().time).toBeGreaterThan(initialTime);
    });

    it('should update body positions over time', () => {
      const body = physics.createBox('falling', 1, 1, 1, {
        mass: 1,
        position: { x: 0, y: 10, z: 0 },
      });

      const initialY = body.position.y;

      // Step multiple times
      for (let i = 0; i < 60; i++) {
        physics.step(1 / 60);
      }

      expect(body.position.y).toBeLessThan(initialY);
    });
  });

  describe('Collision Detection', () => {
    it('should detect raycast hits', () => {
      // Create a ground plane
      physics.createBox('ground', 100, 1, 100, {
        mass: 0,
        position: { x: 0, y: -1, z: 0 },
      });

      const start = { x: 0, y: 10, z: 0 };
      const end = { x: 0, y: -10, z: 0 };

      const hit = physics.raycast(start, end);

      expect(hit).toBeDefined();
      expect(hit).not.toBeNull();
      if (hit) {
        expect(hit.body).toBeDefined();
      }
    });

    it('should return null for miss', () => {
      const start = { x: 0, y: 10, z: 0 };
      const end = { x: 0, y: 100, z: 0 }; // Ray pointing up

      const hit = physics.raycast(start, end);

      expect(hit).toBeNull();
    });
  });

  describe('Materials', () => {
    it('should create custom material', () => {
      physics.createMaterial({
        name: 'custom',
        friction: 0.5,
        restitution: 0.8,
      });

      const material = physics.getMaterial('custom');
      expect(material).toBeDefined();
    });

    it('should create contact materials', () => {
      physics.createContactMaterial('ground', 'vehicle', 0.8, 0.1);
      // Should not throw
      expect(() => physics.createContactMaterial('vehicle', 'obstacle', 0.5, 0.2)).not.toThrow();
    });
  });
});
