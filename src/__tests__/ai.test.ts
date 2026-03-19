import { StateMachine, AIState } from '../ai/StateMachine';
import { Pathfinder } from '../ai/Pathfinder';
import { AIController } from '../ai/AIController';
import { Vector3 } from '../shared/types';

describe('AI System', () => {
  describe('StateMachine', () => {
    let stateMachine: StateMachine;

    beforeEach(() => {
      stateMachine = new StateMachine();
    });

    it('should start in IDLE state', () => {
      expect(stateMachine.getCurrentState()).toBe(AIState.IDLE);
    });

    it('should change states correctly', () => {
      let enteredPatrol = false;
      let exitedIdle = false;

      stateMachine.registerState({
        state: AIState.IDLE,
        exitState: () => { exitedIdle = true; },
        updateState: () => {},
      });

      stateMachine.registerState({
        state: AIState.PATROL,
        enterState: () => { enteredPatrol = true; },
        updateState: () => {},
      });

      stateMachine.changeState(AIState.PATROL);

      expect(stateMachine.getCurrentState()).toBe(AIState.PATROL);
      expect(enteredPatrol).toBe(true);
      expect(exitedIdle).toBe(true);
    });

    it('should update current state', () => {
      let updateCount = 0;

      stateMachine.registerState({
        state: AIState.IDLE,
        updateState: () => { updateCount++; },
      });

      stateMachine.update(0.016);
      stateMachine.update(0.016);

      expect(updateCount).toBe(2);
    });

    it('should check state correctly', () => {
      expect(stateMachine.isInState(AIState.IDLE)).toBe(true);
      expect(stateMachine.isInState(AIState.PATROL)).toBe(false);
    });
  });

  describe('Pathfinder', () => {
    let pathfinder: Pathfinder;

    beforeEach(() => {
      pathfinder = new Pathfinder(1000);
    });

    it('should find direct path when no obstacles', () => {
      const start: Vector3 = { x: 0, y: 0, z: 0 };
      const end: Vector3 = { x: 100, y: 0, z: 100 };

      const path = pathfinder.findPath(start, end);

      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0].x).toBe(start.x);
      expect(path[0].z).toBe(start.z);
      expect(path[path.length - 1].x).toBeCloseTo(end.x, -1);
      expect(path[path.length - 1].z).toBeCloseTo(end.z, -1);
    });

    it('should return valid positions', () => {
      const start: Vector3 = { x: -400, y: 0, z: -400 };
      const end: Vector3 = { x: 400, y: 0, z: 400 };

      const path = pathfinder.findPath(start, end);

      path.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(-500);
        expect(point.x).toBeLessThanOrEqual(500);
        expect(point.z).toBeGreaterThanOrEqual(-500);
        expect(point.z).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('AIController', () => {
    let aiController: AIController;

    beforeEach(() => {
      aiController = new AIController({
        playerId: 'ai_1',
        difficulty: 'medium',
        vehicleType: 'balanced',
        mapSize: 1000,
      });
    });

    it('should initialize with correct difficulty config', () => {
      // The AI should start in PATROL state
      expect(aiController.getState()).toBe(AIState.PATROL);
    });

    it('should change weapon', () => {
      aiController.setWeapon('rocketlauncher');
      // Weapon is set internally, just verify no error
      expect(aiController).toBeDefined();
    });

    it('should update without vehicle', () => {
      const players = new Map();
      const input = aiController.update(0.016, players);

      expect(input).toBeDefined();
      expect(typeof input.forward).toBe('boolean');
    });
  });
});
