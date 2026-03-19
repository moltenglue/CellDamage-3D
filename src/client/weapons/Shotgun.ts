import { WeaponType, Vector3 } from '../../shared/types';
import { BaseWeapon, FireResult, WeaponConfig } from './BaseWeapon';

export class Shotgun extends BaseWeapon {
  private static readonly PELLET_COUNT = 8;

  constructor(config: WeaponConfig) {
    super({ ...config, type: 'shotgun' });
  }

  public fire(ownerId: string, position: Vector3, direction: Vector3): FireResult {
    if (!this.canFire()) {
      return {
        projectiles: [],
        success: false,
        error: this.isReloading ? 'Reloading' : 'Cannot fire',
      };
    }

    const projectiles: ReturnType<BaseWeapon['createProjectile']>[] = [];

    // Fire multiple pellets
    for (let i = 0; i < Shotgun.PELLET_COUNT; i++) {
      // Apply spread to each pellet
      const spreadDir = this.applySpread(direction, this.stats.spread);
      
      // Slight position variance for more realistic spread
      const posVariance = 0.1;
      const variedPos = {
        x: position.x + (Math.random() - 0.5) * posVariance,
        y: position.y + (Math.random() - 0.5) * posVariance,
        z: position.z + (Math.random() - 0.5) * posVariance,
      };

      const projectile = this.createProjectile({
        ownerId,
        position: variedPos,
        direction: spreadDir,
        weaponType: this.type,
      });

      projectiles.push(projectile);
    }

    // Update state
    this.magazineAmmo--;
    this.lastFireTime = Date.now();

    // Muzzle flash
    this.spawnMuzzleFlash(position, direction);

    return {
      projectiles,
      success: true,
    };
  }
}
