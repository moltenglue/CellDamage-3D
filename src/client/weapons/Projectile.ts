import { WeaponType, WeaponStats, WeaponPresets, Vector3 } from '../../shared/types';
import * as CANNON from 'cannon-es';
import { Physics } from '../physics/Physics';

export interface ProjectileConfig {
  id: string;
  ownerId: string;
  position: Vector3;
  direction: Vector3;
  speed: number;
  damage: number;
  weaponType: WeaponType;
  explosiveRadius?: number;
}

export class Projectile {
  public readonly id: string;
  public readonly ownerId: string;
  public readonly weaponType: WeaponType;
  public readonly damage: number;
  public readonly explosiveRadius: number;
  
  public position: Vector3;
  public velocity: Vector3;
  public readonly createdAt: number;
  public hasExploded = false;
  
  private physicsBody?: CANNON.Body;
  private physics?: Physics;

  constructor(config: ProjectileConfig, physics?: Physics) {
    this.id = config.id;
    this.ownerId = config.ownerId;
    this.weaponType = config.weaponType;
    this.damage = config.damage;
    this.explosiveRadius = config.explosiveRadius || 0;
    this.position = { ...config.position };
    this.createdAt = Date.now();
    
    // Calculate velocity
    const dirLength = Math.sqrt(
      config.direction.x ** 2 + 
      config.direction.y ** 2 + 
      config.direction.z ** 2
    );
    
    this.velocity = {
      x: (config.direction.x / dirLength) * config.speed,
      y: (config.direction.y / dirLength) * config.speed,
      z: (config.direction.z / dirLength) * config.speed,
    };

    // Create physics body if physics world provided
    if (physics) {
      this.physics = physics;
      this.createPhysicsBody();
    }
  }

  private createPhysicsBody(): void {
    if (!this.physics) return;

    const radius = this.explosiveRadius > 0 ? 0.3 : 0.1;
    this.physicsBody = this.physics.createSphere(`proj_${this.id}`, radius, {
      mass: 0.1,
      position: this.position,
      material: 'default',
      linearDamping: 0,
      angularDamping: 0,
    });

    // Set velocity
    this.physicsBody.velocity.set(this.velocity.x, this.velocity.y, this.velocity.z);

    // Disable collision with owner initially
    this.physicsBody.collisionFilterGroup = 2;
    this.physicsBody.collisionFilterMask = 1;
  }

  public update(deltaTime: number): boolean {
    if (this.hasExploded) return false;

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Apply gravity for rockets
    if (this.weaponType === 'rocketlauncher') {
      this.velocity.y -= 9.8 * deltaTime * 0.3;
    }

    // Sync physics body if exists
    if (this.physicsBody) {
      this.physicsBody.position.set(this.position.x, this.position.y, this.position.z);
      this.physicsBody.velocity.set(this.velocity.x, this.velocity.y, this.velocity.z);
    }

    // Check lifetime
    const age = Date.now() - this.createdAt;
    const maxLifetime = this.getMaxLifetime();
    
    return age < maxLifetime;
  }

  private getMaxLifetime(): number {
    switch (this.weaponType) {
      case 'machinegun':
        return 2000;
      case 'shotgun':
        return 1000;
      case 'rocketlauncher':
        return 5000;
      default:
        return 2000;
    }
  }

  public explode(physics: Physics): void {
    if (this.hasExploded || this.explosiveRadius <= 0) return;
    
    this.hasExploded = true;
    
    // Apply explosion force
    physics.applyExplosion(
      this.position,
      this.explosiveRadius,
      5000,
      { verticalBias: 0.3, falloff: 'linear' }
    );
  }

  public dispose(): void {
    if (this.physics && this.physicsBody) {
      this.physics.removeBody(`proj_${this.id}`);
    }
  }
}
