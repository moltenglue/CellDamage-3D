import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Physics } from '../physics/Physics';
import { VehicleType, VehicleStats, VehiclePresets, InputState, Vector3 } from '../../shared/types';
import { Renderer } from '../renderer/Renderer';

export interface VehicleConfig {
  id: string;
  type: VehicleType;
  position?: Vector3;
  rotation?: Vector3;
  playerId: string;
}

export interface CrumpleZone {
  name: 'front' | 'rear' | 'left' | 'right';
  health: number;
  maxHealth: number;
  deformation: number;
  position: CANNON.Vec3;
  size: CANNON.Vec3;
  shape?: CANNON.Shape;
  visualMesh?: THREE.Mesh;
}

export interface VehicleState {
  speed: number;
  steering: number;
  health: number;
  isDestroyed: boolean;
  isGrounded: boolean;
  turboCharge: number;
  isDrifting: boolean;
  driftFactor: number;
}

export class Vehicle {
  public readonly id: string;
  public readonly playerId: string;
  public readonly type: VehicleType;
  public readonly stats: VehicleStats;

  private physics: Physics;
  private renderer?: Renderer;

  // Cannon.js components
  private chassisBody: CANNON.Body;
  private vehicle: CANNON.RaycastVehicle;
  private wheelBodies: CANNON.Body[] = [];

  // Three.js components
  private chassisMesh?: THREE.Mesh;
  private wheelMeshes: THREE.Mesh[] = [];
  private chassisGroup?: THREE.Group;

  // Crumple zones for realistic damage
  private crumpleZones: Map<string, CrumpleZone> = new Map();
  private maxCrumpleDeformation = 0.5; // Maximum visual deformation

