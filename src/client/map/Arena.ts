import { 
  MapConfig, 
  Vector3, 
  ObstacleData, 
  PowerUpType, 
  PowerUpData,
  calculateMapSize,
  generateSpawnPoints,
} from '../../shared/types';
import { Physics } from '../physics/Physics';
import { Renderer } from '../renderer/Renderer';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface ArenaConfig {
  playerCount: number;
  seed?: number;
}

export interface PowerUpSpawn {
  id: string;
  position: Vector3;
  type: PowerUpType;
  respawnTime: number;
  isActive: boolean;
  lastPickupTime?: number;
}

export class Arena {
  private config: MapConfig;
  private physics: Physics;
  private renderer?: Renderer;
  
  private obstacles: Map<string, ObstacleData> = new Map();
  private powerUps: Map<string, PowerUpSpawn> = new Map();
  private obstacleMeshes: Map<string, THREE.Mesh> = new Map();
  private powerUpMeshes: Map<string, THREE.Mesh> = new Map();

  constructor(config: ArenaConfig, physics: Physics, renderer?: Renderer) {
    this.physics = physics;
    this.renderer = renderer;
    
    const mapSize = calculateMapSize(config.playerCount);
    const spawnPoints = generateSpawnPoints(config.playerCount, mapSize);
    
    this.config = {
      size: mapSize,
      playerCount: config.playerCount,
      obstacles: [],
      spawnPoints,
      powerUpSpawns: this.generatePowerUpSpawns(mapSize),
    };

    this.createArena();
    this.createPowerUps();
  }

  private createArena(): void {
    this.createGround();
    this.createBoundaries();
    this.createObstacles();
  }

  private createGround(): void {
    // Create visual ground
    if (this.renderer) {
      const geometry = new THREE.PlaneGeometry(this.config.size, this.config.size);
      const material = new THREE.MeshStandardMaterial({
        color: 0x4a5d4a,
        roughness: 0.9,
        metalness: 0.0,
      });
      const ground = new THREE.Mesh(geometry, material);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.renderer.getScene().add(ground);

      // Add grid helper
      const grid = new THREE.GridHelper(this.config.size, 20, 0x444444, 0x666666);
      this.renderer.getScene().add(grid);
    }

    // Create physics ground
    this.physics.createGroundPlane('arena_ground', 'ground');
  }

  private createBoundaries(): void {
    const halfSize = this.config.size / 2;
    const wallHeight = 15;
    const wallThickness = 10;

    const walls = [
      { name: 'north', pos: { x: 0, y: wallHeight / 2, z: -halfSize - wallThickness / 2 }, size: { w: this.config.size + wallThickness * 2, h: wallHeight, d: wallThickness } },
      { name: 'south', pos: { x: 0, y: wallHeight / 2, z: halfSize + wallThickness / 2 }, size: { w: this.config.size + wallThickness * 2, h: wallHeight, d: wallThickness } },
      { name: 'east', pos: { x: halfSize + wallThickness / 2, y: wallHeight / 2, z: 0 }, size: { w: wallThickness, h: wallHeight, d: this.config.size } },
      { name: 'west', pos: { x: -halfSize - wallThickness / 2, y: wallHeight / 2, z: 0 }, size: { w: wallThickness, h: wallHeight, d: this.config.size } },
    ];

    walls.forEach((wall) => {
      // Physics
      this.physics.createBox(`wall_${wall.name}`, wall.size.w, wall.size.h, wall.size.d, {
        mass: 0,
        position: wall.pos,
        material: 'obstacle',
      });

      // Visual
      if (this.renderer) {
        const color = 0x666666;
        const mesh = this.renderer.createBox(
          `wall_${wall.name}_visual`,
          wall.size.w,
          wall.size.h,
          wall.size.d,
          color,
          new THREE.Vector3(wall.pos.x, wall.pos.y, wall.pos.z)
        );
        this.obstacleMeshes.set(`wall_${wall.name}`, mesh);
      }
    });
  }

