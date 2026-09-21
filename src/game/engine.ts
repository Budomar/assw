import {
  Direction, Position, Food, FoodType, Particle, FloatingText,
  Wall, GameStats, PowerUp, GameSettings,
  GRID_SIZE, FOOD_COLORS, FOOD_POINTS,
} from './types';
import { audioManager } from './audio';

export interface EngineState {
  snake: Position[];
  food: Food[];
  walls: Wall[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  powerUps: PowerUp[];
  direction: Direction;
  nextDirection: Direction;
  score: number;
  combo: number;
  comboTimer: number;
  level: number;
  stats: GameStats;
  hasShield: boolean;
  speedMultiplier: number;
  scoreMultiplier: number;
  magnetActive: boolean;
  screenShake: number;
  lastEatTime: number;
}

export class GameEngine {
  state: EngineState;
  private baseSpeed: number;
  private lastMoveTime = 0;
  settings: GameSettings;

  constructor(baseSpeed: number, settings: GameSettings) {
    this.baseSpeed = baseSpeed;
    this.settings = settings;
    this.state = this.createInitialState();
  }

  private createInitialState(): EngineState {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const initialFood = this.spawnFoodStandalone('normal', snake, [], []);
    return {
      snake,
      food: [initialFood],
      walls: [],
      particles: [],
      floatingTexts: [],
      powerUps: [],
      direction: 'RIGHT',
      nextDirection: 'RIGHT',
      score: 0,
      combo: 0,
      comboTimer: 0,
      level: 1,
      stats: {
        timePlayed: 0,
        maxCombo: 0,
        foodEaten: 0,
        goldenEaten: 0,
        bonusEaten: 0,
        level: 1,
      },
      hasShield: false,
      speedMultiplier: 1,
      scoreMultiplier: 1,
      magnetActive: false,
      screenShake: 0,
      lastEatTime: 0,
    };
  }

  reset(baseSpeed: number) {
    this.baseSpeed = baseSpeed;
    this.state = this.createInitialState();
    this.lastMoveTime = 0;
  }

  setDirection(dir: Direction) {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    };
    if (opposites[dir] !== this.state.direction) {
      this.state.nextDirection = dir;
    }
  }

  private spawnFoodStandalone(type: FoodType, snake: Position[], existingFood: Food[], walls: Wall[]): Food {
    let pos: Position;
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    existingFood.forEach(f => occupied.add(`${f.pos.x},${f.pos.y}`));
    walls.forEach(w => occupied.add(`${w.x},${w.y}`));

    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      attempts++;
    } while (occupied.has(`${pos.x},${pos.y}`) && attempts < 500);

    const durations: Record<FoodType, number> = {
      normal: 0,
      golden: 8000,
      bonus: 6000,
      speed: 7000,
      shield: 10000,
    };

