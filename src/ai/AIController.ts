import { 
  AIConfig, 
  DifficultyLevel, 
  InputState, 
  Player, 
  VehicleType, 
  WeaponType,
  Vector3,
  VehiclePresets,
  vector3Distance,
} from '../shared/types';
import { Vehicle } from '../client/vehicle/Vehicle';
import { AIState, StateMachine } from './StateMachine';
import { Pathfinder } from './Pathfinder';

export interface AIControllerConfig {
  playerId: string;
  difficulty: DifficultyLevel;
  vehicleType: VehicleType;
  mapSize: number;
}

export class AIController {
  private playerId: string;
  private config: AIConfig;
  private stateMachine: StateMachine;
  private pathfinder: Pathfinder;
  
  private vehicle?: Vehicle;
  private targetPlayer?: Player;
  private currentPath: Vector3[] = [];
  private pathIndex = 0;
  
  // State variables
  private lastUpdate = 0;
  private lastTargetSearch = 0;
  private lastFireTime = 0;
  private currentWeapon: WeaponType = 'machinegun';
  private patrolTarget?: Vector3;
  private healthLastCheck = 100;
  
  // Constants
  private readonly DETECTION_RANGE = 150;
  private readonly ATTACK_RANGE = 80;
  private readonly FLEE_HEALTH_THRESHOLD = 30;
  private readonly PATH_RECALC_INTERVAL = 1000;
  private readonly TARGET_SEARCH_INTERVAL = 500;

  constructor(aiConfig: AIControllerConfig) {
    this.playerId = aiConfig.playerId;
    this.config = this.getDifficultyConfig(aiConfig.difficulty);
    this.pathfinder = new Pathfinder(aiConfig.mapSize);
    
    this.stateMachine = new StateMachine();
    this.setupStates();
  }

  private getDifficultyConfig(difficulty: DifficultyLevel): AIConfig {
    const configs: Record<DifficultyLevel, AIConfig> = {
      easy: {
        difficulty: 'easy',
        reactionTime: 500,
        accuracy: 0.3,
        aggression: 0.3,
      },
      medium: {
        difficulty: 'medium',
        reactionTime: 300,
        accuracy: 0.5,
        aggression: 0.5,
      },
      hard: {
        difficulty: 'hard',
        reactionTime: 150,
        accuracy: 0.7,
        aggression: 0.7,
      },
      expert: {
        difficulty: 'expert',
        reactionTime: 50,
        accuracy: 0.9,
        aggression: 0.9,
      },
    };

    return configs[difficulty];
  }

  private setupStates(): void {
    // Idle state
    this.stateMachine.registerState({
      state: AIState.IDLE,
      enterState: () => {
        this.currentPath = [];
      },
      updateState: (deltaTime) => {
        if (this.shouldStartPatrolling()) {
          this.stateMachine.changeState(AIState.PATROL);
        } else if (this.shouldStartChasing()) {
          this.stateMachine.changeState(AIState.CHASE);
        }
      },
    });

    // Patrol state
    this.stateMachine.registerState({
      state: AIState.PATROL,
      enterState: () => {
        this.setRandomPatrolTarget();
      },
      updateState: (deltaTime) => {
        if (this.shouldFlee()) {
          this.stateMachine.changeState(AIState.FLEE);
          return;
        }

        if (this.shouldStartChasing()) {
          this.stateMachine.changeState(AIState.CHASE);
          return;
        }

        if (this.shouldStartAttacking()) {
          this.stateMachine.changeState(AIState.ATTACK);
          return;
        }

        this.updatePatrol(deltaTime);
      },
    });

    // Chase state
    this.stateMachine.registerState({
      state: AIState.CHASE,
      enterState: () => {
        this.currentPath = [];
      },
      updateState: (deltaTime) => {
        if (this.shouldFlee()) {
          this.stateMachine.changeState(AIState.FLEE);
          return;
        }

        if (!this.targetPlayer || !this.targetPlayer.isAlive) {
          this.stateMachine.changeState(AIState.PATROL);
          return;
        }

        if (this.shouldStartAttacking()) {
          this.stateMachine.changeState(AIState.ATTACK);
          return;
        }

        this.updateChase(deltaTime);
      },
    });

    // Attack state
    this.stateMachine.registerState({
      state: AIState.ATTACK,
      updateState: (deltaTime) => {
        if (this.shouldFlee()) {
          this.stateMachine.changeState(AIState.FLEE);
          return;
        }

        if (!this.targetPlayer || !this.targetPlayer.isAlive) {
          this.stateMachine.changeState(AIState.PATROL);
          return;
        }

        if (!this.shouldStartAttacking()) {
          this.stateMachine.changeState(AIState.CHASE);
          return;
        }

        this.updateAttack(deltaTime);
      },
    });

    // Flee state
    this.stateMachine.registerState({
      state: AIState.FLEE,
      enterState: () => {
        this.currentPath = [];
      },
      updateState: (deltaTime) => {
        if (!this.shouldFlee()) {
          this.stateMachine.changeState(AIState.PATROL);
          return;
        }

        this.updateFlee(deltaTime);
      },
    });

    // Start in patrol state
    this.stateMachine.changeState(AIState.PATROL);
  }