  private createObstacles(): void {
    const obstacleCount = Math.max(10, Math.floor(this.config.size / 100));
    const margin = 50;
    const halfSize = this.config.size / 2 - margin;

    for (let i = 0; i < obstacleCount; i++) {
      const x = (Math.random() - 0.5) * 2 * halfSize;
      const z = (Math.random() - 0.5) * 2 * halfSize;
      
      // Don't spawn too close to spawn points
      let tooClose = false;
      for (const spawn of this.config.spawnPoints) {
        const dist = Math.sqrt((x - spawn.x) ** 2 + (z - spawn.z) ** 2);
        if (dist < 30) {
          tooClose = true;
          break;
        }
      }
      
      if (tooClose) continue;

      const type = Math.random();
      const id = `obstacle_${i}`;

      if (type < 0.4) {
        this.createBoxObstacle(id, x, z);
      } else if (type < 0.7) {
        this.createCylinderObstacle(id, x, z);
      } else {
        this.createRampObstacle(id, x, z);
      }
    }
  }

  private createBoxObstacle(id: string, x: number, z: number): void {
    const size = 8 + Math.random() * 12;
    const height = size * (0.8 + Math.random() * 0.4);
    const y = height / 2;
    const rotation = Math.random() * Math.PI * 2;

    const obstacle: ObstacleData = {
      position: { x, y, z },
      size: { x: size, y: height, z: size },
      rotation: { x: 0, y: 0, z: Math.sin(rotation / 2), w: Math.cos(rotation / 2) },
      type: 'box',
      destructible: false,
    };

    this.obstacles.set(id, obstacle);

    // Physics
    this.physics.createBox(id, size, height, size, {
      mass: 0,
      position: { x, y, z },
      rotation: obstacle.rotation,
      material: 'obstacle',
    });

    // Visual
    if (this.renderer) {
      const colors = [0x8B4513, 0x696969, 0x556B2F, 0x8B7355];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mesh = this.renderer.createBox(`${id}_visual`, size, height, size, color, new THREE.Vector3(x, y, z));
      mesh.rotation.y = rotation;
      this.obstacleMeshes.set(id, mesh);
    }
  }

  private createCylinderObstacle(id: string, x: number, z: number): void {
    const radius = 4 + Math.random() * 6;
    const height = 8 + Math.random() * 12;
    const y = height / 2;

    const obstacle: ObstacleData = {
      position: { x, y, z },
      size: { x: radius * 2, y: height, z: radius * 2 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      type: 'cylinder',
      destructible: false,
    };

    this.obstacles.set(id, obstacle);

    // Physics
    this.physics.createCylinder(id, radius, height, 16, {
      mass: 0,
      position: { x, y, z },
      material: 'obstacle',
    });

    // Visual
    if (this.renderer) {
      const mesh = this.renderer.createCylinder(`${id}_visual`, radius, radius, height, 0x696969, new THREE.Vector3(x, y, z));
      this.obstacleMeshes.set(id, mesh);
    }
  }

  private createRampObstacle(id: string, x: number, z: number): void {
    const width = 15 + Math.random() * 10;
    const length = 25 + Math.random() * 15;
    const height = 6 + Math.random() * 6;
    const y = height / 4;
    const rotation = Math.random() * Math.PI * 2;

    const obstacle: ObstacleData = {
      position: { x, y, z },
      size: { x: width, y: height / 2, z: length },
      rotation: { x: -Math.PI / 10, y: 0, z: Math.sin(rotation / 2), w: Math.cos(rotation / 2) },
      type: 'ramp',
      destructible: false,
    };

    this.obstacles.set(id, obstacle);

    // Physics - angled box for ramp
    this.physics.createBox(id, width, height / 2, length, {
      mass: 0,
      position: { x, y, z },
      rotation: obstacle.rotation,
      material: 'obstacle',
    });

    // Visual
    if (this.renderer) {
      const mesh = this.renderer.createBox(`${id}_visual`, width, height / 2, length, 0x8B7355, new THREE.Vector3(x, y, z));
      mesh.rotation.x = obstacle.rotation.x;
      mesh.rotation.y = rotation;
      this.obstacleMeshes.set(id, mesh);
    }
  }

  private generatePowerUpSpawns(mapSize: number): Vector3[] {
    const spawns: Vector3[] = [];
    const count = Math.max(5, Math.floor(mapSize / 200));
    const margin = 100;
    const halfSize = mapSize / 2 - margin;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 2 * halfSize;
      const z = (Math.random() - 0.5) * 2 * halfSize;
      spawns.push({ x, y: 2, z });
    }

    return spawns;
  }

  private createPowerUps(): void {
    const types: PowerUpType[] = ['health', 'shield', 'speed', 'ammo'];
    
    this.config.powerUpSpawns.forEach((pos, index) => {
      const type = types[index % types.length];
      const powerUp: PowerUpSpawn = {
        id: `powerup_${index}`,
        position: pos,
        type,
        respawnTime: 15000, // 15 seconds
        isActive: true,
      };

      this.powerUps.set(powerUp.id, powerUp);
      this.createPowerUpVisual(powerUp);
    });
  }