  // State
  private state: VehicleState;
  private input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    fire: false,
    aimX: 0,
    aimY: 0,
  };

  // Dynamic driving
  private turboMultiplier = 1.0;
  private driftTimer = 0;
  private lastSpeed = 0;
  private acceleration = 0;

  constructor(config: VehicleConfig, physics: Physics, renderer?: Renderer) {
    this.id = config.id;
    this.playerId = config.playerId;
    this.type = config.type;
    this.stats = VehiclePresets[config.type];
    this.physics = physics;
    this.renderer = renderer;

    this.state = {
      speed: 0,
      steering: 0,
      health: this.stats.health,
      isDestroyed: false,
      isGrounded: false,
      turboCharge: 100,
      isDrifting: false,
      driftFactor: 0,
    };

    this.chassisBody = this.createChassis(config.position, config.rotation);
    this.vehicle = this.createVehicle();
    this.setupCrumpleZones();

    if (renderer) {
      this.createVisuals();
    }
  }

  private createChassis(position?: Vector3, rotation?: Vector3): CANNON.Body {
    // Main chassis shape
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.2, 0.5, 2.5));
    const chassisBody = new CANNON.Body({
      mass: this.stats.mass,
      material: this.physics.getMaterial('vehicle'),
    });

    chassisBody.addShape(chassisShape);

    // Add crumple zone shapes as child shapes
    this.addCrumpleZoneShapes(chassisBody);

    if (position) {
      chassisBody.position.set(position.x, position.y, position.z);
    } else {
      chassisBody.position.set(0, 5, 0);
    }

    if (rotation) {
      chassisBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
    }

    // Dynamic driving properties
    chassisBody.linearDamping = 0.01;
    chassisBody.angularDamping = 0.3; // Reduced for more dynamic rotation

    this.physics.getWorld().addBody(chassisBody);

    // Add collision listener for damage
    this.physics.onCollision(this.id, (event) => {
      this.handleCollision(event.velocity, event.contactPoint);
    });

    return chassisBody;
  }

  private addCrumpleZoneShapes(chassisBody: CANNON.Body): void {
    // Front crumple zone
    const frontShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.4, 0.5));
    chassisBody.addShape(frontShape, new CANNON.Vec3(0, 0, 2.8));

    // Rear crumple zone
    const rearShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.4, 0.5));
    chassisBody.addShape(rearShape, new CANNON.Vec3(0, 0, -2.8));

    // Left side
    const leftShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.4, 1.5));
    chassisBody.addShape(leftShape, new CANNON.Vec3(-1.4, 0, 0));

    // Right side
    const rightShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.4, 1.5));
    chassisBody.addShape(rightShape, new CANNON.Vec3(1.4, 0, 0));
  }

  private setupCrumpleZones(): void {
    // Front zone
    this.crumpleZones.set('front', {
      name: 'front',
      health: 100,
      maxHealth: 100,
      deformation: 0,
      position: new CANNON.Vec3(0, 0, 2.8),
      size: new CANNON.Vec3(1.0, 0.4, 0.5),
    });

    // Rear zone
    this.crumpleZones.set('rear', {
      name: 'rear',
      health: 100,
      maxHealth: 100,
      deformation: 0,
      position: new CANNON.Vec3(0, 0, -2.8),
      size: new CANNON.Vec3(1.0, 0.4, 0.5),
    });

    // Left side
    this.crumpleZones.set('left', {
      name: 'left',
      health: 80,
      maxHealth: 80,
      deformation: 0,
      position: new CANNON.Vec3(-1.4, 0, 0),
      size: new CANNON.Vec3(0.3, 0.4, 1.5),
    });

    // Right side
    this.crumpleZones.set('right', {
      name: 'right',
      health: 80,
      maxHealth: 80,
      deformation: 0,
      position: new CANNON.Vec3(1.4, 0, 0),
      size: new CANNON.Vec3(0.3, 0.4, 1.5),
    });
  }

  private createVehicle(): CANNON.RaycastVehicle {
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    // Enhanced wheel options for dynamic driving
    const wheelOptions = {
      radius: 0.5,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: this.stats.suspensionStiffness,
      suspensionRestLength: this.stats.suspensionRestLength,
      frictionSlip: this.stats.grip,
      dampingRelaxation: this.stats.suspensionDamping,
      dampingCompression: this.stats.suspensionDamping * 0.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    // Front left - wider stance for better stability
    wheelOptions.chassisConnectionPointLocal.set(1.1, 0, 1.8);
    vehicle.addWheel(wheelOptions);

    // Front right
    wheelOptions.chassisConnectionPointLocal.set(-1.1, 0, 1.8);
    vehicle.addWheel(wheelOptions);

    // Rear left
    wheelOptions.chassisConnectionPointLocal.set(1.1, 0, -1.8);
    vehicle.addWheel(wheelOptions);

    // Rear right
    wheelOptions.chassisConnectionPointLocal.set(-1.1, 0, -1.8);
    vehicle.addWheel(wheelOptions);

    vehicle.addToWorld(this.physics.getWorld());

    // Create wheel bodies for visuals
    const wheelBodies: CANNON.Body[] = [];
    for (let i = 0; i < vehicle.wheelInfos.length; i++) {
      const wheelBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        position: new CANNON.Vec3(0, 0, 0),
      });

      const wheelShape = new CANNON.Cylinder(0.5, 0.5, 0.4, 16);
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
      wheelBody.addShape(wheelShape, new CANNON.Vec3(0, 0, 0), q);

      wheelBodies.push(wheelBody);
      this.physics.getWorld().addBody(wheelBody);
    }

    this.wheelBodies = wheelBodies;
    return vehicle;
  }

  private createVisuals(): void {
    if (!this.renderer) return;

    // Create chassis group for deformation
    this.chassisGroup = new THREE.Group();

    // Main chassis body
    const chassisGeometry = new THREE.BoxGeometry(2.4, 1.0, 5.0);
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: this.getVehicleColor(),
      roughness: 0.3,
      metalness: 0.4,
    });
    this.chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial);
    this.chassisMesh.castShadow = true;
    this.chassisMesh.receiveShadow = true;
    this.chassisGroup.add(this.chassisMesh);

    // Create crumple zone visual meshes
    this.createCrumpleZoneVisuals();

    // Add chassis group to scene
    this.renderer.getScene().add(this.chassisGroup);

    // Create wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 32);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;
      this.renderer.getScene().add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    }

    // Add weapon mount point
    this.createWeaponMount();

    // Add turbo exhaust effect
    this.createTurboExhaust();
  }

  private createCrumpleZoneVisuals(): void {
    if (!this.chassisGroup) return;

    const crumpleMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.7,
      metalness: 0.3,
    });

    // Front crumple zone
    const frontZone = this.crumpleZones.get('front')!;
    const frontGeometry = new THREE.BoxGeometry(
      frontZone.size.x * 2,
      frontZone.size.y * 2,
      frontZone.size.z * 2
    );
    const frontMesh = new THREE.Mesh(frontGeometry, crumpleMaterial);
    frontMesh.position.set(frontZone.position.x, frontZone.position.y, frontZone.position.z);
    this.chassisGroup.add(frontMesh);
    frontZone.visualMesh = frontMesh;

    // Rear crumple zone
    const rearZone = this.crumpleZones.get('rear')!;
    const rearGeometry = new THREE.BoxGeometry(
      rearZone.size.x * 2,
      rearZone.size.y * 2,
      rearZone.size.z * 2
    );
    const rearMesh = new THREE.Mesh(rearGeometry, crumpleMaterial);
    rearMesh.position.set(rearZone.position.x, rearZone.position.y, rearZone.position.z);
    this.chassisGroup.add(rearMesh);
    rearZone.visualMesh = rearMesh;
  }

  private createTurboExhaust(): void {
    if (!this.chassisGroup) return;

    // Exhaust pipes
    const exhaustGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5);
    const exhaustMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.5,
      metalness: 0.8,
    });

    // Left exhaust
    const leftExhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    leftExhaust.rotation.x = Math.PI / 2;
    leftExhaust.position.set(-0.8, 0, -2.6);
    this.chassisGroup.add(leftExhaust);

    // Right exhaust
    const rightExhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    rightExhaust.rotation.x = Math.PI / 2;
    rightExhaust.position.set(0.8, 0, -2.6);
    this.chassisGroup.add(rightExhaust);
  }

  private createWeaponMount(): void {
    if (!this.renderer || !this.chassisGroup) return;

    // Create turret/mount
    const mountGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 16);
    const mountMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.8,
    });
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.set(0, 0.6, 0);
    this.chassisGroup.add(mount);
  }

  private getVehicleColor(): number {
    switch (this.type) {
      case 'speedster':
        return 0xff3333; // Red
      case 'tank':
        return 0x3333ff; // Blue
      case 'balanced':
        return 0x33ff33; // Green
      default:
        return 0x888888;
    }
  }

  private handleCollision(velocity: number, contactPoint?: CANNON.Vec3): void {
    const COLLISION_DAMAGE_THRESHOLD = 8;
    const COLLISION_DAMAGE_MULTIPLIER = 1.5;

    if (velocity > COLLISION_DAMAGE_THRESHOLD) {
      const damage = Math.floor((velocity - COLLISION_DAMAGE_THRESHOLD) * COLLISION_DAMAGE_MULTIPLIER);
      this.takeDamage(damage);

      // Determine which crumple zone was hit
      if (contactPoint) {
        this.damageCrumpleZone(contactPoint, damage);
      }
    }
  }

  private damageCrumpleZone(contactPoint: CANNON.Vec3, damage: number): void {
    // Transform contact point to local space
    const localPoint = new CANNON.Vec3();
    this.chassisBody.pointToLocalFrame(contactPoint, localPoint);

    // Find which zone was hit based on local position
    let hitZone: CrumpleZone | null = null;
    
    if (localPoint.z > 2.0) {
      hitZone = this.crumpleZones.get('front') || null;
    } else if (localPoint.z < -2.0) {
      hitZone = this.crumpleZones.get('rear') || null;
    } else if (localPoint.x < -1.0) {
      hitZone = this.crumpleZones.get('left') || null;
    } else if (localPoint.x > 1.0) {
      hitZone = this.crumpleZones.get('right') || null;
    }

    if (hitZone) {
      hitZone.health = Math.max(0, hitZone.health - damage);
      hitZone.deformation = Math.min(
        this.maxCrumpleDeformation,
        (1 - hitZone.health / hitZone.maxHealth) * this.maxCrumpleDeformation
      );

      // Update visual deformation
      this.updateCrumpleZoneVisual(hitZone);

      // Spawn debris particles
      if (this.renderer) {
        this.renderer.createDebris(contactPoint as unknown as THREE.Vector3, damage);
      }
    }
  }

  private updateCrumpleZoneVisual(zone: CrumpleZone): void {
    if (!zone.visualMesh) return;

    // Scale mesh to show compression
    const compression = 1 - zone.deformation * 0.5;
    zone.visualMesh.scale.set(
      zone.name === 'front' || zone.name === 'rear' ? 1 : compression,
      compression,
      zone.name === 'front' || zone.name === 'rear' ? compression : 1
    );

    // Darken color based on damage
    const damageRatio = 1 - zone.health / zone.maxHealth;
    const baseColor = new THREE.Color(0x666666);
    const damageColor = new THREE.Color(0x332222);
    zone.visualMesh.material = new THREE.MeshStandardMaterial({
      color: baseColor.lerp(damageColor, damageRatio),
      roughness: 0.7,
      metalness: 0.3,
    });
  }

  public takeDamage(damage: number): void {
    if (this.state.isDestroyed) return;

    this.state.health = Math.max(0, this.state.health - damage);

    if (this.state.health <= 0) {
      this.destroy();
    }
  }

  public destroy(): void {
    this.state.isDestroyed = true;
    this.state.health = 0;

    // Disable vehicle physics
    this.vehicle.applyEngineForce(0, 0);
    this.vehicle.applyEngineForce(0, 1);
    this.vehicle.applyEngineForce(0, 2);
    this.vehicle.applyEngineForce(0, 3);

    // Visual effect
    if (this.renderer) {
      this.renderer.createExplosion(this.chassisBody.position as unknown as THREE.Vector3, 2);
    }
  }

  public respawn(position?: Vector3): void {
    // Reset crumple zones
    this.crumpleZones.forEach((zone) => {
      zone.health = zone.maxHealth;
      zone.deformation = 0;
      this.updateCrumpleZoneVisual(zone);
    });

    this.state.health = this.stats.health;
    this.state.isDestroyed = false;
    this.state.speed = 0;
    this.state.steering = 0;
    this.state.turboCharge = 100;
    this.state.isDrifting = false;
    this.state.driftFactor = 0;

    // Reset position
    this.chassisBody.position.set(
      position?.x ?? 0,
      position?.y ?? 5,
      position?.z ?? 0
    );
    this.chassisBody.quaternion.set(0, 0, 0, 1);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);

    // Show chassis again
    if (this.chassisMesh) {
      this.chassisMesh.visible = true;
    }
    this.wheelMeshes.forEach((wheel) => {
      wheel.visible = true;
    });
  }

  public setInput(input: Partial<InputState>): void {
    Object.assign(this.input, input);
  }

  public update(): void {
    if (this.state.isDestroyed) {
      if (this.chassisGroup) {
        this.chassisGroup.visible = false;
      }
      this.wheelMeshes.forEach((wheel) => {
        wheel.visible = false;
      });
      return;
    }

    // Apply vehicle controls with dynamic driving
    this.applyDynamicControls();

    // Update state
    this.updateDynamicState();

    // Sync visuals
    this.syncVisuals();
  }

  private applyDynamicControls(): void {
    const maxSteerVal = this.stats.maxSteerVal;
    const maxForce = this.stats.maxForce * this.turboMultiplier;
    const brakeForce = this.stats.brakeForce;

    // Calculate speed for dynamic handling
    const currentSpeed = this.state.speed;
    const speedRatio = Math.min(currentSpeed / 30, 1); // Normalize to max 30 m/s

    // Dynamic steering - less responsive at high speeds
    let steering = 0;
    if (this.input.left) steering += maxSteerVal * (1 - speedRatio * 0.5);
    if (this.input.right) steering -= maxSteerVal * (1 - speedRatio * 0.5);

    this.vehicle.setSteeringValue(steering, 0);
    this.vehicle.setSteeringValue(steering, 1);

    // Engine force with turbo and weight transfer simulation
    let engineForce = 0;
    let isAccelerating = false;

    if (this.input.forward) {
      engineForce = maxForce;
      isAccelerating = true;
      
      // Turbo boost when fully charged and button held
      if (this.state.turboCharge >= 100 && this.input.fire) {
        this.activateTurbo();
      }
    } else if (this.input.backward) {
      engineForce = -maxForce * 0.7; // Reverse is slower
    }

    // Apply engine force to rear wheels only (RWD for drift capability)
    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);

    // Drift mechanics
    this.handleDrift(steering, engineForce, isAccelerating);

    // Dynamic braking with ABS simulation
    if (this.input.brake) {
      // ABS - pulse brakes at high speed
      const absPulse = currentSpeed > 15 ? 0.7 + Math.sin(Date.now() * 0.02) * 0.3 : 1;
      
      this.vehicle.setBrake(brakeForce * absPulse, 0);
      this.vehicle.setBrake(brakeForce * absPulse, 1);
      this.vehicle.setBrake(brakeForce * absPulse, 2);
      this.vehicle.setBrake(brakeForce * absPulse, 3);
    } else {
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    this.state.steering = steering;
  }

  private handleDrift(steering: number, engineForce: number, isAccelerating: boolean): void {
    const speed = this.state.speed;
    const driftThreshold = 12; // Speed threshold for drift
    
    // Check if conditions for drift are met
    const canDrift = speed > driftThreshold && Math.abs(steering) > 0.3;
    
    if (canDrift && isAccelerating) {
      // Increase drift factor
      this.state.driftFactor = Math.min(1, this.state.driftFactor + 0.02);
      this.state.isDrifting = true;
      this.driftTimer++;

      // Reduce rear wheel grip during drift
      for (let i = 2; i < 4; i++) {
        const wheel = this.vehicle.wheelInfos[i];
        wheel.frictionSlip = this.stats.grip * (1 - this.state.driftFactor * 0.6);
      }

      // Add counter-steer assist
      if (this.driftTimer > 10) {
        const counterSteer = -steering * 0.3 * this.state.driftFactor;
        this.vehicle.setSteeringValue(steering + counterSteer, 0);
        this.vehicle.setSteeringValue(steering + counterSteer, 1);
      }

      // Visual drift effect
      if (this.renderer && this.driftTimer % 5 === 0) {
        this.renderer.createTireSmoke(
          this.wheelBodies[2].position as unknown as THREE.Vector3
        );
        this.renderer.createTireSmoke(
          this.wheelBodies[3].position as unknown as THREE.Vector3
        );
      }
    } else {
      // Recover from drift
      this.state.driftFactor = Math.max(0, this.state.driftFactor - 0.05);
      this.state.isDrifting = this.state.driftFactor > 0.1;
      this.driftTimer = 0;

      // Restore grip
      for (let i = 2; i < 4; i++) {
        const wheel = this.vehicle.wheelInfos[i];
        wheel.frictionSlip = this.stats.grip;
      }
    }
  }

  private activateTurbo(): void {
    if (this.state.turboCharge < 100) return;

    this.turboMultiplier = 1.8; // 80% boost
    this.state.turboCharge = 0;

    // Visual turbo effect
    if (this.renderer) {
      const exhaustPos = new THREE.Vector3(
        this.chassisBody.position.x,
        this.chassisBody.position.y,
        this.chassisBody.position.z - 2.5
      );
      this.renderer.createTurboFlame(exhaustPos);
    }

    // Reset turbo after 3 seconds
    setTimeout(() => {
      this.turboMultiplier = 1.0;
    }, 3000);
  }

  private updateDynamicState(): void {
    // Calculate speed
    const velocity = this.chassisBody.velocity;
    this.lastSpeed = this.state.speed;
    this.state.speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    // Calculate acceleration
    this.acceleration = this.state.speed - this.lastSpeed;

    // Check if grounded
    let grounded = false;
    for (const wheel of this.vehicle.wheelInfos) {
      if (wheel.isInContact) {
        grounded = true;
        break;
      }
    }
    this.state.isGrounded = grounded;

    // Recharge turbo
    if (this.state.turboCharge < 100) {
      this.state.turboCharge = Math.min(100, this.state.turboCharge + 0.2);
    }

    // Weight transfer visualization (pitch based on acceleration)
    if (this.chassisMesh && grounded) {
      const pitchAngle = Math.atan2(this.acceleration * 0.5, 10);
      this.chassisMesh.rotation.x = pitchAngle;
    }
  }

  private syncVisuals(): void {
    if (!this.renderer || !this.chassisGroup) return;

    // Sync chassis group
    this.chassisGroup.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
    this.chassisGroup.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

    // Sync wheels
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const transform = this.vehicle.wheelInfos[i].worldTransform;

      if (this.wheelMeshes[i]) {
        this.wheelBodies[i].position.copy(transform.position);
        this.wheelBodies[i].quaternion.copy(transform.quaternion);

        this.wheelMeshes[i].position.copy(transform.position as unknown as THREE.Vector3);
        this.wheelMeshes[i].quaternion.copy(transform.quaternion as unknown as THREE.Quaternion);

        // Spin wheels based on speed
        if (i < 2) {
          // Front wheels also steer
          this.wheelMeshes[i].rotation.y = this.state.steering;
        }
      }
    }
  }

  public getState(): VehicleState {
    return { ...this.state };
  }

  public getChassisBody(): CANNON.Body {
    return this.chassisBody;
  }

  public getPosition(): Vector3 {
    return {
      x: this.chassisBody.position.x,
      y: this.chassisBody.position.y,
      z: this.chassisBody.position.z,
    };
  }

  public getRotation(): Vector3 {
    const euler = new THREE.Euler().setFromQuaternion(
      this.chassisBody.quaternion as unknown as THREE.Quaternion
    );
    return {
      x: euler.x,
      y: euler.y,
      z: euler.z,
    };
  }

  public getSpeed(): number {
    return this.state.speed;
  }

  public getHealth(): number {
    return this.state.health;
  }

  public getTurboCharge(): number {
    return this.state.turboCharge;
  }

  public isDrifting(): boolean {
    return this.state.isDrifting;
  }

  public getVelocity(): Vector3 {
    return {
      x: this.chassisBody.velocity.x,
      y: this.chassisBody.velocity.y,
      z: this.chassisBody.velocity.z,
    };
  }

  public getForwardVector(): Vector3 {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.chassisBody.quaternion as unknown as THREE.Quaternion);
    return {
      x: forward.x,
      y: forward.y,
      z: forward.z,
    };
  }

  public getMaxHealth(): number {
    return this.stats.health;
  }

  public dispose(): void {
    // Remove physics bodies
    this.physics.getWorld().removeBody(this.chassisBody);
    this.wheelBodies.forEach((body) => {
      this.physics.getWorld().removeBody(body);
    });

    // Remove visual meshes
    if (this.renderer) {
      if (this.chassisGroup) {
        this.renderer.getScene().remove(this.chassisGroup);
      }
      this.wheelMeshes.forEach((mesh) => {
        this.renderer!.getScene().remove(mesh);
      });
    }
  }
}