  public setVehicle(vehicle: Vehicle): void {
    this.vehicle = vehicle;
  }

  public update(deltaTime: number, players: Map<string, Player>): InputState {
    if (!this.vehicle) return this.getEmptyInput();

    const now = Date.now();
    
    // Update target periodically
    if (now - this.lastTargetSearch > this.TARGET_SEARCH_INTERVAL) {
      this.updateTarget(players);
      this.lastTargetSearch = now;
    }

    // Update health tracking
    this.healthLastCheck = this.vehicle.getHealth();

    // Update state machine
    this.stateMachine.update(deltaTime);

    // Return input state based on current behavior
    return this.generateInput();
  }

  private updateTarget(players: Map<string, Player>): void {
    if (!this.vehicle) return;

    const myPos = this.vehicle.getPosition();
    let closestPlayer: Player | undefined;
    let closestDistance = Infinity;

    players.forEach((player) => {
      if (player.id === this.playerId || !player.isAlive) return;

      const distance = vector3Distance(myPos, player.position);
      if (distance < closestDistance && distance < this.DETECTION_RANGE) {
        closestDistance = distance;
        closestPlayer = player;
      }
    });

    this.targetPlayer = closestPlayer;
  }

  private shouldStartPatrolling(): boolean {
    return !this.targetPlayer || !this.targetPlayer.isAlive;
  }

  private shouldStartChasing(): boolean {
    return !!this.targetPlayer && 
           this.targetPlayer.isAlive && 
           vector3Distance(this.vehicle!.getPosition(), this.targetPlayer.position) > this.ATTACK_RANGE;
  }

  private shouldStartAttacking(): boolean {
    return !!this.targetPlayer && 
           this.targetPlayer.isAlive && 
           vector3Distance(this.vehicle!.getPosition(), this.targetPlayer.position) <= this.ATTACK_RANGE;
  }

  private shouldFlee(): boolean {
    return this.vehicle!.getHealth() < this.FLEE_HEALTH_THRESHOLD * this.config.aggression;
  }

  private updatePatrol(deltaTime: number): void {
    if (!this.vehicle || !this.patrolTarget) return;

    const pos = this.vehicle.getPosition();
    const distToTarget = vector3Distance(pos, this.patrolTarget);

    if (distToTarget < 10) {
      this.setRandomPatrolTarget();
      return;
    }

    // Recalculate path periodically
    if (Date.now() - this.lastUpdate > this.PATH_RECALC_INTERVAL || this.currentPath.length === 0) {
      this.currentPath = this.pathfinder.findPath(pos, this.patrolTarget);
      this.pathIndex = 0;
      this.lastUpdate = Date.now();
    }
  }

  private updateChase(deltaTime: number): void {
    if (!this.vehicle || !this.targetPlayer) return;

    const pos = this.vehicle.getPosition();
    const targetPos = this.targetPlayer.position;

    // Recalculate path periodically
    if (Date.now() - this.lastUpdate > this.PATH_RECALC_INTERVAL || this.currentPath.length === 0) {
      this.currentPath = this.pathfinder.findPath(pos, targetPos);
      this.pathIndex = 0;
      this.lastUpdate = Date.now();
    }
  }