    return { pos, type, spawnTime: performance.now(), duration: durations[type] };
  }

  private spawnFood(type: FoodType, snake: Position[]): Food {
    return this.spawnFoodStandalone(type, snake, this.state.food, this.state.walls);
  }

  private getRandomFoodType(): FoodType {
    const rand = Math.random();
    if (rand < 0.60) return 'normal';
    if (rand < 0.78) return 'golden';
    if (rand < 0.88) return 'bonus';
    if (rand < 0.94) return 'speed';
    return 'shield';
  }

  private generateWalls(level: number): Wall[] {
    if (!this.settings.wrapWalls && level >= 3) {
      const walls: Wall[] = [];
      const count = Math.min((level - 2) * 3, 25);
      const occupied = new Set(this.state.snake.map(s => `${s.x},${s.y}`));

      for (let i = 0; i < count; i++) {
        let pos: Position;
        let attempts = 0;
        do {
          pos = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
          };
          attempts++;
        } while (
          (occupied.has(`${pos.x},${pos.y}`) ||
            (pos.x <= 12 && pos.x >= 8 && pos.y <= 12 && pos.y >= 8)) &&
          attempts < 100
        );
        if (attempts < 100) {
          walls.push(pos);
          occupied.add(`${pos.x},${pos.y}`);
        }
      }
      return walls;
    }
    return [];
  }

  private spawnParticles(x: number, y: number, color: string, count: number, cellSize: number) {
    if (!this.settings.particlesEnabled) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1 + Math.random() * 3;
      this.state.particles.push({
        x: x * cellSize + cellSize / 2,
        y: y * cellSize + cellSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, cellSize: number) {
    if (!this.settings.particlesEnabled) return;
    this.state.floatingTexts.push({
      x: x * cellSize + cellSize / 2,
      y: y * cellSize,
      text,
      color,
      life: 1,
      maxLife: 1,
      vy: -1.5,
    });
  }

  update(timestamp: number, canvasSize: number): {
    died: boolean;
    ate: boolean;
    leveledUp: boolean;
    newHighScore: boolean;
  } {
    const s = this.state;
    const cellSize = canvasSize / GRID_SIZE;
    const speed = (this.baseSpeed / s.speedMultiplier) * (1 - Math.min(s.level * 0.02, 0.3));

    // Update combo timer
    if (s.comboTimer > 0) {
      s.comboTimer -= 16;
      if (s.comboTimer <= 0) {
        s.combo = 0;
      }
    }

    // Update power-ups
    s.powerUps = s.powerUps.filter(p => {
      p.remaining -= 16;
      if (p.remaining <= 0) {
        if (p.type === 'slow') s.speedMultiplier = 1;
        if (p.type === 'double') s.scoreMultiplier = 1;
        if (p.type === 'magnet') s.magnetActive = false;
        return false;
      }
      return true;
    });

    // Update expired food
    const now = performance.now();
    s.food = s.food.filter(f => {
      if (f.duration > 0 && now - f.spawnTime > f.duration) {
        this.spawnParticles(f.pos.x, f.pos.y, '#666', 5, cellSize);
        return false;
      }
      return true;
    });

    // Ensure at least one normal food
    if (!s.food.some(f => f.type === 'normal')) {
      s.food.push(this.spawnFood('normal', s.snake));
    }

    // Spawn random special food
    if (s.food.length < 3 && Math.random() < 0.005) {
      const type = this.getRandomFoodType();
      if (type !== 'normal') {
        s.food.push(this.spawnFood(type, s.snake));
      }
    }

    // Screen shake decay
    if (s.screenShake > 0) s.screenShake *= 0.9;

    // Update particles
    s.particles = s.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= 0.025;
      return p.life > 0;
    });

    // Update floating texts
    s.floatingTexts = s.floatingTexts.filter(t => {
      t.y += t.vy;
      t.life -= 0.02;
      return t.life > 0;
    });

    // Move snake
    if (timestamp - this.lastMoveTime < speed) {
      return { died: false, ate: false, leveledUp: false, newHighScore: false };
    }
    this.lastMoveTime = timestamp;

    s.direction = s.nextDirection;
    const head = { ...s.snake[0] };

    switch (s.direction) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Wall collision
    let died = false;
    if (this.settings.wrapWalls) {
      if (head.x < 0) head.x = GRID_SIZE - 1;
      if (head.x >= GRID_SIZE) head.x = 0;
      if (head.y < 0) head.y = GRID_SIZE - 1;
      if (head.y >= GRID_SIZE) head.y = 0;
    } else {
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        if (s.hasShield) {
          s.hasShield = false;
          s.screenShake = 8;
          audioManager.click();
          // Redirect
          head.x = Math.max(0, Math.min(GRID_SIZE - 1, s.snake[0].x));
          head.y = Math.max(0, Math.min(GRID_SIZE - 1, s.snake[0].y));
        } else {
          died = true;
        }
      }
    }

    // Wall obstacles collision
    if (!died && s.walls.some(w => w.x === head.x && w.y === head.y)) {
      if (s.hasShield) {
        s.hasShield = false;
        s.screenShake = 8;
        audioManager.click();
      } else {
        died = true;
      }
    }

    // Self collision
    if (!died && s.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      if (s.hasShield) {
        s.hasShield = false;
        s.screenShake = 8;
        audioManager.click();
      } else {
        died = true;
      }
    }

    if (died) {
      audioManager.die();
      s.screenShake = 15;
      // Death particles
      s.snake.forEach((seg, i) => {
        setTimeout(() => {
          this.spawnParticles(seg.x, seg.y, '#38bdf8', 3, cellSize);
        }, i * 20);
      });
      return { died: true, ate: false, leveledUp: false, newHighScore: false };
    }

    const newSnake = [head, ...s.snake];
    let ate = false;
    let leveledUp = false;

    // Check food collision
    const eatenFoodIndex = s.food.findIndex(f => f.pos.x === head.x && f.pos.y === head.y);
    if (eatenFoodIndex !== -1) {
      const eatenFood = s.food[eatenFoodIndex];
      ate = true;

      // Combo
      s.combo++;
      s.comboTimer = 3000;
      if (s.combo > s.stats.maxCombo) s.stats.maxCombo = s.combo;

      const comboMultiplier = 1 + Math.floor(s.combo / 3) * 0.5;
      const points = Math.round(FOOD_POINTS[eatenFood.type] * s.scoreMultiplier * comboMultiplier);
      s.score += points;

      s.stats.foodEaten++;
      s.lastEatTime = now;

      // Effects based on food type
      const color = FOOD_COLORS[eatenFood.type];
      this.spawnParticles(head.x, head.y, color, eatenFood.type === 'normal' ? 8 : 15, cellSize);
      this.addFloatingText(head.x, head.y, `+${points}`, color, cellSize);

      if (s.combo >= 3) {
        this.addFloatingText(head.x, head.y - 1, `x${s.combo} COMBO!`, '#fbbf24', cellSize);
        audioManager.combo(s.combo);
      } else {
        switch (eatenFood.type) {
          case 'normal': audioManager.eat(); break;
          case 'golden':
            audioManager.eatGolden();
            s.stats.goldenEaten++;
            break;
          case 'bonus':
            audioManager.eatBonus();
            s.stats.bonusEaten++;
            break;
          case 'speed':
            audioManager.powerUp();
            s.speedMultiplier = 1.5;
            s.powerUps.push({ type: 'slow', remaining: 5000 });
            this.addFloatingText(head.x, head.y - 2, '⚡ СКОРОСТЬ!', '#06b6d4', cellSize);
            break;
          case 'shield':
            audioManager.powerUp();
            s.hasShield = true;
            this.addFloatingText(head.x, head.y - 2, '🛡️ ЩИТ!', '#22c55e', cellSize);
            break;
        }
      }

      // Remove eaten food
      s.food.splice(eatenFoodIndex, 1);

      // Spawn new normal food
      s.food.push(this.spawnFood('normal', newSnake));

      // Level up check
      const newLevel = Math.floor(s.score / 80) + 1;
      if (newLevel > s.level) {
        s.level = newLevel;
        s.stats.level = newLevel;
        leveledUp = true;
        audioManager.levelUp();
        this.addFloatingText(GRID_SIZE / 2, GRID_SIZE / 2, `УРОВЕНЬ ${newLevel}!`, '#fbbf24', cellSize);
        // Generate walls for new level
        if (!this.settings.wrapWalls) {
          s.walls = this.generateWalls(newLevel);
        }
      }
    } else {
      newSnake.pop();
    }

    s.snake = newSnake;
    s.stats.timePlayed += speed;

    return { died: false, ate, leveledUp, newHighScore: false };
  }

  render(ctx: CanvasRenderingContext2D, canvasSize: number, timestamp: number) {
    const s = this.state;
    const cellSize = canvasSize / GRID_SIZE;

    ctx.save();

    // Screen shake
    if (s.screenShake > 0.5) {
      const shakeX = (Math.random() - 0.5) * s.screenShake;
      const shakeY = (Math.random() - 0.5) * s.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Grid
    if (this.settings.showGrid) {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvasSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvasSize, i * cellSize);
        ctx.stroke();
      }
    }

    // Walls
    s.walls.forEach(wall => {
      const x = wall.x * cellSize;
      const y = wall.y * cellSize;
      const wallGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
      wallGrad.addColorStop(0, '#64748b');
      wallGrad.addColorStop(1, '#475569');
      ctx.fillStyle = wallGrad;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, cellSize - 2, cellSize - 2, 2);
      ctx.fill();
      // Brick pattern
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + cellSize / 2);
      ctx.lineTo(x + cellSize - 1, y + cellSize / 2);
      ctx.stroke();
    });

    // Food
    s.food.forEach(food => {
      const x = food.pos.x * cellSize;
      const y = food.pos.y * cellSize;
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const color = FOOD_COLORS[food.type];
      const pulse = Math.sin(timestamp * 0.005) * 0.15 + 0.85;
      const radius = cellSize * 0.35 * pulse;

      // Glow
      const glowSize = cellSize * 1.2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize);
      glow.addColorStop(0, color + '40');
      glow.addColorStop(1, color + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2);

      // Body
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      const foodGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      foodGrad.addColorStop(0, '#fff');
      foodGrad.addColorStop(0.3, color);
      foodGrad.addColorStop(1, color + 'cc');
      ctx.fillStyle = foodGrad;
      ctx.fill();

      // Timer indicator for timed food
      if (food.duration > 0) {
        const elapsed = performance.now() - food.spawnTime;
        const remaining = 1 - elapsed / food.duration;
        if (remaining > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
          ctx.strokeStyle = color + '80';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Special food icons
      if (food.type !== 'normal') {
        ctx.font = `${cellSize * 0.45}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emojis: Record<FoodType, string> = {
          normal: '',
          golden: '⭐',
          bonus: '💎',
          speed: '⚡',
          shield: '🛡️',
        };
        ctx.fillText(emojis[food.type], cx, cy + 1);
      }
    });

    // Snake
    const snakeLen = s.snake.length;
    s.snake.forEach((seg, i) => {
      const x = seg.x * cellSize;
      const y = seg.y * cellSize;
      const padding = 1;
      const isHead = i === 0;
      const isTail = i === snakeLen - 1;

      // Segment color gradient
      const progress = i / Math.max(snakeLen - 1, 1);
      const hue = 195 + progress * 30;
      const saturation = 85 - progress * 20;
      const lightness = 60 - progress * 15;
      const segColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      // Glow for head
      if (isHead) {
        const headGlow = ctx.createRadialGradient(
          x + cellSize / 2, y + cellSize / 2, 0,
          x + cellSize / 2, y + cellSize / 2, cellSize * 1.5
        );
        headGlow.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
        headGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = headGlow;
        ctx.fillRect(x - cellSize, y - cellSize, cellSize * 3, cellSize * 3);
      }

      // Shield effect
      if (isHead && s.hasShield) {
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.4 + Math.sin(timestamp * 0.008) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Body segment
      const segGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
      segGrad.addColorStop(0, segColor);
      segGrad.addColorStop(1, `hsl(${hue + 10}, ${saturation - 10}%, ${lightness - 10}%)`);
      ctx.fillStyle = segGrad;

      const radius = isHead ? 5 : isTail ? 3 : 3;
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, radius);
      ctx.fill();

      // Scale pattern on body
      if (!isHead && !isTail && i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head details
      if (isHead) {
        // Eyes
        const eyeSize = cellSize * 0.13;
        const pupilSize = eyeSize * 0.6;
        ctx.fillStyle = '#fff';

        let e1x: number, e1y: number, e2x: number, e2y: number;
        let pdx = 0, pdy = 0;

        switch (s.direction) {
          case 'UP':
            e1x = x + cellSize * 0.3; e1y = y + cellSize * 0.32;
            e2x = x + cellSize * 0.7; e2y = y + cellSize * 0.32;
            pdy = -pupilSize * 0.3;
            break;
          case 'DOWN':
            e1x = x + cellSize * 0.3; e1y = y + cellSize * 0.68;
            e2x = x + cellSize * 0.7; e2y = y + cellSize * 0.68;
            pdy = pupilSize * 0.3;
            break;
          case 'LEFT':
            e1x = x + cellSize * 0.32; e1y = y + cellSize * 0.3;
            e2x = x + cellSize * 0.32; e2y = y + cellSize * 0.7;
            pdx = -pupilSize * 0.3;
            break;
          case 'RIGHT':
            e1x = x + cellSize * 0.68; e1y = y + cellSize * 0.3;
            e2x = x + cellSize * 0.68; e2y = y + cellSize * 0.7;
            pdx = pupilSize * 0.3;
            break;
        }

        // Eye whites
        ctx.beginPath();
        ctx.arc(e1x, e1y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e2x, e2y, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(e1x + pdx, e1y + pdy, pupilSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e2x + pdx, e2y + pdy, pupilSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Particles
    s.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating texts
    s.floatingTexts.forEach(t => {
      ctx.globalAlpha = t.life;
      ctx.font = `bold ${cellSize * 0.5}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    // Border glow based on state
    if (s.hasShield) {
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.3 + Math.sin(timestamp * 0.005) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, canvasSize, canvasSize);
    }

    ctx.restore();
  }
}
