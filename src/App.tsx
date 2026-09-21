import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Direction, Difficulty, GameState, GameSettings, ScoreRecord,
  GRID_SIZE, SPEEDS, DIFFICULTY_LABELS, DIFFICULTY_COLORS,
  DIFFICULTY_ICONS, FOOD_EMOJIS, FOOD_LABELS, FOOD_COLORS,
} from './game/types';
import { GameEngine } from './game/engine';
import { audioManager } from './game/audio';

type Screen = 'menu' | 'game' | 'settings' | 'records' | 'howto';

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  particlesEnabled: true,
  wrapWalls: true,
  showGrid: true,
};

function loadRecords(): ScoreRecord[] {
  try {
    const data = localStorage.getItem('snake-records');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: ScoreRecord[]) {
  localStorage.setItem('snake-records', JSON.stringify(records.slice(0, 10)));
}

function loadSettings(): GameSettings {
  try {
    const data = localStorage.getItem('snake-settings');
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: GameSettings) {
  localStorage.setItem('snake-settings', JSON.stringify(settings));
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [records, setRecords] = useState<ScoreRecord[]>(loadRecords);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [level, setLevel] = useState(1);
  const [hasShield, setHasShield] = useState(false);
  const [snakeLength, setSnakeLength] = useState(3);
  const [timePlayed, setTimePlayed] = useState(0);
  const [finalStats, setFinalStats] = useState<any>(null);
  const [showNewRecord, setShowNewRecord] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameStateRef = useRef<GameState>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { audioManager.setEnabled(settings.soundEnabled); }, [settings.soundEnabled]);

  // Initialize audio on first interaction
  useEffect(() => {
    const initAudio = () => {
      audioManager.init();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const startGame = useCallback(() => {
    audioManager.init();
    audioManager.click();
    engineRef.current = new GameEngine(SPEEDS[difficulty], settings);
    setGameState('playing');
    setScore(0);
    setCombo(0);
    setLevel(1);
    setHasShield(false);
    setSnakeLength(3);
    setTimePlayed(0);
    setShowNewRecord(false);
    setFinalStats(null);
    setScreen('game');
  }, [difficulty, settings]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
      audioManager.pause();
    } else if (gameState === 'paused') {
      setGameState('playing');
      audioManager.resume();
    }
  }, [gameState]);

  const goToMenu = useCallback(() => {
    setGameState('idle');
    setScreen('menu');
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Game loop
  useEffect(() => {
    if (screen !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      const size = Math.min(container.clientWidth, container.clientHeight, 600);
      canvas.width = size;
      canvas.height = size;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const loop = (timestamp: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (gameStateRef.current === 'playing') {
        const result = engine.update(timestamp, canvas.width);

        // Sync state to React
        setScore(engine.state.score);
        setCombo(engine.state.combo);
        setLevel(engine.state.level);
        setHasShield(engine.state.hasShield);
        setSnakeLength(engine.state.snake.length);
        setTimePlayed(engine.state.stats.timePlayed);

        if (result.died) {
          setGameState('gameover');
          gameStateRef.current = 'gameover';

          const stats = { ...engine.state.stats };
          stats.level = engine.state.level;
          setFinalStats({
            score: engine.state.score,
            length: engine.state.snake.length,
            stats,
            difficulty,
          });

          // Check high score
          const currentRecords = loadRecords();
          const isNewRecord = currentRecords.length === 0 || engine.state.score > (currentRecords[0]?.score || 0);
          if (engine.state.score > 0) {
            const newRecord: ScoreRecord = {
              score: engine.state.score,
              difficulty,
              date: new Date().toLocaleDateString('ru-RU'),
              level: engine.state.level,
              length: engine.state.snake.length,
            };
            const updated = [...currentRecords, newRecord].sort((a, b) => b.score - a.score).slice(0, 10);
            saveRecords(updated);
            setRecords(updated);
            if (isNewRecord) setShowNewRecord(true);
          }
        }
      }

      // Always render
      engine.render(ctx, canvas.width, timestamp);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [screen, difficulty]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      const currentDir = engine?.state.direction || 'RIGHT';

      if (screen === 'game') {
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц':
            e.preventDefault();
            engine?.setDirection('UP');
            break;
          case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
            e.preventDefault();
            engine?.setDirection('DOWN');
            break;
          case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
            e.preventDefault();
            engine?.setDirection('LEFT');
            break;
          case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
            e.preventDefault();
            engine?.setDirection('RIGHT');
            break;
          case ' ':
            e.preventDefault();
            if (gameStateRef.current === 'gameover') startGame();
            else togglePause();
            break;
          case 'Escape':
            e.preventDefault();
            if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') togglePause();
            break;
        }
      } else if (screen === 'menu') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, startGame, togglePause]);

  // Touch/swipe controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !engineRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const min = 25;

    if (Math.abs(dx) < min && Math.abs(dy) < min) {
      touchStartRef.current = null;
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      engineRef.current.setDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      engineRef.current.setDirection(dy > 0 ? 'DOWN' : 'UP');
    }
    touchStartRef.current = null;
  }, []);

  // Settings handler
  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
    audioManager.click();
  };

  // ============ RENDER ============

  // Menu Screen
  if (screen === 'menu') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 overflow-hidden relative">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -top-20 -left-20 animate-pulse" />
          <div className="absolute w-80 h-80 bg-purple-500/5 rounded-full blur-3xl -bottom-20 -right-20 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute w-64 h-64 bg-blue-500/5 rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 text-center max-w-md w-full">
          {/* Logo */}
          <div className="mb-8 animate-fade-in">
            <div className="text-7xl mb-3 drop-shadow-lg">🐍</div>
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              ЗМЕЙКА
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Классическая аркада</p>
          </div>

          {/* Difficulty */}
          <div className="mb-6 animate-slide-up">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Сложность</p>
            <div className="grid grid-cols-4 gap-2">
              {(['easy', 'medium', 'hard', 'insane'] as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => { setDifficulty(diff); audioManager.click(); }}
                  className={`py-2.5 px-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                    difficulty === diff
                      ? `bg-gradient-to-r ${DIFFICULTY_COLORS[diff]} text-white shadow-lg scale-105`
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  <div className="text-lg">{DIFFICULTY_ICONS[diff]}</div>
                  <div className="text-xs mt-0.5">{DIFFICULTY_LABELS[diff]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <button
              onClick={startGame}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-cyan-500/25"
            >
              🎮 Играть
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setScreen('howto'); audioManager.click(); }}
                className="py-3 bg-slate-800/60 text-slate-300 rounded-xl hover:bg-slate-700/60 transition-all text-sm font-medium"
              >
                📖 Как играть
              </button>
              <button
                onClick={() => { setScreen('records'); audioManager.click(); }}
                className="py-3 bg-slate-800/60 text-slate-300 rounded-xl hover:bg-slate-700/60 transition-all text-sm font-medium"
              >
                🏆 Рекорды
              </button>
              <button
                onClick={() => { setScreen('settings'); audioManager.click(); }}
                className="py-3 bg-slate-800/60 text-slate-300 rounded-xl hover:bg-slate-700/60 transition-all text-sm font-medium"
              >
                ⚙️ Настройки
              </button>
            </div>
          </div>

          {/* High score */}
          {records.length > 0 && (
            <div className="mt-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <p className="text-xs text-slate-500">Лучший результат</p>
              <p className="text-2xl font-black text-amber-400">{records[0].score} <span className="text-sm">очков</span></p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Settings Screen
  if (screen === 'settings') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">⚙️ Настройки</h2>

          <div className="space-y-4">
            <ToggleSetting
              label="Звуковые эффекты"
              icon="🔊"
              value={settings.soundEnabled}
              onChange={(v) => updateSetting('soundEnabled', v)}
            />
            <ToggleSetting
              label="Эффекты частиц"
              icon="✨"
              value={settings.particlesEnabled}
              onChange={(v) => updateSetting('particlesEnabled', v)}
            />
            <ToggleSetting
              label="Проход сквозь стены"
              icon="🌀"
              value={settings.wrapWalls}
              onChange={(v) => updateSetting('wrapWalls', v)}
              description="Змейка проходит сквозь стены"
            />
            <ToggleSetting
              label="Показывать сетку"
              icon="📐"
              value={settings.showGrid}
              onChange={(v) => updateSetting('showGrid', v)}
            />
          </div>

          <button
            onClick={() => { setScreen('menu'); audioManager.click(); }}
            className="w-full mt-8 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all font-medium"
          >
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  // Records Screen
  if (screen === 'records') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">🏆 Таблица рекордов</h2>

          {records.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎯</div>
              <p className="text-slate-400">Пока нет рекордов</p>
              <p className="text-slate-500 text-sm mt-1">Сыграйте первую игру!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {records.map((record, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    i === 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    i === 0 ? 'bg-amber-500 text-white' :
                    i === 1 ? 'bg-slate-400 text-white' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{record.score} очков</div>
                    <div className="text-xs text-slate-400">
                      Ур. {record.level} • Длина {record.length} • {DIFFICULTY_LABELS[record.difficulty]}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{record.date}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => { setScreen('menu'); audioManager.click(); }}
              className="flex-1 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all font-medium"
            >
              ← Назад
            </button>
            {records.length > 0 && (
              <button
                onClick={() => {
                  localStorage.removeItem('snake-records');
                  setRecords([]);
                  audioManager.click();
                }}
                className="py-3 px-4 bg-red-900/40 text-red-400 rounded-xl hover:bg-red-900/60 transition-all text-sm"
              >
                🗑️ Очистить
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // How to play Screen
  if (screen === 'howto') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 overflow-y-auto">
        <div className="max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">📖 Как играть</h2>

          <div className="space-y-4 text-sm">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="font-bold text-cyan-400 mb-2">🎯 Цель</h3>
              <p className="text-slate-300">Собирайте еду, растите и не врезайтесь в стены, себя или препятствия!</p>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="font-bold text-cyan-400 mb-2">🎮 Управление</h3>
              <div className="text-slate-300 space-y-1">
                <p>⌨️ <strong>Стрелки / WASD</strong> — направление</p>
                <p>📱 <strong>Свайпы</strong> — направление (мобильные)</p>
                <p>⏸️ <strong>Пробел / Esc</strong> — пауза</p>
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="font-bold text-cyan-400 mb-2">🍎 Типы еды</h3>
              <div className="space-y-2">
                {(['normal', 'golden', 'bonus', 'speed', 'shield'] as const).map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-lg">{FOOD_EMOJIS[type]}</span>
                    <span className="font-medium" style={{ color: FOOD_COLORS[type] }}>{FOOD_LABELS[type]}</span>
                    <span className="text-slate-400 text-xs ml-auto">+{type === 'normal' ? '10' : type === 'golden' ? '30' : type === 'bonus' ? '50' : type === 'speed' ? '15' : '20'} очков</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="font-bold text-cyan-400 mb-2">🔥 Комбо</h3>
              <p className="text-slate-300">Ешьте быстро, чтобы набирать комбо-множитель! Каждые 3 подряд = +50% к очкам.</p>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4">
              <h3 className="font-bold text-cyan-400 mb-2">📈 Уровни</h3>
              <p className="text-slate-300">Каждые 80 очков — новый уровень. Скорость растёт, на сложных режимах появляются стены!</p>
            </div>
          </div>

          <button
            onClick={() => { setScreen('menu'); audioManager.click(); }}
            className="w-full mt-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all font-medium"
          >
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  // Game Screen
  return (
    <div
      className="w-full h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* HUD */}
      <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <button
            onClick={goToMenu}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            ← 
          </button>
          <div>
            <div className="text-lg font-black text-cyan-400">{score}</div>
            <div className="text-[10px] text-slate-500 -mt-1">очков</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {combo >= 3 && (
            <div className="text-amber-400 font-bold text-sm animate-pulse">
              🔥 x{combo}
            </div>
          )}
          {hasShield && (
            <div className="text-green-400 text-sm animate-pulse">🛡️</div>
          )}
          <div className="text-center">
            <div className="text-sm font-bold text-slate-300">Ур. {level}</div>
            <div className="text-[10px] text-slate-500">{formatTime(timePlayed)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-amber-400">{snakeLength}</div>
            <div className="text-[10px] text-slate-500">длина</div>
          </div>
        </div>

        <button
          onClick={togglePause}
          className="text-slate-400 hover:text-white transition-colors p-1 text-lg"
        >
          {gameState === 'paused' ? '▶' : '⏸'}
        </button>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 relative" ref={containerRef}>
        <div className="relative w-full h-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-xl border-2 border-slate-600/50 shadow-2xl max-w-full max-h-full"
            style={{ imageRendering: 'auto' }}
          />

          {/* Pause Overlay */}
          {gameState === 'paused' && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-fade-in">
              <div className="text-5xl mb-4">⏸️</div>
              <h2 className="text-2xl font-bold text-white mb-2">Пауза</h2>
              <p className="text-slate-400 text-sm mb-6">Счёт: {score} • Уровень: {level}</p>
              <div className="flex gap-3">
                <button
                  onClick={togglePause}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  ▶ Продолжить
                </button>
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all transform hover:scale-105 active:scale-95"
                >
                  🔄 Заново
                </button>
              </div>
              <button
                onClick={goToMenu}
                className="mt-3 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
              >
                В меню
              </button>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === 'gameover' && finalStats && (
            <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-fade-in p-4">
              {showNewRecord && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/50 text-amber-400 px-4 py-1.5 rounded-full text-sm font-bold animate-bounce">
                  🎉 Новый рекорд!
                </div>
              )}

              <div className="text-5xl mb-3">💀</div>
              <h2 className="text-2xl font-bold text-white mb-1">Игра окончена!</h2>

              <div className="text-3xl font-black text-cyan-400 my-2">{finalStats.score}</div>
              <p className="text-slate-400 text-sm mb-4">очков</p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-4">
                <StatCard icon="📏" label="Длина" value={finalStats.length.toString()} />
                <StatCard icon="📈" label="Уровень" value={finalStats.stats.level.toString()} />
                <StatCard icon="🍎" label="Съедено" value={finalStats.stats.foodEaten.toString()} />
                <StatCard icon="🔥" label="Макс. комбо" value={`x${finalStats.stats.maxCombo}`} />
                <StatCard icon="⭐" label="Золотые" value={finalStats.stats.goldenEaten.toString()} />
                <StatCard icon="⏱️" label="Время" value={formatTime(finalStats.stats.timePlayed)} />
              </div>

              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={startGame}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/25"
                >
                  🔄 Ещё раз
                </button>
                <button
                  onClick={goToMenu}
                  className="py-3 px-4 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all"
                >
                  🏠
                </button>
              </div>
              <p className="text-slate-500 text-xs mt-3">Пробел — играть снова</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile D-pad */}
      <div className="flex-shrink-0 flex justify-center pb-3 md:hidden">
        <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-40 h-40">
          <div />
          <DPadButton direction="UP" engine={engineRef.current} icon="▲" />
          <div />
          <DPadButton direction="LEFT" engine={engineRef.current} icon="◀" />
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              if (gameState === 'gameover') startGame();
              else togglePause();
            }}
            className="bg-slate-600/80 rounded-xl flex items-center justify-center text-sm font-bold active:bg-slate-500 touch-manipulation border border-slate-500/30"
          >
            {gameState === 'playing' ? '⏸' : gameState === 'paused' ? '▶' : '🔄'}
          </button>
          <DPadButton direction="RIGHT" engine={engineRef.current} icon="▶" />
          <div />
          <DPadButton direction="DOWN" engine={engineRef.current} icon="▼" />
          <div />
        </div>
      </div>
    </div>
  );
}

// Helper Components

function ToggleSetting({ label, icon, value, onChange, description }: {
  label: string;
  icon: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between bg-slate-800/60 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-white font-medium text-sm">{label}</div>
          {description && <div className="text-slate-500 text-xs">{description}</div>}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full transition-all duration-200 relative ${
          value ? 'bg-cyan-500' : 'bg-slate-600'
        }`}
      >
        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
          value ? 'left-6' : 'left-1'
        }`} />
      </button>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-2.5 text-center">
      <div className="text-lg">{icon}</div>
      <div className="text-white font-bold text-sm">{value}</div>
      <div className="text-slate-500 text-[10px]">{label}</div>
    </div>
  );
}

function DPadButton({ direction, engine, icon }: {
  direction: Direction;
  engine: GameEngine | null;
  icon: string;
}) {
  return (
    <button
      onTouchStart={(e) => {
        e.preventDefault();
        engine?.setDirection(direction);
      }}
      className="bg-slate-700/80 rounded-xl flex items-center justify-center text-lg text-slate-300 active:bg-slate-600 active:text-white touch-manipulation border border-slate-600/30 transition-colors"
    >
      {icon}
    </button>
  );
}
