export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Position = { x: number; y: number };
export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';
export type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

export type FoodType = 'normal' | 'golden' | 'bonus' | 'speed' | 'shield';

export interface Food {
  pos: Position;
  type: FoodType;
  spawnTime: number;
  duration: number; // ms, 0 = permanent
}

export interface PowerUp {
  type: 'shield' | 'slow' | 'double' | 'magnet';
  remaining: number; // ms
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface Wall {
  x: number;
  y: number;
}

export interface GameStats {
  timePlayed: number;
  maxCombo: number;
  foodEaten: number;
  goldenEaten: number;
  bonusEaten: number;
  level: number;
}

export interface ScoreRecord {
  score: number;
  difficulty: Difficulty;
  date: string;
  level: number;
  length: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  particlesEnabled: boolean;
  wrapWalls: boolean;
  showGrid: boolean;
}

export const GRID_SIZE = 20;

export const SPEEDS: Record<Difficulty, number> = {
  easy: 160,
  medium: 110,
  hard: 75,
  insane: 50,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
  insane: 'Безумие',
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'from-green-500 to-emerald-600',
  medium: 'from-yellow-500 to-orange-500',
  hard: 'from-red-500 to-rose-600',
  insane: 'from-purple-500 to-fuchsia-600',
};

export const DIFFICULTY_ICONS: Record<Difficulty, string> = {
  easy: '🌱',
  medium: '🔥',
  hard: '💀',
  insane: '👹',
};

export const FOOD_COLORS: Record<FoodType, string> = {
  normal: '#ef4444',
  golden: '#f59e0b',
  bonus: '#a855f7',
  speed: '#06b6d4',
  shield: '#22c55e',
};

export const FOOD_POINTS: Record<FoodType, number> = {
  normal: 10,
  golden: 30,
  bonus: 50,
  speed: 15,
  shield: 20,
};

export const FOOD_LABELS: Record<FoodType, string> = {
  normal: 'Яблоко',
  golden: 'Золотое яблоко',
  bonus: 'Бонус',
  speed: 'Ускоритель',
  shield: 'Щит',
};

export const FOOD_EMOJIS: Record<FoodType, string> = {
  normal: '🍎',
  golden: '⭐',
  bonus: '💎',
  speed: '⚡',
  shield: '🛡️',
};
