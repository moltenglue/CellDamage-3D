import { WeaponType, Vector3 } from '../../shared/types';
import { BaseWeapon, FireResult, WeaponConfig } from './BaseWeapon';

export class MachineGun extends BaseWeapon {
  constructor(config: WeaponConfig) {
    super({ ...config, type: 'machinegun' });
  }

  public fire(ownerId: string, position: Vector3, direction: Vector3): FireResult {
    if (!this.canFire()) {
      return {
        projectiles: [],
        success: false,
        error: this.isReloading ? 'Reloading' : 'Cannot fire',
      };
    }

    // Apply spread
    const spreadDir = this.applySpread(direction, this.stats.spread);

    // Create projectile
    const projectile = this.createProjectile({
      ownerId,
      position,
      direction: spreadDir,
      weaponType: this.type,
    });

    // Update state
    this.magazineAmmo--;
    this.lastFireTime = Date.now();

    // Muzzle flash
    this.spawnMuzzleFlash(position, direction);

    return {
      projectiles: [projectile],
      success: true,
    };
  }
}
