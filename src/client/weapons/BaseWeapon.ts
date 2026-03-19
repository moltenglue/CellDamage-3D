import { WeaponType, WeaponStats, WeaponPresets } from '../../shared/types';
import { Projectile, ProjectileConfig } from './Projectile';
import { Physics } from '../physics/Physics';
import { Renderer } from '../renderer/Renderer';
import * as THREE from 'three';

export interface WeaponConfig {
  type: WeaponType;
  physics?: Physics;
  renderer?: Renderer;
}

export interface FireResult {
  projectiles: Projectile[];
  success: boolean;
  error?: string;
}

export abstract class BaseWeapon {
  protected type: WeaponType;
  protected stats: WeaponStats;
  protected currentAmmo: number;
  protected magazineAmmo: number;
  protected lastFireTime = 0;
  protected isReloading = false;
  protected reloadStartTime = 0;
  
  protected physics?: Physics;
  protected renderer?: Renderer;

  constructor(config: WeaponConfig) {
    this.type = config.type;
    this.stats = { ...WeaponPresets[config.type] };
    this.currentAmmo = this.stats.ammo;
    this.magazineAmmo = this.stats.magazineSize;
    this.physics = config.physics;
    this.renderer = config.renderer;
  }

  public abstract fire(ownerId: string, position: Vector3, direction: Vector3): FireResult;

  protected canFire(): boolean {
    if (this.isReloading) {
      this.checkReloadComplete();
      return false;
    }

    const now = Date.now();
    const fireInterval = 1000 / this.stats.fireRate;
    
    if (now - this.lastFireTime < fireInterval) {
      return false;
    }

    if (this.magazineAmmo <= 0) {
      this.startReload();
      return false;
    }

    return true;
  }

  protected createProjectile(config: Omit<ProjectileConfig, 'id'>): Projectile {
    const projectileConfig: ProjectileConfig = {
      ...config,
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      speed: this.stats.projectileSpeed,
      damage: this.stats.damage,
      explosiveRadius: this.stats.explosiveRadius,
    };

    return new Projectile(projectileConfig, this.physics);
  }

  protected applySpread(direction: Vector3, spreadAngle: number): Vector3 {
    // Convert spread angle to random offset
    const spreadRad = spreadAngle * (Math.random() - 0.5) * 2;
    const verticalSpread = spreadAngle * (Math.random() - 0.5) * 2;
    
    // Create rotation quaternions
    const yaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      spreadRad
    );
    const pitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      verticalSpread
    );
    
    // Apply rotations
    const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    dir.applyQuaternion(yaw).applyQuaternion(pitch);
    
    return { x: dir.x, y: dir.y, z: dir.z };
  }

  protected spawnMuzzleFlash(position: Vector3, direction: Vector3): void {
    if (this.renderer) {
      const pos = new THREE.Vector3(position.x, position.y, position.z);
      const dir = new THREE.Vector3(direction.x, direction.y, direction.z);
      this.renderer.createMuzzleFlash(pos, dir);
    }
  }

  public startReload(): void {
    if (this.isReloading || this.magazineAmmo >= this.stats.magazineSize) return;
    if (this.currentAmmo <= 0) return;

    this.isReloading = true;
    this.reloadStartTime = Date.now();
  }

  protected checkReloadComplete(): boolean {
    if (!this.isReloading) return true;

    const elapsed = (Date.now() - this.reloadStartTime) / 1000;
    if (elapsed >= this.stats.reloadTime) {
      this.completeReload();
      return true;
    }

    return false;
  }

  protected completeReload(): void {
    const ammoNeeded = this.stats.magazineSize - this.magazineAmmo;
    const ammoToLoad = Math.min(ammoNeeded, this.currentAmmo);
    
    this.magazineAmmo += ammoToLoad;
    this.currentAmmo -= ammoToLoad;
    this.isReloading = false;
  }

  public cancelReload(): void {
    this.isReloading = false;
  }

  public getAmmo(): { current: number; magazine: number; max: number } {
    return {
      current: this.currentAmmo,
      magazine: this.magazineAmmo,
      max: this.stats.ammo,
    };
  }

  public isReloadingState(): boolean {
    this.checkReloadComplete();
    return this.isReloading;
  }

  public getReloadProgress(): number {
    if (!this.isReloading) return 1;
    const elapsed = (Date.now() - this.reloadStartTime) / 1000;
    return Math.min(1, elapsed / this.stats.reloadTime);
  }

  public getType(): WeaponType {
    return this.type;
  }

  public getStats(): WeaponStats {
    return { ...this.stats };
  }

  public addAmmo(amount: number): void {
    this.currentAmmo = Math.min(this.currentAmmo + amount, this.stats.ammo);
  }

  public getMaxAmmo(): number {
    return this.stats.ammo;
  }
}
