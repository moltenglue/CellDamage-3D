import { MachineGun, Shotgun, RocketLauncher, Projectile } from '../../client/weapons';
import { WeaponConfig } from '../../client/weapons/BaseWeapon';

describe('Weapons', () => {
  const mockConfig: WeaponConfig = {
    type: 'machinegun',
  };

  describe('MachineGun', () => {
    it('should create machine gun with correct type', () => {
      const mg = new MachineGun(mockConfig);
      expect(mg.getType()).toBe('machinegun');
    });

    it('should fire single projectile', () => {
      const mg = new MachineGun(mockConfig);
      const position = { x: 0, y: 0, z: 0 };
      const direction = { x: 1, y: 0, z: 0 };

      const result = mg.fire('player1', position, direction);

      expect(result.success).toBe(true);
      expect(result.projectiles.length).toBe(1);
    });

    it('should not fire when magazine is empty', () => {
      const mg = new MachineGun(mockConfig);
      const position = { x: 0, y: 0, z: 0 };
      const direction = { x: 1, y: 0, z: 0 };

      // Empty the magazine
      for (let i = 0; i < 100; i++) {
        mg.fire('player1', position, direction);
      }

      const result = mg.fire('player1', position, direction);
      expect(result.success).toBe(false);
    });

    it('should track ammo correctly', () => {
      const mg = new MachineGun(mockConfig);
      const ammo = mg.getAmmo();

      expect(ammo.magazine).toBe(50);
      expect(ammo.max).toBe(200);
    });
  });

  describe('Shotgun', () => {
    it('should create shotgun with correct type', () => {
      const sg = new Shotgun(mockConfig);
      expect(sg.getType()).toBe('shotgun');
    });

    it('should fire multiple pellets', () => {
      const sg = new Shotgun(mockConfig);
      const position = { x: 0, y: 0, z: 0 };
      const direction = { x: 1, y: 0, z: 0 };

      const result = sg.fire('player1', position, direction);

      expect(result.success).toBe(true);
      expect(result.projectiles.length).toBe(8);
    });

    it('should have lower fire rate than machine gun', () => {
      const sg = new Shotgun(mockConfig);
      const mg = new MachineGun(mockConfig);

      const sgStats = sg.getStats();
      const mgStats = mg.getStats();

      expect(sgStats.fireRate).toBeLessThan(mgStats.fireRate);
    });
  });

  describe('RocketLauncher', () => {
    it('should create rocket launcher with correct type', () => {
      const rl = new RocketLauncher(mockConfig);
      expect(rl.getType()).toBe('rocketlauncher');
    });

    it('should have explosive radius', () => {
      const rl = new RocketLauncher(mockConfig);
      const stats = rl.getStats();

      expect(stats.explosiveRadius).toBeGreaterThan(0);
    });

    it('should have highest damage', () => {
      const rl = new RocketLauncher(mockConfig);
      const mg = new MachineGun(mockConfig);
      const sg = new Shotgun(mockConfig);

      const rlStats = rl.getStats();
      const mgStats = mg.getStats();
      const sgStats = sg.getStats();

      expect(rlStats.damage).toBeGreaterThan(mgStats.damage);
      expect(rlStats.damage).toBeGreaterThan(sgStats.damage);
    });

    it('should have lowest fire rate', () => {
      const rl = new RocketLauncher(mockConfig);
      const mg = new MachineGun(mockConfig);

      const rlStats = rl.getStats();
      const mgStats = mg.getStats();

      expect(rlStats.fireRate).toBeLessThan(mgStats.fireRate);
    });
  });

  describe('Projectile', () => {
    it('should create projectile with correct properties', () => {
      const config = {
        id: 'test_proj',
        ownerId: 'player1',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        speed: 100,
        damage: 25,
        weaponType: 'machinegun' as const,
      };

      const proj = new Projectile(config);

      expect(proj.id).toBe('test_proj');
      expect(proj.ownerId).toBe('player1');
      expect(proj.damage).toBe(25);
      expect(proj.weaponType).toBe('machinegun');
    });

    it('should update position correctly', () => {
      const config = {
        id: 'test_proj',
        ownerId: 'player1',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        speed: 100,
        damage: 25,
        weaponType: 'machinegun' as const,
      };

      const proj = new Projectile(config);
      const result = proj.update(0.1);

      expect(result).toBe(true);
      expect(proj.position.x).toBe(10); // 100 * 0.1
    });

    it('should expire after lifetime', () => {
      const config = {
        id: 'test_proj',
        ownerId: 'player1',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
        speed: 100,
        damage: 25,
        weaponType: 'machinegun' as const,
      };

      const proj = new Projectile(config);

      // Fast-forward time beyond projectile lifetime
      const startTime = Date.now();
      Object.defineProperty(proj, 'createdAt', { value: startTime - 3000 });

      const result = proj.update(0.1);
      expect(result).toBe(false);
    });
  });
});
