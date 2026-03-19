import { WeaponType } from '../../shared/types';
import * as THREE from 'three';
import { BaseWeapon, FireResult, WeaponConfig } from './BaseWeapon';

export class RocketLauncher extends BaseWeapon {
  constructor(config: WeaponConfig) {
    super({ ...config, type: 'rocketlauncher' });
  }

  public fire(ownerId: string, position: THREE.Vector3, direction: THREE.Vector3): FireResult {
    if (!this.canFire()) {
      return {
        projectiles: [],
        success: false,
        error: this.isReloading ? 'Reloading' : 'Cannot fire',
      };
    }

    // Apply minimal spread for rockets
    const spreadDir = this.applySpread(direction, this.stats.spread);

    // Create projectile with explosion radius
    const projectile = this.createProjectile({
      ownerId,
      position: { x: position.x, y: position.y, z: position.z },
      direction: spreadDir,
      weaponType: this.type,
      speed: this.stats.projectileSpeed,
      damage: this.stats.damage,
    });

    // Update state
    this.magazineAmmo--;
    this.lastFireTime = Date.now();

    // Larger muzzle flash for rocket
    this.spawnMuzzleFlash({ x: position.x, y: position.y, z: position.z }, { x: direction.x, y: direction.y, z: direction.z });

    return {
      projectiles: [projectile],
      success: true,
    };
  }
}
