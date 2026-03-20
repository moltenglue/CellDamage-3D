import { Vehicle } from '../../client/vehicle/Vehicle';
import { Physics } from '../../client/physics/Physics';
import { VehicleType } from '../../shared/types';

describe('Vehicle', () => {
  let physics: Physics;

  beforeEach(() => {
    physics = new Physics();
  });

  afterEach(() => {
    physics.dispose();
  });

  describe('Creation', () => {
    it('should create vehicle with correct type', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'speedster' as VehicleType,
        playerId: 'player1',
      }, physics);

      expect(vehicle.getSpeed()).toBe(0);
      expect(vehicle.getHealth()).toBe(80); // Speedster health
    });

    it('should create tank with higher health', () => {
      const vehicle = new Vehicle({
        id: 'test_tank',
        type: 'tank' as VehicleType,
        playerId: 'player2',
      }, physics);

      expect(vehicle.getHealth()).toBe(150);
    });

    it('should have max health equal to initial health', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player3',
      }, physics);

      expect(vehicle.getMaxHealth()).toBe(vehicle.getHealth());
    });
  });

  describe('Movement', () => {
    it('should accelerate forward', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      const initialSpeed = vehicle.getSpeed();
      
      // Apply forward input
      vehicle.setInput({ forward: true });
      
      // Update multiple times to simulate physics
      for (let i = 0; i < 60; i++) {
        vehicle.update();
      }

      expect(vehicle.getSpeed()).toBeGreaterThan(initialSpeed);
    });

    it('should get velocity vector', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      const velocity = vehicle.getVelocity();
      
      expect(velocity).toHaveProperty('x');
      expect(velocity).toHaveProperty('y');
      expect(velocity).toHaveProperty('z');
    });

    it('should get forward vector', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      const forward = vehicle.getForwardVector();
      
      expect(forward).toHaveProperty('x');
      expect(forward).toHaveProperty('y');
      expect(forward).toHaveProperty('z');
      
      // Forward vector should be normalized (approximately)
      const magnitude = Math.sqrt(forward.x ** 2 + forward.y ** 2 + forward.z ** 2);
      expect(magnitude).toBeCloseTo(1, 1);
    });
  });

  describe('Damage & Crumple Zones', () => {
    it('should take damage', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      const initialHealth = vehicle.getHealth();
      vehicle.takeDamage(20);

      expect(vehicle.getHealth()).toBe(initialHealth - 20);
    });

    it('should not go below 0 health', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      vehicle.takeDamage(200);

      expect(vehicle.getHealth()).toBe(0);
    });

    it('should destroy vehicle at 0 health', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      vehicle.takeDamage(100);
      
      const state = vehicle.getState();
      expect(state.isDestroyed).toBe(true);
    });

    it('should respawn with full health', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      const maxHealth = vehicle.getMaxHealth();
      vehicle.takeDamage(50);
      vehicle.respawn();

      expect(vehicle.getHealth()).toBe(maxHealth);
      expect(vehicle.getState().isDestroyed).toBe(false);
    });
  });

  describe('Turbo & Drifting', () => {
    it('should have turbo charge', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      expect(vehicle.getTurboCharge()).toBe(100);
    });

    it('should not be drifting initially', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      expect(vehicle.isDrifting()).toBe(false);
    });

    it('should update state correctly', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      const state = vehicle.getState();
      
      expect(state).toHaveProperty('speed');
      expect(state).toHaveProperty('steering');
      expect(state).toHaveProperty('health');
      expect(state).toHaveProperty('isDestroyed');
      expect(state).toHaveProperty('isGrounded');
      expect(state).toHaveProperty('turboCharge');
      expect(state).toHaveProperty('isDrifting');
      expect(state).toHaveProperty('driftFactor');
    });
  });

  describe('Input Handling', () => {
    it('should accept input updates', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      vehicle.setInput({
        forward: true,
        left: true,
        brake: false,
      });

      // Should not throw
      expect(() => vehicle.update()).not.toThrow();
    });

    it('should handle all input types', () => {
      const vehicle = new Vehicle({
        id: 'test_vehicle',
        type: 'balanced' as VehicleType,
        playerId: 'player1',
      }, physics);

      vehicle.setInput({
        forward: true,
        backward: false,
        left: true,
        right: false,
        brake: true,
        fire: false,
        aimX: 0.5,
        aimY: -0.3,
      });

      expect(() => vehicle.update()).not.toThrow();
    });
  });
});
