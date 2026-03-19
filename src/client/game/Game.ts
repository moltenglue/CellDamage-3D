import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Renderer } from '../renderer/Renderer';
import { Physics } from '../physics/Physics';
import { Vehicle } from '../vehicle/Vehicle';
import { 
  InputState, 
  GameMode, 
  GameModeConfig, 
  Player,
  VehicleType,
  generateId,
  calculateMapSize,
  generateSpawnPoints,
  Vector3,
  Projectile,
  WeaponType,
  DamageEvent,
  COLLISION_DAMAGE_THRESHOLD,
} from '../../shared/types';

export interface GameConfig {
  container: HTMLElement;
  playerName: string;
  vehicleType: VehicleType;
  gameMode: GameMode;
  maxPlayers?: number;
  timeLimit?: number;
  enableAI?: boolean;
  aiCount?: number;
}

export interface GameCallbacks {
  onScoreUpdate?: (playerId: string, score: number) => void;
  onPlayerDeath?: (playerId: string, killerId?: string) => void;
  onGameEnd?: (winner: Player) => void;
  onTimeUpdate?: (timeRemaining: number) => void;
}

export class Game {
  private renderer: Renderer;
  private physics: Physics;
  private config: GameConfig;
  private callbacks: GameCallbacks;
  private gameModeConfig: GameModeConfig;

  // Game state
  private players: Map<string, Player> = new Map();
  private vehicles: Map<string, Vehicle> = new Map();
  private projectiles: Map<string, Projectile> = new Map();
  private localPlayerId: string;
  private localVehicleId: string;

  // Timing
  private startTime = 0;
  private isRunning = false;
  private isPaused = false;
  private lastUpdateTime = 0;

