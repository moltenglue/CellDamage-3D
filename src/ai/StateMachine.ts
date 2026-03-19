export enum AIState {
  PATROL = 'patrol',
  CHASE = 'chase',
  ATTACK = 'attack',
  FLEE = 'flee',
  IDLE = 'idle',
}

export interface AIStateConfig {
  state: AIState;
  enterState?: () => void;
  updateState: (deltaTime: number) => void;
  exitState?: () => void;
}

export class StateMachine {
  private currentState: AIState = AIState.IDLE;
  private states: Map<AIState, AIStateConfig> = new Map();
  private lastUpdateTime = 0;

  public registerState(config: AIStateConfig): void {
    this.states.set(config.state, config);
  }

  public changeState(newState: AIState): void {
    const currentConfig = this.states.get(this.currentState);
    if (currentConfig?.exitState) {
      currentConfig.exitState();
    }

    this.currentState = newState;

    const newConfig = this.states.get(newState);
    if (newConfig?.enterState) {
      newConfig.enterState();
    }
  }

  public update(deltaTime: number): void {
    const config = this.states.get(this.currentState);
    if (config) {
      config.updateState(deltaTime);
    }
  }

  public getCurrentState(): AIState {
    return this.currentState;
  }

  public isInState(state: AIState): boolean {
    return this.currentState === state;
  }
}
