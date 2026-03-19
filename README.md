# CellDamage 3D - Vehicular Combat Game

A browser-based vehicular combat game inspired by Cel Damage, built with Three.js and Cannon.js physics.

## Features

- **8-64 Player Scalable Maps**: Dynamic map sizing based on player count
- **Advanced Physics**: Realistic vehicle dynamics with Cannon.js
- **Power-ups & Weapons**: Collect and deploy various weapons
- **Destruction Scoring**: Goal is more destructions than deaths
- **AI Opponents**: Single-player mode with intelligent AI
- **Multiplayer Ready**: Architecture supports online multiplayer

## Tech Stack

- **Frontend**: Three.js (3D rendering)
- **Physics**: Cannon.js (vehicle physics, collisions)
- **Backend**: Node.js + Express (matchmaking, leaderboards)
- **Container**: Docker with GHCR deployment

## Quick Start

```bash
# Run with Docker
docker run -p 3000:3000 ghcr.io/YOUR_USERNAME/celldamage-3d:latest

# Or develop locally
npm install
npm run dev
```

## Game Modes

1. **Deathmatch**: Free-for-all vehicular combat
2. **Team Battle**: Red vs Blue destruction derby
3. **Survival**: Last vehicle standing

## Controls

- **WASD**: Drive
- **Mouse**: Aim
- **Left Click**: Fire weapon
- **Space**: Handbrake
- **E**: Use power-up

## License

MIT