  // Input
  private inputState: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    fire: false,
    aimX: 0,
    aimY: 0,
  };
  private keysPressed: Set<string> = new Set();

  // Map
  private mapSize: number;
  private spawnPoints: Vector3[] = [];

  constructor(config: GameConfig, callbacks: GameCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;

    // Initialize renderer
    this.renderer = new Renderer({
      container: config.container,
      antialias: true,
      shadows: true,
    });

    // Initialize physics
    this.physics = new Physics();

    // Setup game mode config
    const maxPlayers = config.maxPlayers || 8;
    this.mapSize = calculateMapSize(maxPlayers);
    this.gameModeConfig = {
      mode: config.gameMode,
      maxPlayers,
      timeLimit: config.timeLimit || 600, // 10 minutes default
      respawnDelay: 3000,
      mapSize: this.mapSize,
    };

    // Generate spawn points
    this.spawnPoints = generateSpawnPoints(maxPlayers, this.mapSize);

    // Create local player
    this.localPlayerId = generateId();
    this.localVehicleId = `vehicle_${this.localPlayerId}`;

    // Setup input handling
    this.setupInputHandlers();

    // Create map
    this.createMap();

    // Create local player vehicle
    this.createPlayer(config.playerName, config.vehicleType, true);

    // Create AI opponents if enabled
    if (config.enableAI && config.aiCount) {
      this.createAIPlayers(config.aiCount);
    }
  }

  private createMap(): void {
    // Create ground
    this.renderer.createGround(this.mapSize, 0x4a5d4a);
    this.renderer.createGridHelper(this.mapSize, 20);

    // Create ground physics
    this.physics.createGroundPlane('ground', 'ground');

    // Create boundary walls
    const halfSize = this.mapSize / 2;
    const wallHeight = 10;
    const wallThickness = 5;

    // North wall
    this.physics.createBox('wall_north', this.mapSize + wallThickness * 2, wallHeight, wallThickness, {
      mass: 0,
      position: { x: 0, y: wallHeight / 2, z: -halfSize - wallThickness / 2 },
      material: 'obstacle',
    });
    this.renderer.createBox('wall_north_visual', this.mapSize + wallThickness * 2, wallHeight, wallThickness, 0x666666, 
      new THREE.Vector3(0, wallHeight / 2, -halfSize - wallThickness / 2));

    // South wall
    this.physics.createBox('wall_south', this.mapSize + wallThickness * 2, wallHeight, wallThickness, {
      mass: 0,
      position: { x: 0, y: wallHeight / 2, z: halfSize + wallThickness / 2 },
      material: 'obstacle',
    });
    this.renderer.createBox('wall_south_visual', this.mapSize + wallThickness * 2, wallHeight, wallThickness, 0x666666,
      new THREE.Vector3(0, wallHeight / 2, halfSize + wallThickness / 2));

    // East wall
    this.physics.createBox('wall_east', wallThickness, wallHeight, this.mapSize, {
      mass: 0,
      position: { x: halfSize + wallThickness / 2, y: wallHeight / 2, z: 0 },
      material: 'obstacle',
    });
    this.renderer.createBox('wall_east_visual', wallThickness, wallHeight, this.mapSize, 0x666666,
      new THREE.Vector3(halfSize + wallThickness / 2, wallHeight / 2, 0));

    // West wall
    this.physics.createBox('wall_west', wallThickness, wallHeight, this.mapSize, {
      mass: 0,
      position: { x: -halfSize - wallThickness / 2, y: wallHeight / 2, z: 0 },
      material: 'obstacle',
    });
    this.renderer.createBox('wall_west_visual', wallThickness, wallHeight, this.mapSize, 0x666666,
      new THREE.Vector3(-halfSize - wallThickness / 2, wallHeight / 2, 0));

    // Add some obstacles
    this.createObstacles();
  }

  private createObstacles(): void {
    const obstacleCount = Math.floor(this.mapSize / 100);
    const halfSize = this.mapSize / 2 - 50;

    for (let i = 0; i < obstacleCount; i++) {
      const x = (Math.random() - 0.5) * 2 * halfSize;
      const z = (Math.random() - 0.5) * 2 * halfSize;
      const type = Math.random();

      if (type < 0.33) {
        // Box
        const size = 10 + Math.random() * 15;
        this.physics.createBox(`obstacle_${i}`, size, size, size, {
          mass: 0,
          position: { x, y: size / 2, z },
          material: 'obstacle',
        });
        this.renderer.createBox(`obstacle_${i}_visual`, size, size, size, 0x8B4513, new THREE.Vector3(x, size / 2, z));
      } else if (type < 0.66) {
        // Cylinder
        const radius = 5 + Math.random() * 10;
        const height = 10 + Math.random() * 20;
        this.physics.createCylinder(`obstacle_${i}`, radius, height, 8, {
          mass: 0,
          position: { x, y: height / 2, z },
          material: 'obstacle',
        });
        this.renderer.createCylinder(`obstacle_${i}_visual`, radius, radius, height, 0x696969, new THREE.Vector3(x, height / 2, z));
      } else {
        // Ramp
        const width = 20;
        const length = 30;
        const height = 8;
        this.physics.createBox(`obstacle_${i}`, width, height / 2, length, {
          mass: 0,
          position: { x, y: height / 4, z },
          rotation: { x: -Math.PI / 8, y: Math.random() * Math.PI * 2, z: 0, w: 1 },
          material: 'obstacle',
        });
      }
    }
  }

  private createPlayer(name: string, vehicleType: VehicleType, isLocal: boolean): string {
    const playerId = isLocal ? this.localPlayerId : generateId();
    const vehicleId = `vehicle_${playerId}`;
    const spawnPoint = this.getNextSpawnPoint();

    // Create player
    const player: Player = {
      id: playerId,
      name,
      health: 100,
      maxHealth: 100,
      shield: 0,
      score: 0,
      kills: 0,
      deaths: 0,
      vehicleType,
      isAlive: true,
      lastSpawnTime: Date.now(),
      position: spawnPoint,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    };

    this.players.set(playerId, player);

    // Create vehicle
    const vehicle = new Vehicle(
      {
        id: vehicleId,
        type: vehicleType,
        position: spawnPoint,
        playerId,
      },
      this.physics,
      this.renderer
    );

    this.vehicles.set(vehicleId, vehicle);

    if (isLocal) {
      this.localVehicleId = vehicleId;
    }

    return playerId;
  }

  private createAIPlayers(count: number): void {
    const aiNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    const vehicleTypes: VehicleType[] = ['speedster', 'tank', 'balanced'];

    for (let i = 0; i < count && i < aiNames.length; i++) {
      const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      this.createPlayer(`AI ${aiNames[i]}`, vehicleType, false);
    }
  }

  private getNextSpawnPoint(): Vector3 {
    const index = this.players.size % this.spawnPoints.length;
    return this.spawnPoints[index];
  }

  private setupInputHandlers(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.handleKeyDown(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.handleKeyUp(e.key.toLowerCase());
    });

    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.inputState.aimX = (e.clientX / window.innerWidth) * 2 - 1;
      this.inputState.aimY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.inputState.fire = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.inputState.fire = false;
      }
    });

    // Prevent context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleKeyDown(key: string): void {
    this.keysPressed.add(key);
    this.updateInputState();
  }

  private handleKeyUp(key: string): void {
    this.keysPressed.delete(key);
    this.updateInputState();
  }

  private updateInputState(): void {
    this.inputState.forward = this.keysPressed.has('w') || this.keysPressed.has('arrowup');
    this.inputState.backward = this.keysPressed.has('s') || this.keysPressed.has('arrowdown');
    this.inputState.left = this.keysPressed.has('a') || this.keysPressed.has('arrowleft');
    this.inputState.right = this.keysPressed.has('d') || this.keysPressed.has('arrowright');
    this.inputState.brake = this.keysPressed.has(' ');
  }

  public start(): void {
    this.isRunning = true;
    this.startTime = Date.now();
    this.lastUpdateTime = performance.now();

    // Start render loop
    this.renderer.render((deltaTime) => {
      this.update(deltaTime);
    });
  }

  public stop(): void {
    this.isRunning = false;
    this.renderer.stop();
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.lastUpdateTime = performance.now();
  }

  private update(deltaTime: number): void {
    if (!this.isRunning || this.isPaused) return;

    // Update physics
    this.physics.step(deltaTime);

    // Update local vehicle input
    const localVehicle = this.vehicles.get(this.localVehicleId);
    if (localVehicle) {
      localVehicle.setInput(this.inputState);
    }

    // Update all vehicles
    this.vehicles.forEach((vehicle) => {
      vehicle.update();
    });

    // Update camera to follow local vehicle
    if (localVehicle) {
      const vehiclePos = localVehicle.getPosition();
      const offset = new THREE.Vector3(0, 8, -12);
      const cameraPos = new THREE.Vector3(vehiclePos.x, vehiclePos.y, vehiclePos.z).add(offset);
      this.renderer.followObject(this.localVehicleId, offset);
    }

    // Update projectiles
    this.updateProjectiles(deltaTime);

    // Check game end conditions
    this.checkGameEnd();

    // Update time callback
    if (this.callbacks.onTimeUpdate) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const remaining = Math.max(0, this.gameModeConfig.timeLimit - elapsed);
      this.callbacks.onTimeUpdate(remaining);
    }
  }

  private updateProjectiles(deltaTime: number): void {
    const now = Date.now();
    
    this.projectiles.forEach((projectile, id) => {
      // Update position based on velocity
      projectile.position.x += projectile.velocity.x * deltaTime;
      projectile.position.y += projectile.velocity.y * deltaTime;
      projectile.position.z += projectile.velocity.z * deltaTime;

      // Check lifetime
      if (now - projectile.createdAt > 5000) {
        this.removeProjectile(id);
        return;
      }

      // Raycast for collision
      const start = {
        x: projectile.position.x - projectile.velocity.x * deltaTime * 0.5,
        y: projectile.position.y - projectile.velocity.y * deltaTime * 0.5,
        z: projectile.position.z - projectile.velocity.z * deltaTime * 0.5,
      };
      const end = {
        x: projectile.position.x + projectile.velocity.x * deltaTime * 0.5,
        y: projectile.position.y + projectile.velocity.y * deltaTime * 0.5,
        z: projectile.position.z + projectile.velocity.z * deltaTime * 0.5,
      };

      const hit = this.physics.raycast(start, end);
      if (hit) {
        this.handleProjectileHit(projectile, hit);
      }
    });
  }

  private handleProjectileHit(projectile: Projectile, hit: { body: CANNON.Body; point: Vector3 }): void {
    // Find if we hit a vehicle
    let hitVehicle: Vehicle | undefined;
    this.vehicles.forEach((vehicle) => {
      if (vehicle.getChassisBody() === hit.body && vehicle.playerId !== projectile.ownerId) {
        hitVehicle = vehicle;
      }
    });

    if (hitVehicle) {
      const damage: DamageEvent = {
        targetId: hitVehicle.playerId,
        sourceId: projectile.ownerId,
        damage: 20,
        damageType: 'projectile',
        position: hit.point,
        weaponType: projectile.weaponType,
      };
      this.applyDamage(damage);
    }

    // Create explosion effect
    this.renderer.createExplosion(hit.point as unknown as THREE.Vector3, 1);

    // Remove projectile
    this.removeProjectile(projectile.id);
  }

  private applyDamage(event: DamageEvent): void {
    const target = this.players.get(event.targetId);
    const source = this.players.get(event.sourceId);

    if (!target || !target.isAlive) return;

    // Apply damage to vehicle
    const vehicle = this.vehicles.get(`vehicle_${event.targetId}`);
    if (vehicle) {
      vehicle.takeDamage(event.damage);

      // Check for kill
      if (vehicle.getHealth() <= 0 && target.isAlive) {
        this.handleKill(event.targetId, event.sourceId);
      }
    }
  }

  private handleKill(victimId: string, killerId: string): void {
    const victim = this.players.get(victimId);
    const killer = this.players.get(killerId);

    if (victim) {
      victim.isAlive = false;
      victim.deaths++;
      victim.score -= 50;

      if (this.callbacks.onPlayerDeath) {
        this.callbacks.onPlayerDeath(victimId, killerId);
      }
    }

    if (killer && killer.id !== victimId) {
      killer.kills++;
      killer.score += 100;

      if (this.callbacks.onScoreUpdate) {
        this.callbacks.onScoreUpdate(killerId, killer.score);
      }
    }

    // Respawn victim
    setTimeout(() => {
      this.respawnPlayer(victimId);
    }, this.gameModeConfig.respawnDelay);
  }

  private respawnPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    const vehicle = this.vehicles.get(`vehicle_${playerId}`);

    if (player && vehicle) {
      const spawnPoint = this.getNextSpawnPoint();
      player.isAlive = true;
      player.position = spawnPoint;
      player.health = player.maxHealth;
      player.lastSpawnTime = Date.now();

      vehicle.respawn(spawnPoint);
    }
  }

  private checkGameEnd(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;

    if (elapsed >= this.gameModeConfig.timeLimit) {
      this.endGame();
    }
  }

  private endGame(): void {
    this.isRunning = false;

    // Find winner (highest score)
    let winner: Player | undefined;
    let maxScore = -Infinity;

    this.players.forEach((player) => {
      if (player.score > maxScore) {
        maxScore = player.score;
        winner = player;
      }
    });

    if (winner && this.callbacks.onGameEnd) {
      this.callbacks.onGameEnd(winner);
    }
  }

  public fireWeapon(playerId: string, weaponType: WeaponType): void {
    const vehicle = this.vehicles.get(`vehicle_${playerId}`);
    if (!vehicle || vehicle.getState().isDestroyed) return;

    const position = vehicle.getPosition();
    const forward = vehicle.getForwardVector();
    
    // Spawn projectile slightly in front of vehicle
    const spawnPos = {
      x: position.x + forward.x * 3,
      y: position.y + 1,
      z: position.z + forward.z * 3,
    };

    const projectile: Projectile = {
      id: generateId(),
      ownerId: playerId,
      position: spawnPos,
      velocity: {
        x: forward.x * 80,
        y: 0,
        z: forward.z * 80,
      },
      weaponType,
      createdAt: Date.now(),
      hasExploded: false,
    };

    this.projectiles.set(projectile.id, projectile);

    // Visual muzzle flash
    const muzzlePos = new THREE.Vector3(spawnPos.x, spawnPos.y, spawnPos.z);
    const direction = new THREE.Vector3(forward.x, forward.y, forward.z);
    this.renderer.createMuzzleFlash(muzzlePos, direction);
  }

  private removeProjectile(id: string): void {
    this.projectiles.delete(id);
  }

  // Getters
  public getLocalPlayer(): Player | undefined {
    return this.players.get(this.localPlayerId);
  }

  public getLocalVehicle(): Vehicle | undefined {
    return this.vehicles.get(this.localVehicleId);
  }

  public getPlayers(): Map<string, Player> {
    return this.players;
  }

  public getVehicles(): Map<string, Vehicle> {
    return this.vehicles;
  }

  public isGameRunning(): boolean {
    return this.isRunning;
  }

  public getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  public getRemainingTime(): number {
    const elapsed = this.getElapsedTime();
    return Math.max(0, this.gameModeConfig.timeLimit - elapsed);
  }

  public dispose(): void {
    this.stop();

    // Dispose vehicles
    this.vehicles.forEach((vehicle) => {
      vehicle.dispose();
    });
    this.vehicles.clear();

    // Dispose physics
    this.physics.dispose();

    // Dispose renderer
    this.renderer.dispose();

    // Clear state
    this.players.clear();
    this.projectiles.clear();
  }
}
