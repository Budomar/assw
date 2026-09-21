import { useState, useEffect, useCallback, useRef } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 65,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'from-green-500 to-emerald-600',
  medium: 'from-yellow-500 to-orange-600',
  hard: 'from-red-500 to-rose-600',
};

function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

function App() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showEatAnimation, setShowEatAnimation] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameStateRef = useRef<GameState>('idle');
  const snakeRef = useRef<Position[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<Position>({ x: 15, y: 10 });
  const scoreRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastMoveTimeRef = useRef<number>(0);

  // Sync refs
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    setScore(0);
    directionRef.current = 'RIGHT';
    snakeRef.current = initialSnake;
    scoreRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
    gameStateRef.current = 'playing';
    lastMoveTimeRef.current = performance.now();
  }, [resetGame]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
      gameStateRef.current = 'paused';
    } else if (gameState === 'paused') {
      setGameState('playing');
      gameStateRef.current = 'playing';
      lastMoveTimeRef.current = performance.now();
    }
  }, [gameState]);

  const moveSnake = useCallback(() => {
    const currentSnake = snakeRef.current;
    const currentDirection = directionRef.current;
    const currentFood = foodRef.current;

    const head = { ...currentSnake[0] };

    switch (currentDirection) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Check wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setGameState('gameover');
      gameStateRef.current = 'gameover';
      const currentScore = scoreRef.current;
      const savedHigh = localStorage.getItem('snake-high-score');
      const currentHigh = savedHigh ? parseInt(savedHigh, 10) : 0;
      if (currentScore > currentHigh) {
        localStorage.setItem('snake-high-score', currentScore.toString());
        setHighScore(currentScore);
      }
      return;
    }

    // Check self collision
    if (currentSnake.some(s => s.x === head.x && s.y === head.y)) {
      setGameState('gameover');
      gameStateRef.current = 'gameover';
      const currentScore = scoreRef.current;
      const savedHigh = localStorage.getItem('snake-high-score');
      const currentHigh = savedHigh ? parseInt(savedHigh, 10) : 0;
      if (currentScore > currentHigh) {
        localStorage.setItem('snake-high-score', currentScore.toString());
        setHighScore(currentScore);
      }
      return;
    }

    const newSnake = [head, ...currentSnake];

    // Check food collision
    if (head.x === currentFood.x && head.y === currentFood.y) {
      const newScore = scoreRef.current + 10;
      setScore(newScore);
      scoreRef.current = newScore;
      setFood(getRandomPosition(newSnake));
      setShowEatAnimation(true);
      setTimeout(() => setShowEatAnimation(false), 300);
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
    snakeRef.current = newSnake;
  }, []);

  // Game loop using requestAnimationFrame
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (gameStateRef.current === 'playing') {
        const elapsed = timestamp - lastMoveTimeRef.current;
        if (elapsed >= SPEEDS[difficulty]) {
          moveSnake();
          lastMoveTimeRef.current = timestamp;
        }
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [difficulty, moveSnake]);

  // Draw game on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Draw food with glow
    const foodX = food.x * cellSize;
    const foodY = food.y * cellSize;
    const foodCenterX = foodX + cellSize / 2;
    const foodCenterY = foodY + cellSize / 2;
    const foodRadius = cellSize * 0.4;

    // Food glow
    const gradient = ctx.createRadialGradient(
      foodCenterX, foodCenterY, 0,
      foodCenterX, foodCenterY, cellSize
    );
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(foodX - cellSize / 2, foodY - cellSize / 2, cellSize * 2, cellSize * 2);

    // Food body
    ctx.beginPath();
    ctx.arc(foodCenterX, foodCenterY, foodRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(foodCenterX - foodRadius * 0.2, foodCenterY - foodRadius * 0.2, foodRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    // Draw snake
    snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;

      if (index === 0) {
        // Head
        const headGradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        headGradient.addColorStop(0, '#38bdf8');
        headGradient.addColorStop(1, '#0ea5e9');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 4);
        ctx.fill();

        // Eyes
        const eyeSize = cellSize * 0.12;
        ctx.fillStyle = '#fff';
        let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;

        switch (direction) {
          case 'UP':
            eye1X = x + cellSize * 0.3; eye1Y = y + cellSize * 0.3;
            eye2X = x + cellSize * 0.7; eye2Y = y + cellSize * 0.3;
            break;
          case 'DOWN':
            eye1X = x + cellSize * 0.3; eye1Y = y + cellSize * 0.7;
            eye2X = x + cellSize * 0.7; eye2Y = y + cellSize * 0.7;
            break;
          case 'LEFT':
            eye1X = x + cellSize * 0.3; eye1Y = y + cellSize * 0.3;
            eye2X = x + cellSize * 0.3; eye2Y = y + cellSize * 0.7;
            break;
          case 'RIGHT':
            eye1X = x + cellSize * 0.7; eye1Y = y + cellSize * 0.3;
            eye2X = x + cellSize * 0.7; eye2Y = y + cellSize * 0.7;
            break;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body with gradient based on position
        const progress = index / snake.length;
        const r = Math.round(56 - progress * 20);
        const g = Math.round(189 - progress * 60);
        const b = Math.round(248 - progress * 80);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 3);
        ctx.fill();
      }
    });
  }, [snake, food, direction]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentDir = directionRef.current;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'ц':
        case 'Ц':
          e.preventDefault();
          if (currentDir !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
        case 'ы':
        case 'Ы':
          e.preventDefault();
          if (currentDir !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
        case 'ф':
        case 'Ф':
          e.preventDefault();
          if (currentDir !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
        case 'в':
        case 'В':
          e.preventDefault();
          if (currentDir !== 'LEFT') setDirection('RIGHT');
          break;
        case ' ':
          e.preventDefault();
          if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
            startGame();
          } else {
            togglePause();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
            togglePause();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startGame, togglePause]);

  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipeDistance = 30;

    if (Math.abs(dx) < minSwipeDistance && Math.abs(dy) < minSwipeDistance) {
      touchStartRef.current = null;
      return;
    }

    const currentDir = directionRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && currentDir !== 'LEFT') setDirection('RIGHT');
      else if (dx < 0 && currentDir !== 'RIGHT') setDirection('LEFT');
    } else {
      if (dy > 0 && currentDir !== 'UP') setDirection('DOWN');
      else if (dy < 0 && currentDir !== 'DOWN') setDirection('UP');
    }

    touchStartRef.current = null;
  }, []);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const size = Math.min(container.clientWidth, container.clientHeight);
      canvas.width = size;
      canvas.height = size;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="w-full max-w-lg mb-4 animate-slide-up">
        <h1 className="text-2xl md:text-3xl font-bold text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          🐍 Змейка
        </h1>

        {/* Score Panel */}
        <div className="flex justify-between items-center mt-3 px-2">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${showEatAnimation ? 'animate-snake-eat' : ''} text-cyan-400`}>
              {score}
            </span>
            <span className="text-xs text-slate-400">очков</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">рекорд</span>
            <span className="text-lg font-bold text-amber-400">
              {highScore}
            </span>
            <span className="text-amber-400">👑</span>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative w-full max-w-lg aspect-square animate-fade-in">
        <div className={`absolute inset-0 rounded-xl border-2 border-slate-600 overflow-hidden shadow-2xl ${gameState === 'playing' ? 'animate-glow' : ''}`}>
          <canvas
            ref={canvasRef}
            className="w-full h-full game-board"
          />

          {/* Overlay for idle/paused/gameover */}
          {gameState !== 'playing' && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
              {gameState === 'idle' && (
                <div className="text-center px-4">
                  <div className="text-5xl mb-4">🐍</div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Готовы играть?</h2>
                  <p className="text-slate-400 text-sm mb-6">
                    Управление: стрелки / WASD / свайпы
                  </p>
                  <button
                    onClick={startGame}
                    className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/30"
                  >
                    Начать игру
                  </button>
                  <p className="text-slate-500 text-xs mt-3">или нажмите Пробел</p>
                </div>
              )}

              {gameState === 'paused' && (
                <div className="text-center px-4">
                  <div className="text-5xl mb-4">⏸️</div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-4">Пауза</h2>
                  <button
                    onClick={togglePause}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30"
                  >
                    Продолжить
                  </button>
                  <p className="text-slate-500 text-xs mt-3">или нажмите Пробел / Esc</p>
                </div>
              )}

              {gameState === 'gameover' && (
                <div className="text-center px-4">
                  <div className="text-5xl mb-4">💀</div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Игра окончена!</h2>
                  <p className="text-cyan-400 text-lg font-bold mb-1">Счёт: {score}</p>
                  {score >= highScore && score > 0 && (
                    <p className="text-amber-400 text-sm font-bold mb-3 animate-pulse">🎉 Новый рекорд!</p>
                  )}
                  <button
                    onClick={startGame}
                    className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/30 mt-2"
                  >
                    Играть снова
                  </button>
                  <p className="text-slate-500 text-xs mt-3">или нажмите Пробел</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4 animate-slide-up">
        {/* Difficulty selector */}
        <div className="flex justify-center gap-2 mb-3">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
            <button
              key={diff}
              onClick={() => {
                if (gameState === 'idle' || gameState === 'gameover') {
                  setDifficulty(diff);
                }
              }}
              disabled={gameState === 'playing' || gameState === 'paused'}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                difficulty === diff
                  ? `bg-gradient-to-r ${DIFFICULTY_COLORS[diff]} text-white shadow-lg scale-105`
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              } ${(gameState === 'playing' || gameState === 'paused') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {DIFFICULTY_LABELS[diff]}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>⏸️</span>
              <span className="text-sm font-medium">Пауза</span>
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={startGame}
              className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>🔄</span>
              <span className="text-sm font-medium">Заново</span>
            </button>
          )}
        </div>

        {/* Mobile D-pad */}
        <div className="mt-4 flex justify-center md:hidden">
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-36 h-36">
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); if (directionRef.current !== 'DOWN') setDirection('UP'); }}
              className="bg-slate-700/80 rounded-lg flex items-center justify-center text-xl active:bg-slate-600 touch-manipulation"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); if (directionRef.current !== 'RIGHT') setDirection('LEFT'); }}
              className="bg-slate-700/80 rounded-lg flex items-center justify-center text-xl active:bg-slate-600 touch-manipulation"
            >
              ◀
            </button>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                if (gameState === 'idle' || gameState === 'gameover') startGame();
                else togglePause();
              }}
              className="bg-slate-600/80 rounded-lg flex items-center justify-center text-xs font-bold active:bg-slate-500 touch-manipulation"
            >
              {gameState === 'playing' ? '⏸' : '▶'}
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); if (directionRef.current !== 'LEFT') setDirection('RIGHT'); }}
              className="bg-slate-700/80 rounded-lg flex items-center justify-center text-xl active:bg-slate-600 touch-manipulation"
            >
              ▶
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); if (directionRef.current !== 'UP') setDirection('DOWN'); }}
              className="bg-slate-700/80 rounded-lg flex items-center justify-center text-xl active:bg-slate-600 touch-manipulation"
            >
              ▼
            </button>
            <div />
          </div>
        </div>

        {/* Desktop hint */}
        <p className="hidden md:block text-center text-xs text-slate-500 mt-3">
          Стрелки / WASD — движение • Пробел — пауза • Esc — пауза
        </p>
      </div>
    </div>
  );
}

export default App;
