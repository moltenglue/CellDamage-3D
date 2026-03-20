import { Game, GameConfig } from '../../client/game/Game';

describe('Game Integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a mock container
    container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Game Creation', () => {
    it('should create game instance', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      expect(game).toBeDefined();
      
      game.dispose();
    });

    it('should create game with AI opponents', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
        enableAI: true,
        aiCount: 3,
      };

      const game = new Game(config);
      expect(game).toBeDefined();
      
      game.dispose();
    });
  });

  describe('Game State', () => {
    it('should track game time', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
        timeLimit: 300,
      };

      const game = new Game(config);
      const state = game.getState();
      
      expect(state.timeRemaining).toBe(300);
      
      game.dispose();
    });

    it('should track player score', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      const score = game.getPlayerScore();
      
      expect(score).toHaveProperty('kills');
      expect(score).toHaveProperty('deaths');
      expect(score).toHaveProperty('score');
      
      game.dispose();
    });
  });

  describe('Game Lifecycle', () => {
    it('should start game', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      
      expect(() => game.start()).not.toThrow();
      
      game.dispose();
    });

    it('should pause and resume game', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      game.start();
      
      expect(() => game.pause()).not.toThrow();
      expect(() => game.resume()).not.toThrow();
      
      game.dispose();
    });

    it('should dispose cleanly', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      game.start();
      
      expect(() => game.dispose()).not.toThrow();
    });
  });

  describe('Input Handling', () => {
    it('should handle keyboard input', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      
      // Simulate key press
      const keyEvent = new KeyboardEvent('keydown', { key: 'w' });
      expect(() => window.dispatchEvent(keyEvent)).not.toThrow();
      
      game.dispose();
    });

    it('should handle mouse input', () => {
      const config: GameConfig = {
        container,
        playerName: 'TestPlayer',
        vehicleType: 'balanced',
        gameMode: 'deathmatch',
      };

      const game = new Game(config);
      
      // Simulate mouse move
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
      });
      expect(() => window.dispatchEvent(mouseEvent)).not.toThrow();
      
      game.dispose();
    });
  });
});
