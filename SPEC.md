# CellDamage 3D - Technical Specification

## Game Overview
Vehicular combat game inspired by Cel Damage with 8-64 player scalable arenas.

## Core Requirements

### 1. Player Scaling (8-64 Players)
- **Map Size Calculation**: Base size 1000x1000 units, scales by √playerCount
  - 8 players: 1000x1000
  - 16 players: 1414x1414  
  - 32 players: 2000x2000
  - 64 players: 2828x2828
- **Spawn Points**: Evenly distributed, minimum 200 units apart
- **Performance**: Maintain 60 FPS with 64 players + AI

### 2. Physics System (Cannon.js)
- **Vehicle Physics**:
  - RaycastVehicle for arcade-style handling
  - Customizable: mass, engine power, grip, suspension
  - Collision damage based on impact velocity
- **Weapons Physics**:
  - Projectile ballistics (gravity, drag)
  - Explosion forces (radial damage + impulse)
  - Destructible environment elements

### 3. Game Modes
- **Deathmatch**: Free-for-all, most kills wins
- **Team Battle**: 2-4 teams, first to score limit
- **Survival**: Last vehicle standing, shrinking arena

### 4. Weapon System
- **Primary Weapons**: Machine gun, shotgun, rocket launcher
- **Power-ups**: Health, shields, speed boost, weapon upgrades
- **Pickup Spawns**: Randomized with respawn timers

### 5. AI System (Single Player)
- **Behavior States**: Patrol → Chase → Attack → Flee
- **Difficulty Levels**: Easy, Medium, Hard, Expert
- **Pathfinding**: A* with dynamic obstacle avoidance

### 6. Scoring System
- **Destruction Points**: +100 per kill
- **Death Penalty**: -50 per death
- **Win Condition**: Most destructions - deaths after time limit

### 7. Multiplayer Architecture
- **Current**: Single player with AI (placeholder for multiplayer)
- **Future**: WebSocket matchmaking, authoritative server
- **Network Prediction**: Client-side prediction, server reconciliation

### 8. Docker & Deployment
- **Container**: Node.js 20 Alpine
- **Health Checks**: HTTP endpoint at /health
- **GHCR**: Automatic builds on push

## File Structure
```
src/
├── client/              # Browser client code
│   ├── game/           # Game logic
│   ├── renderer/       # Three.js rendering
│   ├── physics/        # Cannon.js integration
│   └── network/        # Socket.io client (future)
├── server/             # Node.js server
│   ├── game/          # Server-side game logic
│   ├── physics/       # Server physics (authoritative)
│   └── routes/        # Express routes
├── shared/            # Shared types and utilities
└── ai/                # AI behavior trees
```

## Testing Requirements
- Unit tests for all game logic
- Integration tests for physics
- Performance benchmarks
- Docker container tests

## Implementation Phases
1. **Phase 1**: Core physics + single vehicle
2. **Phase 2**: Weapons + damage system
3. **Phase 3**: AI opponents
4. **Phase 4**: UI + game modes
5. **Phase 5**: Docker + CI/CD
