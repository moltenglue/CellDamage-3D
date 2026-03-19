/**
 * Shared types and utilities for CellDamage 3D
 */

// Vector types
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// Entity base interface
export interface Entity {
  id: string;
  position: Vector3;
  rotation: Quaternion;
}

// Player state
export interface Player extends Entity {
  name: string;
  health: number;
  maxHealth: number;
  shield: number;
  score: number;
  kills: number;
  deaths: number;
  vehicleType: VehicleType;
  isAlive: boolean;
  lastSpawnTime: number;
}

// Vehicle types
export type VehicleType = 'speedster' | 'tank' | 'balanced';

export interface VehicleStats {
  mass: number;
  maxSpeed: number;
  acceleration: number;
  grip: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionRestLength: number;
  maxSteerVal: number;
  maxForce: number;
  brakeForce: number;
  health: number;
}

export const VehiclePresets: Record<VehicleType, VehicleStats> = {
  speedster: {
    mass: 800,
    maxSpeed: 45,
    acceleration: 1200,
    grip: 0.7,
    suspensionStiffness: 30,
    suspensionDamping: 2.3,
    suspensionRestLength: 0.4,
    maxSteerVal: 0.5,
    maxForce: 3000,
    brakeForce: 100,
    health: 80,
  },
  tank: {
    mass: 2500,
    maxSpeed: 25,
    acceleration: 800,
    grip: 0.9,
    suspensionStiffness: 50,
    suspensionDamping: 4,
    suspensionRestLength: 0.5,
    maxSteerVal: 0.35,
    maxForce: 5000,
    brakeForce: 150,
    health: 150,
  },
  balanced: {
    mass: 1500,
    maxSpeed: 35,
    acceleration: 1000,
    grip: 0.8,
    suspensionStiffness: 40,
    suspensionDamping: 3,
    suspensionRestLength: 0.45,
    maxSteerVal: 0.45,
    maxForce: 4000,
    brakeForce: 120,
    health: 100,
  },
};

// Weapon types
export type WeaponType = 'machinegun' | 'shotgun' | 'rocketlauncher' | 'none';

export interface WeaponStats {
  damage: number;
  fireRate: number; // shots per second
  reloadTime: number; // seconds
  magazineSize: number;
  projectileSpeed: number;
  projectileLife: number; // seconds
  spread: number; // angle in radians
  explosiveRadius?: number;
  ammo: number;
}

export const WeaponPresets: Record<WeaponType, WeaponStats> = {
  machinegun: {
    damage: 8,
    fireRate: 10,
    reloadTime: 2,
    magazineSize: 50,
    projectileSpeed: 80,
    projectileLife: 2,
    spread: 0.05,
    ammo: 200,
  },
  shotgun: {
    damage: 15,
    fireRate: 1.5,
    reloadTime: 3,
    magazineSize: 8,
    projectileSpeed: 60,
    projectileLife: 1,
    spread: 0.2,
    ammo: 64,
  },
  rocketlauncher: {
    damage: 50,
    fireRate: 0.5,
    reloadTime: 4,
    magazineSize: 4,
    projectileSpeed: 40,
    projectileLife: 5,
    spread: 0,
    explosiveRadius: 8,
    ammo: 20,
  },
  none: {
    damage: 0,
    fireRate: 0,
    reloadTime: 0,
    magazineSize: 0,
    projectileSpeed: 0,
    projectileLife: 0,
    spread: 0,
    ammo: 0,
  },
};

// Power-up types
export type PowerUpType = 'health' | 'shield' | 'speed' | 'weapon' | 'ammo';

export interface PowerUpData {
  type: PowerUpType;
  value: number;
  duration?: number; // for temporary effects like speed
}

// Game modes
export type GameMode = 'deathmatch' | 'team' | 'survival';

export interface GameModeConfig {
  mode: GameMode;
  maxPlayers: number;
  timeLimit: number; // seconds
  scoreLimit?: number;
  teamCount?: number;
  respawnDelay: number;
  mapSize: number;
}

// Map configuration
export interface MapConfig {
  size: number;
  playerCount: number;
  obstacles: ObstacleData[];
  spawnPoints: Vector3[];
  powerUpSpawns: Vector3[];
}

export interface ObstacleData {
  position: Vector3;
  size: Vector3;
  rotation: Quaternion;
  type: 'wall' | 'ramp' | 'box' | 'cylinder';
  destructible: boolean;
  health?: number;
}

// Projectile
export interface Projectile {
  id: string;
  ownerId: string;
  position: Vector3;
  velocity: Vector3;
  weaponType: WeaponType;
  createdAt: number;
  hasExploded: boolean;
}

// Damage event
export interface DamageEvent {
  targetId: string;
  sourceId: string;
  damage: number;
  damageType: 'projectile' | 'collision' | 'explosion';
  position: Vector3;
  weaponType?: WeaponType;
}

// AI Difficulty
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export interface AIConfig {
  difficulty: DifficultyLevel;
  reactionTime: number;
  accuracy: number;
  aggression: number;
}

// Input state
export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  fire: boolean;
  aimX: number;
  aimY: number;
}

// Game state
export interface GameState {
  players: Map<string, Player>;
  projectiles: Map<string, Projectile>;
  powerUps: Map<string, PowerUpData>;
  gameMode: GameModeConfig;
  elapsedTime: number;
  isRunning: boolean;
  winner?: string;
}

// Network messages (for future multiplayer)
export interface NetworkMessage {
  type: string;
  timestamp: number;
  data: unknown;
}

// Utility functions
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function vector3Distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

// Calculate map size based on player count
export function calculateMapSize(playerCount: number): number {
  const baseSize = 1000;
  const scaleFactor = Math.sqrt(playerCount / 8);
  return Math.floor(baseSize * scaleFactor);
}

// Generate spawn points evenly distributed
export function generateSpawnPoints(count: number, mapSize: number): Vector3[] {
  const points: Vector3[] = [];
  const minDistance = 200;
  const margin = 100;
  const availableSize = mapSize - margin * 2;
  
  const gridSize = Math.ceil(Math.sqrt(count));
  const cellSize = availableSize / gridSize;
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    const x = margin + col * cellSize + cellSize / 2 + (Math.random() - 0.5) * cellSize * 0.5;
    const z = margin + row * cellSize + cellSize / 2 + (Math.random() - 0.5) * cellSize * 0.5;
    
    points.push({
      x: x - mapSize / 2,
      y: 5,
      z: z - mapSize / 2,
    });
  }
  
  return points;
}

// Physics constants
export const PHYSICS_TIMESTEP = 1 / 60;
export const MAX_SUBSTEPS = 3;
export const GRAVITY = -9.82;

// Game constants
export const DEFAULT_SPAWN_DELAY = 3000; // ms
export const COLLISION_DAMAGE_THRESHOLD = 10; // m/s
export const COLLISION_DAMAGE_MULTIPLIER = 2;
export const MAX_PLAYERS = 64;
export const MIN_PLAYERS = 2;
