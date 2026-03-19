import { Vector3 } from '../shared/types';

export interface PathNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent?: PathNode;
}

export class Pathfinder {
  private gridSize = 20;
  private grid: boolean[][] = [];
  private mapSize: number;
  private obstacles: Set<string> = new Set();

  constructor(mapSize: number) {
    this.mapSize = mapSize;
    const gridCount = Math.ceil(mapSize / this.gridSize);
    this.grid = Array(gridCount).fill(null).map(() => Array(gridCount).fill(true));
  }

  public addObstacle(x: number, z: number, radius: number): void {
    const gridX = Math.floor((x + this.mapSize / 2) / this.gridSize);
    const gridZ = Math.floor((z + this.mapSize / 2) / this.gridSize);
    const radiusInGrid = Math.ceil(radius / this.gridSize);

    for (let dx = -radiusInGrid; dx <= radiusInGrid; dx++) {
      for (let dz = -radiusInGrid; dz <= radiusInGrid; dz++) {
        const nx = gridX + dx;
        const nz = gridZ + dz;
        if (this.isValidGrid(nx, nz)) {
          this.grid[nx][nz] = false;
          this.obstacles.add(`${nx},${nz}`);
        }
      }
    }
  }

  private isValidGrid(x: number, z: number): boolean {
    return x >= 0 && x < this.grid.length && z >= 0 && z < this.grid[0].length;
  }

  public findPath(start: Vector3, end: Vector3): Vector3[] {
    const startGrid = this.worldToGrid(start);
    const endGrid = this.worldToGrid(end);

    if (!this.isValidGrid(startGrid.x, startGrid.z) || !this.isValidGrid(endGrid.x, endGrid.z)) {
      return [start, end];
    }

    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();

    const startNode: PathNode = {
      x: startGrid.x,
      z: startGrid.z,
      g: 0,
      h: this.heuristic(startGrid, endGrid),
      f: 0,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Find node with lowest f score
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      // Check if reached goal
      if (current.x === endGrid.x && current.z === endGrid.z) {
        return this.reconstructPath(current, start);
      }

      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.z}`);

      // Check neighbors
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (closedSet.has(`${neighbor.x},${neighbor.z}`)) continue;
        if (!this.grid[neighbor.x][neighbor.z]) continue;

        const tentativeG = current.g + 1;

        const existingNode = openSet.find(n => n.x === neighbor.x && n.z === neighbor.z);
        if (!existingNode) {
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, endGrid);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;
          openSet.push(neighbor);
        } else if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = existingNode.g + existingNode.h;
          existingNode.parent = current;
        }
      }
    }

    // No path found, return direct path
    return [start, end];
  }

  private worldToGrid(pos: Vector3): { x: number; z: number } {
    return {
      x: Math.floor((pos.x + this.mapSize / 2) / this.gridSize),
      z: Math.floor((pos.z + this.mapSize / 2) / this.gridSize),
    };
  }

  private gridToWorld(gridX: number, gridZ: number): Vector3 {
    return {
      x: gridX * this.gridSize - this.mapSize / 2 + this.gridSize / 2,
      y: 0,
      z: gridZ * this.gridSize - this.mapSize / 2 + this.gridSize / 2,
    };
  }

  private heuristic(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  private getNeighbors(node: PathNode): PathNode[] {
    const neighbors: PathNode[] = [];
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
      { x: 1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
      { x: -1, z: -1 },
    ];

    for (const dir of directions) {
      const nx = node.x + dir.x;
      const nz = node.z + dir.z;
      if (this.isValidGrid(nx, nz)) {
        neighbors.push({ x: nx, z: nz, g: 0, h: 0, f: 0 });
      }
    }

    return neighbors;
  }

  private reconstructPath(endNode: PathNode, start: Vector3): Vector3[] {
    const path: Vector3[] = [];
    let current: PathNode | undefined = endNode;

    while (current) {
      path.unshift(this.gridToWorld(current.x, current.z));
      current = current.parent;
    }

    // Add start position
    if (path.length === 0 || this.distance(path[0], start) > 0.1) {
      path.unshift(start);
    }

    return path;
  }

  private distance(a: Vector3, b: Vector3): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
  }
}
