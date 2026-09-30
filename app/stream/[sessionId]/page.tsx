'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StreamDemoPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [activeApp, setActiveApp] = useState<'cyberpunk' | 'blender' | 'terminal' | null>('cyberpunk');
  const [fps, setFps] = useState(144);
  const [ping, setPing] = useState(12);
  const [fullscreen, setFullscreen] = useState(false);
  const [gameRunning, setGameRunning] = useState(true);

  // Simulate FPS fluctuation for realism
  useEffect(() => {
    const timer = setInterval(() => {
      setFps(Math.floor(138 + Math.random() * 12));
      setPing(Math.floor(10 + Math.random() * 4));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`stream-container ${fullscreen ? 'is-fullscreen' : ''}`}>
      {/* AnyDesk-style Remote Desktop Bar */}
      <header className="stream-header">
        <div className="stream-title">
          <span className="dot dot-live" />
          <span className="brand-name">HyperDesk Stream</span>
          <span className="divider">|</span>
          <span className="session-id mono">Session: {sessionId}</span>
        </div>

        <div className="stream-stats">
          <div className="stat-pill"><span className="stat-icon">⚡</span> {fps} FPS</div>
          <div className="stat-pill"><span className="stat-icon">📡</span> {ping} ms</div>
          <div className="stat-pill"><span className="stat-icon">🔒</span> x402 Signed (Algorand)</div>
        </div>

        <div className="stream-controls">
          <button className="btn-icon" title="Toggle Fullscreen" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? '📉 Exit Fullscreen' : '📺 Fullscreen'}
          </button>
          <button className="btn-disconnect" onClick={() => router.push('/sessions')}>
            🔴 Disconnect
          </button>
        </div>
      </header>

      {/* Interactive Remote Screen */}
      <main className="remote-screen">
        {/* Desktop Icons */}
        <div className="desktop-icons">
          <button
            className={`desktop-icon ${activeApp === 'cyberpunk' ? 'active' : ''}`}
            onClick={() => { setActiveApp('cyberpunk'); setGameRunning(true); }}
          >
            <span className="icon-emoji">🎮</span>
            <span className="icon-name">Cyberpunk 2077</span>
          </button>

          <button
            className={`desktop-icon ${activeApp === 'blender' ? 'active' : ''}`}
            onClick={() => setActiveApp('blender')}
          >
            <span className="icon-emoji">🎨</span>
            <span className="icon-name">Blender 4.0</span>
          </button>

          <button
            className={`desktop-icon ${activeApp === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveApp('terminal')}
          >
            <span className="icon-emoji">⚡</span>
            <span className="icon-name">Benchmark Terminal</span>
          </button>
        </div>

        {/* Active Application Windows */}
        <div className="screen-viewport">
          {activeApp === 'cyberpunk' && (
            <div className="window-app window-game">
              <div className="window-bar">
                <span>🎮 Cyberpunk 2077 — RTX Path Tracing Demo (Host Stream)</span>
                <div className="window-btns">
                  <span className="w-btn min" />
                  <span className="w-btn max" />
                  <span className="w-btn close" onClick={() => setActiveApp(null)} />
                </div>
              </div>

              <div className="game-viewport">
                <div className="game-overlay-stats">
                  <div>RTX ON · DLSS 3.5 Frame Gen</div>
                  <div>FPS: <strong>{fps}</strong> · Resolution: 4K 3840x2160</div>
                  <div>GPU Temp: 62°C · VRAM: 14.2 GB / 24 GB</div>
                </div>

                <div className="simulated-game-screen">
                  <div className="game-city-landscape">
                    <div className="neon-tower">CYBERPUNK</div>
                    <div className="synth-sun" />
                    <div className="car-motion" />
                  </div>
                  <div className="crosshair" />
                </div>

                <div className="game-controls-bar">
                  <button className="btn-game-act" onClick={() => setGameRunning(!gameRunning)}>
                    {gameRunning ? '⏸️ Pause Demo' : '▶️ Resume Gameplay'}
                  </button>
                  <span className="game-hint">🎮 Click desktop icons to switch apps in real time</span>
                </div>
              </div>
            </div>
          )}

          {activeApp === 'blender' && (
            <div className="window-app window-blender">
              <div className="window-bar">
                <span>🎨 Blender 4.2 — Cycles GPU Compute Benchmark</span>
                <div className="window-btns">
                  <span className="w-btn min" />
                  <span className="w-btn max" />
                  <span className="w-btn close" onClick={() => setActiveApp(null)} />
                </div>
              </div>

              <div className="blender-body">
                <div className="blender-sidebar">
                  <h4>Cycles Render Engine</h4>
                  <p>Device: CUDA / OptiX (RTX 4090)</p>
                  <p>Samples: 4096 / 4096</p>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: '88%' }} /></div>
                  <p className="time-rem">Remaining: 00:04 sec</p>
                </div>
                <div className="blender-viewport-3d">
                  <div className="cube-3d" />
                  <div className="render-grid" />
                </div>
              </div>
            </div>
          )}

          {activeApp === 'terminal' && (
            <div className="window-app window-term">
              <div className="window-bar">
                <span>⚡ HyperDesk Benchmark Terminal</span>
                <div className="window-btns">
                  <span className="w-btn min" />
                  <span className="w-btn max" />
                  <span className="w-btn close" onClick={() => setActiveApp(null)} />
                </div>
              </div>

              <pre className="term-body">
                <code>{`
[hyperdesk@host-rig-beast ~]$ nvidia-smi
+---------------------------------------------------------------------------------------+
| NVIDIA-SMI 555.42.02              Driver Version: 555.42.02    CUDA Version: 12.5     |
|-----------------------------------+------------------------+--------------------------+
| GPU  Name                 Persistence-M | Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |
|                                   |                        |               MIG M. |
|===================================+========================+==========================|
|   0  NVIDIA GeForce RTX 4090        On  | 00000000:01:00.0  On |                  Off |
| 45%   58C    P0             280W / 450W |  14520MiB / 24564MiB |     98%      Default |
+-----------------------------------+------------------------+--------------------------+

[hyperdesk@host-rig-beast ~]$ x402-verify-credential --id ${sessionId}
✔ Verified credential signature against Algorand Box Storage (App ID: 10458941)
✔ Capability Status: ACTIVE
✔ Quota Remaining: 9 / 10 calls
✔ Expiry Round: Valid for next 10,000 rounds

[hyperdesk@host-rig-beast ~]$ ping -c 4 algonode.cloud
64 bytes from algonode.cloud: icmp_seq=1 ttl=56 time=11.2 ms
64 bytes from algonode.cloud: icmp_seq=2 ttl=56 time=10.8 ms
64 bytes from algonode.cloud: icmp_seq=3 ttl=56 time=11.4 ms
                `}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Windows Taskbar */}
        <footer className="remote-taskbar">
          <button className="start-btn">❖ Start</button>
          <div className="taskbar-apps">
            <button className="tb-app active">🎮 Cyberpunk</button>
            <button className="tb-app">🎨 Blender</button>
            <button className="tb-app">⚡ Terminal</button>
          </div>
          <div className="taskbar-clock">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .stream-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #09090b;
          color: #f4f4f5;
          font-family: system-ui, -apple-system, sans-serif;
          user-select: none;
        }
        .stream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 48px;
          padding: 0 16px;
          background: #18181b;
          border-bottom: 1px solid #27272a;
        }
        .stream-title { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; }
        .dot-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
        .brand-name { font-weight: 800; color: #ef4444; }
        .divider { color: #3f3f46; }
        .mono { font-family: monospace; }
        .stream-stats { display: flex; gap: 12px; }
        .stat-pill { background: #27272a; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px; }
        .stream-controls { display: flex; gap: 8px; }
        .btn-icon { background: #27272a; border: none; color: #f4f4f5; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .btn-disconnect { background: #ef4444; border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }

        .remote-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%);
          position: relative;
          overflow: hidden;
        }
        .desktop-icons {
          position: absolute;
          top: 20px;
          left: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 10;
        }
        .desktop-icon {
          background: transparent;
          border: 1px solid transparent;
          padding: 8px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #fff;
          cursor: pointer;
          width: 90px;
        }
        .desktop-icon:hover, .desktop-icon.active {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .icon-emoji { font-size: 2.2rem; }
        .icon-name { font-size: 0.72rem; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

        .screen-viewport {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .window-app {
          width: 80%;
          height: 80%;
          background: #18181b;
          border: 1px solid #3f3f46;
          border-radius: 12px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .window-bar {
          background: #27272a;
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .window-btns { display: flex; gap: 6px; }
        .w-btn { width: 12px; height: 12px; border-radius: 50%; display: inline-block; cursor: pointer; }
        .min { background: #febc2e; } .max { background: #28c840; } .close { background: #ff5f57; }

        .game-viewport { flex: 1; display: flex; flex-direction: column; background: #000; position: relative; }
        .game-overlay-stats { position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.7); padding: 8px 12px; border-radius: 6px; font-size: 0.75rem; font-family: monospace; color: #10b981; z-index: 5; }
        .simulated-game-screen { flex: 1; background: linear-gradient(180deg, #2e1065 0%, #030712 100%); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
        .game-city-landscape { text-align: center; }
        .neon-tower { font-size: 4rem; font-weight: 900; letter-spacing: 0.2em; color: #f43f5e; text-shadow: 0 0 30px #f43f5e; }
        .synth-sun { width: 120px; height: 120px; background: linear-gradient(180deg, #f59e0b, #ef4444); border-radius: 50%; margin: 20px auto 0; box-shadow: 0 0 50px #f59e0b; }
        .crosshair { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.6); border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .game-controls-bar { background: #18181b; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #27272a; }
        .btn-game-act { background: #ef4444; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; }
        .game-hint { font-size: 0.8rem; color: #a1a1aa; }

        .blender-body { flex: 1; display: flex; padding: 16px; gap: 16px; }
        .blender-sidebar { width: 220px; background: #27272a; padding: 14px; border-radius: 8px; font-size: 0.82rem; }
        .blender-sidebar h4 { margin: 0 0 10px; }
        .progress-bar { background: #3f3f46; height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background: #f59e0b; height: 100%; }
        .blender-viewport-3d { flex: 1; background: #09090b; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .cube-3d { width: 100px; height: 100px; background: #3b82f6; transform: rotateX(45deg) rotateZ(45deg); box-shadow: 0 0 30px #3b82f6; }

        .term-body { flex: 1; background: #09090b; color: #22c55e; padding: 16px; font-family: monospace; font-size: 0.85rem; overflow-y: auto; margin: 0; }

        .remote-taskbar { height: 40px; background: #18181b; border-top: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; padding: 0 12px; }
        .start-btn { background: #27272a; border: none; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .taskbar-apps { display: flex; gap: 4px; }
        .tb-app { background: transparent; border: none; color: #a1a1aa; padding: 4px 10px; font-size: 0.8rem; border-radius: 4px; }
        .tb-app.active { background: #27272a; color: #fff; }
        .taskbar-clock { font-size: 0.78rem; color: #a1a1aa; }
      `}</style>
    </div>
  );
}
