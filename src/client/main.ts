import { Game } from './game/Game';
import { VehicleType, GameMode } from '../shared/types';

interface GameSettings {
  playerName: string;
  vehicleType: VehicleType;
  gameMode: GameMode;
  aiCount: number;
}

let game: Game | null = null;

function getGameSettings(): GameSettings {
  const playerName = (document.getElementById('player-name') as HTMLInputElement)?.value || 'Player 1';
  const vehicleType = (document.getElementById('vehicle-type') as HTMLSelectElement)?.value as VehicleType || 'balanced';
  const gameMode = (document.getElementById('game-mode') as HTMLSelectElement)?.value as GameMode || 'deathmatch';
  const aiCount = parseInt((document.getElementById('ai-count') as HTMLSelectElement)?.value || '5');

  return {
    playerName,
    vehicleType,
    gameMode,
    aiCount,
  };
}

function showLoading(): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'flex';
  }
}

function hideLoading(): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
}

function showMenu(): void {
  const menu = document.getElementById('menu');
  const hud = document.getElementById('hud');
  
  if (menu) menu.style.display = 'flex';
  if (hud) hud.style.display = 'none';
}

function showHUD(): void {
  const menu = document.getElementById('menu');
  const hud = document.getElementById('hud');
  
  if (menu) menu.style.display = 'none';
  if (hud) hud.style.display = 'block';
}

function showGameOver(winnerName: string): void {
  const gameOver = document.getElementById('game-over');
  const winnerDisplay = document.getElementById('winner-display');
  
  if (gameOver) {
    gameOver.style.display = 'flex';
  }
  if (winnerDisplay) {
    winnerDisplay.textContent = `${winnerName} Wins!`;
  }
}

function hideGameOver(): void {
  const gameOver = document.getElementById('game-over');
  if (gameOver) {
    gameOver.style.display = 'none';
  }
}

function updateHUD(): void {
  if (!game) return;

  const localPlayer = game.getLocalPlayer();
  const localVehicle = game.getLocalVehicle();
  
  if (localPlayer && localVehicle) {
    // Update health
    const healthFill = document.getElementById('health-fill');
    const healthText = document.getElementById('health-text');
    const healthPercent = (localVehicle.getHealth() / localVehicle.getMaxHealth()) * 100;
    
    if (healthFill) {
      healthFill.style.width = `${healthPercent}%`;
    }
    if (healthText) {
      healthText.textContent = `${Math.ceil(healthPercent)}%`;
    }

    // Update score
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) {
      scoreDisplay.textContent = `Score: ${localPlayer.score}`;
    }
  }

  // Update timer
  const remaining = game.getRemainingTime();
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const timerDisplay = document.getElementById('timer');
  if (timerDisplay) {
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function startGame(): void {
  showLoading();
  
  setTimeout(() => {
    const settings = getGameSettings();
    const container = document.getElementById('game-container');
    
    if (!container) {
      console.error('Game container not found');
      hideLoading();
      return;
    }

    // Dispose existing game
    if (game) {
      game.dispose();
    }

    // Create new game
    game = new Game(
      {
        container,
        playerName: settings.playerName,
        vehicleType: settings.vehicleType,
        gameMode: settings.gameMode,
        maxPlayers: 8,
        timeLimit: 600, // 10 minutes
        enableAI: true,
        aiCount: settings.aiCount,
      },
      {
        onScoreUpdate: (playerId, score) => {
          console.log(`Player ${playerId} score: ${score}`);
          updateHUD();
        },
        onPlayerDeath: (playerId, killerId) => {
          console.log(`Player ${playerId} was killed by ${killerId}`);
          updateHUD();
        },
        onGameEnd: (winner) => {
          console.log(`Game ended! Winner: ${winner.name}`);
          showGameOver(winner.name);
        },
        onTimeUpdate: (timeRemaining) => {
          updateHUD();
        },
      }
    );

    showHUD();
    hideLoading();
    hideGameOver();
    
    game.start();

    // Start HUD update loop
    setInterval(updateHUD, 100);
  }, 100);
}

function restartGame(): void {
  hideGameOver();
  startGame();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');

  if (startBtn) {
    startBtn.addEventListener('click', startGame);
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', restartGame);
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    if (game) {
      // Game handles resize internally through renderer
    }
  });

  // Handle escape key for menu
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && game && game.isGameRunning()) {
      // Could implement pause menu here
    }
  });
});

// Export for potential module use
export { game, startGame, restartGame };