  private createPowerUpVisual(powerUp: PowerUpSpawn): void {
    if (!this.renderer) return;

    const colors: Record<PowerUpType, number> = {
      health: 0x00ff00,
      shield: 0x0088ff,
      speed: 0xffff00,
      weapon: 0xff00ff,
      ammo: 0xff8800,
    };

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({
      color: colors[powerUp.type],
      emissive: colors[powerUp.type],
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(powerUp.position.x, powerUp.position.y, powerUp.position.z);
    mesh.castShadow = true;
    
    // Add rotation animation
    const animate = () => {
      if (!mesh.parent) return;
      mesh.rotation.y += 0.02;
      mesh.rotation.x += 0.01;
      requestAnimationFrame(animate);
    };
    animate();

    this.renderer.getScene().add(mesh);
    this.powerUpMeshes.set(powerUp.id, mesh);
  }

  public update(deltaTime: number): void {
    // Update power-up respawns
    const now = Date.now();
    
    this.powerUps.forEach((powerUp) => {
      if (!powerUp.isActive && powerUp.lastPickupTime) {
        const elapsed = now - powerUp.lastPickupTime;
        if (elapsed >= powerUp.respawnTime) {
          this.respawnPowerUp(powerUp.id);
        }
      }
    });
  }

  private respawnPowerUp(id: string): void {
    const powerUp = this.powerUps.get(id);
    if (powerUp) {
      powerUp.isActive = true;
      powerUp.lastPickupTime = undefined;

      const mesh = this.powerUpMeshes.get(id);
      if (mesh) {
        mesh.visible = true;
      }
    }
  }

  public pickupPowerUp(id: string): PowerUpData | null {
    const powerUp = this.powerUps.get(id);
    if (!powerUp || !powerUp.isActive) return null;

    powerUp.isActive = false;
    powerUp.lastPickupTime = Date.now();

    const mesh = this.powerUpMeshes.get(id);
    if (mesh) {
      mesh.visible = false;
    }

    return this.getPowerUpData(powerUp.type);
  }

  private getPowerUpData(type: PowerUpType): PowerUpData {
    const data: Record<PowerUpType, PowerUpData> = {
      health: { type: 'health', value: 25 },
      shield: { type: 'shield', value: 25 },
      speed: { type: 'speed', value: 1.5, duration: 10000 },
      weapon: { type: 'weapon', value: 1 },
      ammo: { type: 'ammo', value: 50 },
    };

    return data[type];
  }

  public checkPowerUpCollision(position: Vector3, radius: number = 3): string | null {
    for (const [id, powerUp] of this.powerUps) {
      if (!powerUp.isActive) continue;

      const dx = position.x - powerUp.position.x;
      const dy = position.y - powerUp.position.y;
      const dz = position.z - powerUp.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < radius) {
        return id;
      }
    }

    return null;
  }

  // Getters
  public getSpawnPoints(): Vector3[] {
    return [...this.config.spawnPoints];
  }

  public getSize(): number {
    return this.config.size;
  }

  public getObstacles(): Map<string, ObstacleData> {
    return this.obstacles;
  }

  public getPowerUps(): Map<string, PowerUpSpawn> {
    return this.powerUps;
  }

  public isInsideArena(position: Vector3): boolean {
    const halfSize = this.config.size / 2;
    return (
      position.x >= -halfSize &&
      position.x <= halfSize &&
      position.z >= -halfSize &&
      position.z <= halfSize
    );
  }

  public getRandomPosition(): Vector3 {
    const margin = 50;
    const halfSize = this.config.size / 2 - margin;
    return {
      x: (Math.random() - 0.5) * 2 * halfSize,
      y: 5,
      z: (Math.random() - 0.5) * 2 * halfSize,
    };
  }

  public dispose(): void {
    // Remove obstacle meshes
    this.obstacleMeshes.forEach((mesh) => {
      if (this.renderer) {
        this.renderer.getScene().remove(mesh);
      }
    });
    this.obstacleMeshes.clear();

    // Remove power-up meshes
    this.powerUpMeshes.forEach((mesh) => {
      if (this.renderer) {
        this.renderer.getScene().remove(mesh);
      }
    });
    this.powerUpMeshes.clear();

    // Clear data
    this.obstacles.clear();
    this.powerUps.clear();
  }
}
