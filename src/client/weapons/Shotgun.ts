import { WeaponType } from '../../shared/types';
import * as THREE from 'three';
import { BaseWeapon, FireResult, WeaponConfig } from './BaseWeapon';

export class Shotgun extends BaseWeapon {
  private static readonly PELLET_COUNT = 8;

  constructor(config: WeaponConfig) {
    super({ ...config, type: 'shotgun' });
  }

  public fire(ownerId: string, position: THREE.Vector3, direction: THREE.Vector3): FireResult {
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
        speed: this.stats.projectileSpeed,
        damage: this.stats.damage / Shotgun.PELLET_COUNT,
      });

      projectiles.push(projectile);
    }

    // Update state
    this.magazineAmmo--;
    this.lastFireTime = Date.now();

    // Muzzle flash
    this.spawnMuzzleFlash({ x: position.x, y: position.y, z: position.z }, { x: direction.x, y: direction.y, z: direction.z });

    return {
      projectiles,
      success: true,
    };
  }
}
