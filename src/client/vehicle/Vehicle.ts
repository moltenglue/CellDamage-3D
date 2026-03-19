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

export interface VehicleState {
  speed: number;
  steering: number;
  health: number;
  isDestroyed: boolean;
  isGrounded: boolean;
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

  // Visual offsets
  private wheelOffset = 0.3; // Visual offset from physics wheel

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
    };

    this.chassisBody = this.createChassis(config.position, config.rotation);
    this.vehicle = this.createVehicle();

    if (renderer) {
      this.createVisuals();
    }
  }

  private createChassis(position?: Vector3, rotation?: Vector3): CANNON.Body {
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.2, 0.5, 2.5));
    const chassisBody = new CANNON.Body({
      mass: this.stats.mass,
      material: this.physics.getMaterial('vehicle'),
    });

    chassisBody.addShape(chassisShape);

    if (position) {
      chassisBody.position.set(position.x, position.y, position.z);
    } else {
      chassisBody.position.set(0, 5, 0);
    }

    if (rotation) {
      chassisBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
    }

    chassisBody.linearDamping = 0.01;
    chassisBody.angularDamping = 0.5;

    this.physics.getWorld().addBody(chassisBody);

    // Add collision listener for damage
    this.physics.onCollision(this.id, (event) => {
      this.handleCollision(event.velocity);
    });

    return chassisBody;
  }

  private createVehicle(): CANNON.RaycastVehicle {
    const vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

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

    // Front left
    wheelOptions.chassisConnectionPointLocal.set(1, 0, 1.8);
    vehicle.addWheel(wheelOptions);

    // Front right
    wheelOptions.chassisConnectionPointLocal.set(-1, 0, 1.8);
    vehicle.addWheel(wheelOptions);

    // Rear left
    wheelOptions.chassisConnectionPointLocal.set(1, 0, -1.8);
    vehicle.addWheel(wheelOptions);

    // Rear right
    wheelOptions.chassisConnectionPointLocal.set(-1, 0, -1.8);
    vehicle.addWheel(wheelOptions);

    vehicle.addToWorld(this.physics.getWorld());

    // Create wheel bodies for visuals
    const wheelBodies: CANNON.Body[] = [];
    for (let i = 0; i < vehicle.wheelInfos.length; i++) {
      const wheelBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0, // Don't collide
      });
      const wheelShape = new CANNON.Cylinder(wheelOptions.radius, wheelOptions.radius, 0.4, 16);
      wheelBody.addShape(wheelShape, new CANNON.Vec3(0, 0, 0), new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0));
      wheelBodies.push(wheelBody);
      this.physics.getWorld().addBody(wheelBody);
    }
    this.wheelBodies = wheelBodies;

    return vehicle;
  }

  private createVisuals(): void {
    if (!this.renderer) return;

    // Create chassis mesh
    const chassisGeometry = new THREE.BoxGeometry(2.4, 1, 5);
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: this.getVehicleColor(),
      roughness: 0.4,
      metalness: 0.6,
    });
    this.chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial);
    this.chassisMesh.castShadow = true;
    this.chassisMesh.receiveShadow = true;
    this.renderer.getScene().add(this.chassisMesh);

    // Create wheel meshes
    for (let i = 0; i < 4; i++) {
      const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 32);
      const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1,
      });
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;
      this.renderer.getScene().add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    }

    // Add weapon mount point
    this.createWeaponMount();
  }

  private createWeaponMount(): void {
    if (!this.renderer || !this.chassisMesh) return;

    // Create turret/mount
    const mountGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 16);
    const mountMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.8,
    });
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.set(0, 0.6, 0);
    this.chassisMesh.add(mount);
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

  private handleCollision(velocity: number): void {
    const COLLISION_DAMAGE_THRESHOLD = 10;
    const COLLISION_DAMAGE_MULTIPLIER = 2;

    if (velocity > COLLISION_DAMAGE_THRESHOLD) {
      const damage = Math.floor((velocity - COLLISION_DAMAGE_THRESHOLD) * COLLISION_DAMAGE_MULTIPLIER);
      this.takeDamage(damage);
    }
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
    this.state.health = this.stats.health;
    this.state.isDestroyed = false;
    this.state.speed = 0;
    this.state.steering = 0;

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
    this.wheelMeshes.forEach(wheel => {
      wheel.visible = true;
    });
  }

  public setInput(input: Partial<InputState>): void {
    Object.assign(this.input, input);
  }

  public update(): void {
    if (this.state.isDestroyed) {
      if (this.chassisMesh) {
        this.chassisMesh.visible = false;
      }
      this.wheelMeshes.forEach(wheel => {
        wheel.visible = false;
      });
      return;
    }

    // Apply vehicle controls
    this.applyControls();

    // Update state
    this.updateState();

    // Sync visuals
    this.syncVisuals();
  }

  private applyControls(): void {
    const maxSteerVal = this.stats.maxSteerVal;
    const maxForce = this.stats.maxForce;
    const brakeForce = this.stats.brakeForce;

    // Steering
    let steering = 0;
    if (this.input.left) steering += maxSteerVal;
    if (this.input.right) steering -= maxSteerVal;

    this.vehicle.setSteeringValue(steering, 0);
    this.vehicle.setSteeringValue(steering, 1);

    // Engine force
    let engineForce = 0;
    if (this.input.forward) {
      engineForce = maxForce;
    } else if (this.input.backward) {
      engineForce = -maxForce * 0.6; // Reverse is slower
    }

    this.vehicle.applyEngineForce(engineForce, 2); // Rear left
    this.vehicle.applyEngineForce(engineForce, 3); // Rear right

    // Braking
    if (this.input.brake) {
      this.vehicle.setBrake(brakeForce, 0);
      this.vehicle.setBrake(brakeForce, 1);
      this.vehicle.setBrake(brakeForce, 2);
      this.vehicle.setBrake(brakeForce, 3);
    } else {
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    this.state.steering = steering;
  }

  private updateState(): void {
    // Calculate speed
    const velocity = this.chassisBody.velocity;
    this.state.speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    // Check if grounded
    let grounded = false;
    for (const wheel of this.vehicle.wheelInfos) {
      if (wheel.isInContact) {
        grounded = true;
        break;
      }
    }
    this.state.isGrounded = grounded;
  }

  private syncVisuals(): void {
    if (!this.renderer) return;

    // Sync chassis
    if (this.chassisMesh) {
      this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
      this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);
    }

    // Sync wheels
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const transform = this.vehicle.wheelInfos[i].worldTransform;
      
      if (this.wheelMeshes[i]) {
        this.wheelBodies[i].position.copy(transform.position);
        this.wheelBodies[i].quaternion.copy(transform.rotation);
        
        this.wheelMeshes[i].position.copy(transform.position as unknown as THREE.Vector3);
        this.wheelMeshes[i].quaternion.copy(transform.rotation as unknown as THREE.Quaternion);
      }
    }
  }

  // Getters
  public getPosition(): Vector3 {
    return {
      x: this.chassisBody.position.x,
      y: this.chassisBody.position.y,
      z: this.chassisBody.position.z,
    };
  }

  public getRotation(): CANNON.Quaternion {
    return this.chassisBody.quaternion;
  }

  public getVelocity(): Vector3 {
    return {
      x: this.chassisBody.velocity.x,
      y: this.chassisBody.velocity.y,
      z: this.chassisBody.velocity.z,
    };
  }

  public getForwardVector(): Vector3 {
    const forward = new CANNON.Vec3(0, 0, 1);
    this.chassisBody.quaternion.vmult(forward, forward);
    return { x: forward.x, y: forward.y, z: forward.z };
  }

  public getState(): VehicleState {
    return { ...this.state };
  }

  public getHealth(): number {
    return this.state.health;
  }

  public getMaxHealth(): number {
    return this.stats.health;
  }

  public getChassisBody(): CANNON.Body {
    return this.chassisBody;
  }

  public dispose(): void {
    // Remove physics
    this.vehicle.removeFromWorld(this.physics.getWorld());
    this.physics.getWorld().removeBody(this.chassisBody);
    
    this.wheelBodies.forEach((body) => {
      this.physics.getWorld().removeBody(body);
    });

    // Remove visuals
    if (this.renderer) {
      if (this.chassisMesh) {
        this.renderer.getScene().remove(this.chassisMesh);
        this.chassisMesh.geometry.dispose();
        if (Array.isArray(this.chassisMesh.material)) {
          this.chassisMesh.material.forEach(m => m.dispose());
        } else {
          this.chassisMesh.material.dispose();
        }
      }

      this.wheelMeshes.forEach((mesh) => {
        this.renderer!.getScene().remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      });
    }
  }
}