  private updateAttack(deltaTime: number): void {
    if (!this.vehicle || !this.targetPlayer) return;

    const pos = this.vehicle.getPosition();
    const targetPos = this.targetPlayer.position;

    // Strafe around target
    const angle = Math.atan2(targetPos.z - pos.z, targetPos.x - pos.x);
    const strafeAngle = angle + Math.PI / 2;

    this.currentPath = [{
      x: pos.x + Math.cos(strafeAngle) * 20,
      y: pos.y,
      z: pos.z + Math.sin(strafeAngle) * 20,
    }];
    this.pathIndex = 0;

    // Fire weapon
    const now = Date.now();
    const fireRate = this.getFireRate();
    if (now - this.lastFireTime > fireRate * (2 - this.config.accuracy)) {
      this.lastFireTime = now;
    }
  }

  private updateFlee(deltaTime: number): void {
    if (!this.vehicle || !this.targetPlayer) return;

    const pos = this.vehicle.getPosition();
    const threatPos = this.targetPlayer.position;

    // Run away from threat
    const angle = Math.atan2(pos.z - threatPos.z, pos.x - threatPos.x);
    const fleePos = {
      x: pos.x + Math.cos(angle) * 100,
      y: pos.y,
      z: pos.z + Math.sin(angle) * 100,
    };

    if (Date.now() - this.lastUpdate > this.PATH_RECALC_INTERVAL) {
      this.currentPath = this.pathfinder.findPath(pos, fleePos);
      this.pathIndex = 0;
      this.lastUpdate = Date.now();
    }
  }

  private generateInput(): InputState {
    if (!this.vehicle || this.currentPath.length === 0) {
      return this.getEmptyInput();
    }

    const pos = this.vehicle.getPosition();
    const target = this.currentPath[this.pathIndex];
    
    if (!target) {
      return this.getEmptyInput();
    }

    // Check if reached current waypoint
    const distToWaypoint = vector3Distance(pos, target);
    if (distToWaypoint < 5 && this.pathIndex < this.currentPath.length - 1) {
      this.pathIndex++;
    }

    // Calculate steering
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const targetAngle = Math.atan2(dx, dz);
    
    const velocity = this.vehicle.getVelocity();
    const currentAngle = Math.atan2(velocity.x, velocity.z);
    
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Determine input based on state
    const input: InputState = {
      forward: true,
      backward: false,
      left: angleDiff > 0.1,
      right: angleDiff < -0.1,
      brake: false,
      fire: false,
      aimX: 0,
      aimY: 0,
    };

    // Override for specific states
    if (this.stateMachine.isInState(AIState.ATTACK)) {
      input.fire = Date.now() - this.lastFireTime < 100;
      
      // Aim at target
      if (this.targetPlayer) {
        const targetDx = this.targetPlayer.position.x - pos.x;
        const targetDz = this.targetPlayer.position.z - pos.z;
        input.aimX = targetDx / 100;
        input.aimY = -0.2; // Slightly up
      }
    } else if (this.stateMachine.isInState(AIState.FLEE)) {
      input.fire = false;
    }

    return input;
  }

  private getEmptyInput(): InputState {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      fire: false,
      aimX: 0,
      aimY: 0,
    };
  }

  private setRandomPatrolTarget(): void {
    const range = 300;
    this.patrolTarget = {
      x: (Math.random() - 0.5) * 2 * range,
      y: 0,
      z: (Math.random() - 0.5) * 2 * range,
    };
  }

  private getFireRate(): number {
    switch (this.currentWeapon) {
      case 'machinegun':
        return 100; // 10 shots per second
      case 'shotgun':
        return 667; // 1.5 shots per second
      case 'rocketlauncher':
        return 2000; // 0.5 shots per second
      default:
        return 100;
    }
  }

  public getState(): AIState {
    return this.stateMachine.getCurrentState();
  }

  public setWeapon(weapon: WeaponType): void {
    this.currentWeapon = weapon;
  }

  public dispose(): void {
    this.currentPath = [];
    this.targetPlayer = undefined;
  }
}
