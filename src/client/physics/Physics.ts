import * as CANNON from 'cannon-es';
import { PHYSICS_TIMESTEP, GRAVITY, MAX_SUBSTEPS, Vector3, Quaternion } from '../../shared/types';

export interface PhysicsConfig {
  gravity?: Vector3;
  iterations?: number;
  tolerance?: number;
}

export interface PhysicsMaterial {
  name: string;
  friction?: number;
  restitution?: number;
}

export interface CollisionEvent {
  bodyA: CANNON.Body;
  bodyB: CANNON.Body;
  contact: CANNON.ContactEquation;
  velocity: number;
}

type CollisionCallback = (event: CollisionEvent) => void;

export class Physics {
  private world: CANNON.World;
  private materials: Map<string, CANNON.Material> = new Map();
  private contactMaterials: Map<string, CANNON.ContactMaterial> = new Map();
  private bodies: Map<string, CANNON.Body> = new Map();
  private collisionCallbacks: Map<string, CollisionCallback[]> = new Map();
  private lastCallTime = 0;

  constructor(config?: PhysicsConfig) {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(
        config?.gravity?.x || 0,
        config?.gravity?.y || GRAVITY,
        config?.gravity?.z || 0
      ),
    });
    
    // Set solver iterations
    (this.world.solver as any).iterations = config?.iterations || 10;
    (this.world.solver as any).tolerance = config?.tolerance || 0.001;

    // Setup broadphase
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Create default materials
    this.createMaterial({ name: 'default', friction: 0.3, restitution: 0.3 });
    this.createMaterial({ name: 'ground', friction: 0.8, restitution: 0.1 });
    this.createMaterial({ name: 'vehicle', friction: 0.6, restitution: 0.2 });
    this.createMaterial({ name: 'obstacle', friction: 0.4, restitution: 0.4 });

    // Setup contact materials
    this.createContactMaterial('ground', 'vehicle', 0.8, 0.1);
    this.createContactMaterial('vehicle', 'vehicle', 0.4, 0.3);
    this.createContactMaterial('vehicle', 'obstacle', 0.5, 0.2);
  }

  public createMaterial(config: PhysicsMaterial): CANNON.Material {
    const material = new CANNON.Material({
      friction: config.friction ?? 0.3,
      restitution: config.restitution ?? 0.3,
    });
    this.materials.set(config.name, material);
    return material;
  }

  public getMaterial(name: string): CANNON.Material {
    const material = this.materials.get(name);
    if (!material) {
      throw new Error(`Material '${name}' not found`);
    }
    return material;
  }

  public createContactMaterial(
    materialA: string,
    materialB: string,
    friction: number,
    restitution: number
  ): CANNON.ContactMaterial {
    const matA = this.getMaterial(materialA);
    const matB = this.getMaterial(materialB);
    
    const contactMaterial = new CANNON.ContactMaterial(matA, matB, {
      friction,
      restitution,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    });
    
    this.world.addContactMaterial(contactMaterial);
    const key = `${materialA}_${materialB}`;
    this.contactMaterials.set(key, contactMaterial);
    
    return contactMaterial;
  }

  public createBody(
    id: string,
    shape: CANNON.Shape,
    options?: {
      mass?: number;
      position?: Vector3;
      rotation?: Quaternion;
      material?: string;
      linearDamping?: number;
      angularDamping?: number;
      type?: CANNON.BodyType;
    }
  ): CANNON.Body {
    const body = new CANNON.Body({
      mass: options?.mass ?? 1,
      material: options?.material ? this.getMaterial(options.material) : undefined,
      linearDamping: options?.linearDamping ?? 0.01,
      angularDamping: options?.angularDamping ?? 0.01,
      type: options?.type ?? CANNON.Body.DYNAMIC,
    });

    body.addShape(shape);

    if (options?.position) {
      body.position.set(options.position.x, options.position.y, options.position.z);
    }

    if (options?.rotation) {
      body.quaternion.set(
        options.rotation.x,
        options.rotation.y,
        options.rotation.z,
        options.rotation.w
      );
    }

    this.world.addBody(body);
    this.bodies.set(id, body);

    // Add collision listener
    body.addEventListener('collide', (e: { contact: CANNON.ContactEquation; body: CANNON.Body }) => {
      const callbacks = this.collisionCallbacks.get(id);
      if (callbacks) {
        const velocity = e.contact.getImpactVelocityAlongNormal();
        callbacks.forEach(cb => cb({
          bodyA: body,
          bodyB: e.body,
          contact: e.contact,
          velocity: Math.abs(velocity),
        }));
      }
    });

    return body;
  }

  public createBox(
    id: string,
    width: number,
    height: number,
    depth: number,
    options?: Parameters<Physics['createBody']>[2]
  ): CANNON.Body {
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    return this.createBody(id, shape, options);
  }

  public createSphere(
    id: string,
    radius: number,
    options?: Parameters<Physics['createBody']>[2]
  ): CANNON.Body {
    const shape = new CANNON.Sphere(radius);
    return this.createBody(id, shape, options);
  }

  public createCylinder(
    id: string,
    radius: number,
    height: number,
    segments: number = 8,
    options?: Parameters<Physics['createBody']>[2]
  ): CANNON.Body {
    const shape = new CANNON.Cylinder(radius, radius, height, segments);
    return this.createBody(id, shape, options);
  }

  public createGroundPlane(id: string, material?: string): CANNON.Body {
    const shape = new CANNON.Plane();
    const body = new CANNON.Body({
      mass: 0, // Static
      material: material ? this.getMaterial(material) : this.getMaterial('ground'),
      type: CANNON.Body.STATIC,
    });
    body.addShape(shape);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(body);
    this.bodies.set(id, body);
    return body;
  }

  public getBody(id: string): CANNON.Body | undefined {
    return this.bodies.get(id);
  }

  public removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (body) {
      this.world.removeBody(body);
      this.bodies.delete(id);
      this.collisionCallbacks.delete(id);
    }
  }

  public onCollision(id: string, callback: CollisionCallback): void {
    if (!this.collisionCallbacks.has(id)) {
      this.collisionCallbacks.set(id, []);
    }
    this.collisionCallbacks.get(id)!.push(callback);
  }

  public offCollision(id: string, callback: CollisionCallback): void {
    const callbacks = this.collisionCallbacks.get(id);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  public step(deltaTime: number): void {
    const time = performance.now() / 1000;
    if (!this.lastCallTime) {
      this.world.step(PHYSICS_TIMESTEP, deltaTime, MAX_SUBSTEPS);
    } else {
      const dt = time - this.lastCallTime;
      this.world.step(PHYSICS_TIMESTEP, dt, MAX_SUBSTEPS);
    }
    this.lastCallTime = time;
  }

  public fixedStep(): void {
    this.world.step(PHYSICS_TIMESTEP);
  }

  public getWorld(): CANNON.World {
    return this.world;
  }

  public raycast(
    from: Vector3,
    to: Vector3,
    options?: {
      collisionFilterMask?: number;
      collisionFilterGroup?: number;
      skipBackfaces?: boolean;
    }
  ): { body: CANNON.Body; point: Vector3; normal: Vector3; distance: number } | null {
    const fromVec = new CANNON.Vec3(from.x, from.y, from.z);
    const toVec = new CANNON.Vec3(to.x, to.y, to.z);
    
    const result = new CANNON.RaycastResult();
    const ray = new CANNON.Ray(fromVec, toVec);
    
    ray.intersectWorld(this.world, {
      ...options,
      mode: CANNON.Ray.CLOSEST,
      result,
    });

    if (result.hasHit && result.body) {
      return {
        body: result.body,
        point: { x: result.hitPointWorld.x, y: result.hitPointWorld.y, z: result.hitPointWorld.z },
        normal: { x: result.hitNormalWorld.x, y: result.hitNormalWorld.y, z: result.hitNormalWorld.z },
        distance: result.distance,
      };
    }

    return null;
  }

  public applyExplosion(
    position: Vector3,
    radius: number,
    force: number,
    options?: {
      verticalBias?: number;
      falloff?: 'linear' | 'inverse' | 'none';
    }
  ): void {
    const center = new CANNON.Vec3(position.x, position.y, position.z);
    const verticalBias = options?.verticalBias ?? 0.5;
    const falloff = options?.falloff ?? 'linear';

    this.bodies.forEach((body) => {
      if (body.mass === 0) return; // Skip static bodies

      const bodyPos = body.position;
      const distance = center.distanceTo(bodyPos);

      if (distance < radius) {
        let multiplier = 1;
        
        switch (falloff) {
          case 'linear':
            multiplier = 1 - (distance / radius);
            break;
          case 'inverse':
            multiplier = 1 / (1 + distance);
            break;
          case 'none':
          default:
            multiplier = 1;
        }

        // Calculate direction from explosion center to body
        const direction = new CANNON.Vec3();
        bodyPos.vsub(center, direction);
        direction.normalize();

        // Add vertical bias
        direction.y += verticalBias;
        direction.normalize();

        // Apply impulse
        const impulse = direction.scale(force * multiplier * body.mass);
        body.applyImpulse(impulse, bodyPos);
      }
    });
  }

  public addConstraint(constraint: CANNON.Constraint): void {
    this.world.addConstraint(constraint);
  }

  public removeConstraint(constraint: CANNON.Constraint): void {
    this.world.removeConstraint(constraint);
  }

  public setGravity(gravity: Vector3): void {
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);
  }

  public getAllBodies(): Map<string, CANNON.Body> {
    return this.bodies;
  }

  public clear(): void {
    this.bodies.forEach((body) => {
      this.world.removeBody(body);
    });
    this.bodies.clear();
    this.collisionCallbacks.clear();
  }

  public dispose(): void {
    this.clear();
    this.contactMaterials.clear();
    this.materials.clear();
  }
}
