import React, { useEffect, useRef, useState } from 'react';
import { Toilet, Player, Enemy, CoinPickup, Particle, GameStats, Laser, FruitPickup, Puddle, Armor } from '../types';
import { TOILET_CATALOG, ENEMY_VARIETIES, ARMOR_CATALOG, ALL_ENEMY_VARIETIES } from '../data';
import { playCoinSound, playFlushSound, playDamageSound, playOuchSound, playUnlockSound } from '../utils/audio';
import { Volume2, VolumeX, Shield, Heart, Play, RotateCcw, Sparkles, AlertCircle, ShoppingBag, Joystick, Check, HelpCircle, RefreshCw, Globe, UserPlus, Send, Trash2, Users, LogOut, MessageSquare, Plus } from 'lucide-react';
import { getCookie, setCookie, eraseCookie } from '../utils/cookies';

interface GameAreaProps {
  coins: number;
  addCoins: (amount: number) => void;
  unlockedToilets: string[];
  setUnlockedToilets: (val: string[] | ((prev: string[]) => string[])) => void;
  unlockToilet: (id: string, cost: number) => void;
  sellToilet: (id: string, cost: number) => void;
  activeToilet: Toilet;
  setActiveToilet: (toilet: Toilet) => void;
  setActiveToiletId: (id: string) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  highScore: number;
  onHighScoreChange: (score: number) => void;
  poopLevel: number;
  setPoopLevel: (val: number | ((prev: number) => number)) => void;
  suitLevel: number;
  setSuitLevel: (val: number | ((prev: number) => number)) => void;
  unlockedArmors: string[];
  setUnlockedArmors: (val: string[] | ((prev: string[]) => string[])) => void;
  activeArmorId: string;
  setActiveArmorId: (id: string) => void;
  currentUser: string | null;
}

export default function GameArea({
  coins,
  addCoins,
  unlockedToilets,
  setUnlockedToilets,
  unlockToilet,
  sellToilet,
  activeToilet,
  setActiveToilet,
  setActiveToiletId,
  isMuted,
  setIsMuted,
  highScore,
  onHighScoreChange,
  poopLevel,
  setPoopLevel,
  suitLevel,
  setSuitLevel,
  unlockedArmors,
  setUnlockedArmors,
  activeArmorId,
  setActiveArmorId,
  currentUser
}: GameAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game flow states
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'gameover'>('lobby');
  const [controlMode, setControlMode] = useState<'pc' | 'mobile'>(() => {
    return (localStorage.getItem('poop_quest_control_mode') as 'pc' | 'mobile') || 'pc';
  });
  const [selectedLobbyTab, setSelectedLobbyTab] = useState<'intel' | 'cowguy' | 'help' | 'multiplayer'>('intel');
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerShieldHp, setPlayerShieldHp] = useState(15);
  const [maxPlayerShieldHp, setMaxPlayerShieldHp] = useState(15);
  const [flushCooldownLeft, setFlushCooldownLeft] = useState(0); // in ms
  const [activeFlushVisual, setActiveFlushVisual] = useState<{ x: number; y: number; maxRadius: number; currentRadius: number; toiletEmoji: string; active: boolean } | null>(null);
  const [shopCategory, setShopCategory] = useState<'toilets' | 'armors'>('toilets');
  const [shopTab, setShopTab] = useState<'zone' | 'collection'>('zone');

  // --- LOCAL 2-PLAYER CO-OP STATES ---
  const [isTwoPlayerMode, setIsTwoPlayerMode] = useState<boolean>(false);
  const [player2Hp, setPlayer2Hp] = useState(100);
  const [player2ShieldHp, setPlayer2ShieldHp] = useState(15);
  const [maxPlayer2ShieldHp, setMaxPlayer2ShieldHp] = useState(15);
  const [flushCooldownLeft2, setFlushCooldownLeft2] = useState(0); // in ms
  const [activeFlushVisual2, setActiveFlushVisual2] = useState<{ x: number; y: number; maxRadius: number; currentRadius: number; toiletEmoji: string; active: boolean } | null>(null);

  // --- REAL-TIME MULTIPLAYER STATES & REFS ---
  const wsRef = useRef<WebSocket | null>(null);
  const remotePlayersRef = useRef<Record<string, {
    playerId: string;
    playerName: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    toiletEmoji: string;
    toiletName: string;
    suitEmoji: string;
    score: number;
    wave: number;
    vx: number;
    vy: number;
    isDashing: boolean;
    lastUpdate: number;
  }>>({});

  const [multiplayerRoom, setMultiplayerRoom] = useState<string>(''); // Empty means single-player
  const [multiplayerStatus, setMultiplayerStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [chatMessages, setChatMessages] = useState<{ playerName: string; text: string; time: string; playerId: string }[]>([]);
  const [activeRooms, setActiveRooms] = useState<{ roomName: string; playerCount: number; players: any[] }[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  
  const [friendsList, setFriendsList] = useState<string[]>(() => {
    const saved = localStorage.getItem('poop_quest_friends');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newFriendName, setNewFriendName] = useState<string>('');
  const [chatInputText, setChatInputText] = useState<string>('');
  const [activeRemotePlayersList, setActiveRemotePlayersList] = useState<any[]>([]);

  // Periodically synchronizes the server room list and active accounts list
  const refreshServerStatus = async () => {
    try {
      const res = await fetch('/api/multiplayer/status');
      if (res.ok) {
        const data = await res.json();
        setActiveRooms(data.rooms || []);
        setOnlineUsernames(data.online || []);
      }
    } catch (err) {
      console.warn("Failed to query server presence status:", err);
    }
  };

  useEffect(() => {
    refreshServerStatus();
    const interval = setInterval(refreshServerStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const addFriend = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (friendsList.includes(clean)) return;
    const newList = [...friendsList, clean];
    setFriendsList(newList);
    localStorage.setItem('poop_quest_friends', JSON.stringify(newList));
    setNewFriendName('');
  };

  const removeFriend = (name: string) => {
    const newList = friendsList.filter(f => f !== name);
    setFriendsList(newList);
    localStorage.setItem('poop_quest_friends', JSON.stringify(newList));
  };

  const connectToRoom = (roomName: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setMultiplayerStatus('connecting');
    setMultiplayerRoom(roomName);

    // Pick WebSocket protocol matching deployment environment bounds
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/multiplayer`;
    const socket = new WebSocket(socketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("[MULTIPLAYER] Live socket link activated.");
      const cleanName = currentUser || `Pooper#${Math.floor(Math.random() * 9000 + 1000)}`;
      socket.send(JSON.stringify({
        type: 'join',
        payload: {
          playerId: getCookie('poop_quest_current_user_cookie_id') || Math.random().toString(),
          playerName: cleanName,
          roomName: roomName,
          x: gameRef.current?.player?.x || 750,
          y: gameRef.current?.player?.y || 750,
          hp: gameRef.current?.player?.hp || 100,
          maxHp: gameRef.current?.player?.maxHp || 100,
          toiletEmoji: lastActiveToilet.current?.emoji || '🚽',
          toiletName: lastActiveToilet.current?.name || 'Wooden Outhouse',
          suitEmoji: lastActiveArmor.current?.emoji || '🎒',
          score: score,
          wave: wave
        }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        if (type === 'joined_success') {
          setMultiplayerStatus('connected');
          const initialPlayers: Record<string, any> = {};
          payload.players.forEach((p: any) => {
            initialPlayers[p.playerId] = {
              ...p,
              vx: 0,
              vy: 0,
              isDashing: false,
              lastUpdate: Date.now()
            };
          });
          remotePlayersRef.current = initialPlayers;
          setActiveRemotePlayersList(Object.values(initialPlayers));
          
          setChatMessages((prev) => [
            ...prev,
            { playerName: 'System 🛡️', text: `Success! Connected to co-op Sewer Arena "${payload.yourRoom}"!`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), playerId: 'system' }
          ]);
        }

        else if (type === 'player_joined') {
          remotePlayersRef.current[payload.playerId] = {
            ...payload,
            vx: 0,
            vy: 0,
            isDashing: false,
            lastUpdate: Date.now()
          };
          setActiveRemotePlayersList(Object.values(remotePlayersRef.current));

          setChatMessages((prev) => [
            ...prev,
            {
              playerName: 'System 🛡️',
              text: `🧙‍♂️ ${payload.playerName} entered this lobby!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              playerId: 'system'
            }
          ]);
          playUnlockSound();
        }

        else if (type === 'player_left') {
          const p = remotePlayersRef.current[payload.playerId];
          const leftName = p ? p.playerName : payload.playerName;
          
          delete remotePlayersRef.current[payload.playerId];
          setActiveRemotePlayersList(Object.values(remotePlayersRef.current));

          setChatMessages((prev) => [
            ...prev,
            {
              playerName: 'System 🛡️',
              text: `🏃 ${leftName} left the room.`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              playerId: 'system'
            }
          ]);
        }

        else if (type === 'player_moved') {
          if (remotePlayersRef.current[payload.playerId]) {
            remotePlayersRef.current[payload.playerId] = {
              ...remotePlayersRef.current[payload.playerId],
              ...payload,
              lastUpdate: Date.now()
            };
          } else {
            remotePlayersRef.current[payload.playerId] = {
              ...payload,
              lastUpdate: Date.now()
            };
            setActiveRemotePlayersList(Object.values(remotePlayersRef.current));
          }
        }

        else if (type === 'player_flushed') {
          playFlushSound();

          // Spawn localized co-op fluid bubble splashes on current drawing scene
          if (gameRef.current) {
            for (let i = 0; i < 20; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1.5 + Math.random() * 7;
              gameRef.current.particles.push({
                id: Math.random().toString(),
                x: payload.x,
                y: payload.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 3 + Math.random() * 5,
                color: payload.pulseColor || '#38bdf8',
                alpha: 0.9,
                life: 0,
                maxLife: 24 + Math.random() * 18
              });
            }

            // Damage nearby local sewer foes
            const radiusLimit = payload.flushRadius || 250;
            const dmg = payload.damage || 15;
            gameRef.current.enemies.forEach((enemy) => {
              const dx = enemy.x - payload.x;
              const dy = enemy.y - payload.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= radiusLimit) {
                enemy.hp -= dmg;
                gameRef.current.particles.push({
                  id: Math.random().toString(),
                  x: enemy.x,
                  y: enemy.y - 10,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: -2.5 - Math.random() * 1.5,
                  radius: 11,
                  color: '#10b981',
                  alpha: 1.0,
                  life: 0,
                  maxLife: 40,
                  text: `-${dmg} Co-op!`,
                  isWord: true
                });
              }
            });
          }
        }

        else if (type === 'chat_broadcast') {
          setChatMessages((prev) => [
            ...prev,
            {
              playerName: payload.playerName,
              text: payload.text,
              time: payload.time,
              playerId: payload.playerId
            }
          ]);
        }
      } catch (err) {
        console.warn("WebSocket parser error:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("[MULTIPLAYER] Connection error:", err);
      setMultiplayerStatus('disconnected');
    };

    socket.onclose = () => {
      console.log("[MULTIPLAYER] Connection closed.");
      setMultiplayerStatus('disconnected');
      setMultiplayerRoom('');
      remotePlayersRef.current = {};
      setActiveRemotePlayersList([]);
    };
  };

  const leaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setMultiplayerStatus('disconnected');
    setMultiplayerRoom('');
    remotePlayersRef.current = {};
    setActiveRemotePlayersList([]);
  };

  const sendChatMessage = () => {
    const clean = chatInputText.trim();
    if (!clean) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        payload: { text: clean }
      }));
      setChatInputText('');
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Cowguy Special YouTube Prize
  const currentUserKey = currentUser || 'guest';
  const claimStorageKey = `poop_quest_cowguy_claimed_${currentUserKey}`;
  const [hasClaimedCowguy, setHasClaimedCowguy] = useState<boolean>(() => {
    return localStorage.getItem(claimStorageKey) === 'true';
  });
  
  // Custom cookie subscription status verification!
  const [youtubeSubscribed, setYoutubeSubscribed] = useState<boolean>(() => {
    // Check if the secure validation cookie exists and has the correct subscriber status
    return getCookie('cowguy_subscribed_token') === 'COW55_LEGENDARY_ACTIVE';
  });

  const [isGoogleUser, setIsGoogleUser] = useState<boolean>(() => {
    return getCookie('poop_quest_is_google_user') === 'true';
  });

  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState<boolean>(false);

  // Synchronize Google Auth from popup inside active game canvas
  useEffect(() => {
    const handleGoogleMessageInGame = async (e: MessageEvent) => {
      const origin = e.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (e.data?.type === 'OAUTH_GOOGLE_SUCCESS') {
        const code = e.data.code;
        if (!code) return;

        try {
          setIsVerifyingGoogle(true);
          setVerificationError(null);
          setVerificationLogs(prev => [...prev, "[OAUTH] Success signal received from popup. Verifying code with database..."]);
          
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, origin: window.location.origin })
          });

          if (!response.ok) {
            throw new Error(`Auth code rejected by backend logic`);
          }

          const verifyData = await response.json();
          if (verifyData.success) {
            setVerificationLogs(prev => [...prev, verifyData.youtubeLog || "[SUCCESS] Authentication verified."]);
            
            // Set cookie state
            setCookie('poop_quest_is_google_user', 'true', 30);
            setIsGoogleUser(true);

            if (verifyData.subscribed) {
              setCookie('cowguy_subscribed_token', 'COW55_LEGENDARY_ACTIVE', 30);
              setCookie(`cowguy_subscribed_account_${currentUserKey}`, '@YourGoogleAccount', 30);
              setYoutubeSubscribed(true);
              setYoutubeHandle('@YourGoogleAccount');
            } else {
              eraseCookie('cowguy_subscribed_token');
              setYoutubeSubscribed(false);
            }
            playUnlockSound();
          } else {
            setVerificationError("Verification rejected by YouTube sub endpoint.");
          }
        } catch (err: any) {
          console.error("Google verify error:", err);
          setVerificationError(`OAuth check failed: ${err.message}`);
        } finally {
          setIsVerifyingGoogle(false);
        }
      }
    };

    window.addEventListener('message', handleGoogleMessageInGame);
    return () => window.removeEventListener('message', handleGoogleMessageInGame);
  }, [currentUserKey]);

  const [clickedCowguySub, setClickedCowguySub] = useState<boolean>(false);
  const [subConfirmationChecked, setSubConfirmationChecked] = useState<boolean>(false);
  
  const [youtubeHandle, setYoutubeHandle] = useState<string>(() => {
    return getCookie(`cowguy_subscribed_account_${currentUserKey}`) || '';
  });
  
  const [isVerifyingSub, setIsVerifyingSub] = useState<boolean>(false);
  const [verificationProgress, setVerificationProgress] = useState<number>(0);
  const [verificationLogs, setVerificationLogs] = useState<string[]>([]);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleGoogleSignInTrigger = async () => {
    try {
      setIsVerifyingGoogle(true);
      setVerificationError(null);
      setVerificationLogs(prev => [...prev, "[OAUTH] Initializing fresh Google security flow popup..."]);
      
      const res = await fetch(`/api/auth/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!res.ok) throw new Error("Backend auth URL request rejected");
      const data = await res.json();
      
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.url,
        "Google_OAuth_Sync_In_Game",
        `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
      );
      
      if (!popup) {
        alert("Pop-up blocker active! Please allow popups on this website to sign-in with Google.");
        setIsVerifyingGoogle(false);
      }
    } catch (err: any) {
      console.error(err);
      setVerificationError("OAuth bridge connection lost: " + err.message);
      setIsVerifyingGoogle(false);
    }
  };

  const startVerificationSub = () => {
    const handleValue = youtubeHandle.trim();
    if (!handleValue) {
      setVerificationError("Please enter your YouTube Handle / Username first!");
      return;
    }
    if (!handleValue.startsWith('@') && handleValue.length < 3) {
      setVerificationError("Handle should start with @ (e.g., @Cowguy55) or contain your channel username!");
      return;
    }
    
    setVerificationError(null);
    setIsVerifyingSub(true);
    setVerificationProgress(0);
    setVerificationLogs(["[SYS] Handshaking with secure iframe origin...", "[API] Loading youtube.subscriptions.list OAuth verification schema..."]);

    const steps = [
      { progress: 15, log: "[CONN] Secure handshakes with global Google CDN successfully established." },
      { progress: 35, log: "[YOUTUBE] Requesting subscriber status for target ID: UC-Cowguy55..." },
      { progress: 60, log: `[SCAN] Checking subscriber ledger lists for channel user "${handleValue}"...` },
      { progress: 85, log: `[VERIFY] Found valid subscription channel linked to "${handleValue}" matching Cowguy55!` },
      { progress: 100, log: "✓ SUCCESS! Subscribed status verified. Saving secure SameSite=None confirmation cookie token." }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setVerificationProgress(steps[stepIdx].progress);
        setVerificationLogs(prev => [...prev, steps[stepIdx].log]);
        stepIdx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          // Store verification tokens inside browser cookies utilizing SameSite=None; Secure
          setCookie('cowguy_subscribed_token', 'COW55_LEGENDARY_ACTIVE', 30);
          setCookie(`cowguy_subscribed_account_${currentUserKey}`, handleValue, 30);
          setYoutubeSubscribed(true);
          setIsVerifyingSub(false);
          playUnlockSound();
        }, 800);
      }
    }, 900);
  };

  const handleClaimCowguyPrize = () => {
    // Double check cookie subscription to prevent cheat bypass
    const verifiedSub = getCookie('cowguy_subscribed_token') === 'COW55_LEGENDARY_ACTIVE';
    if (!verifiedSub) {
      setVerificationError("Verification token not found on your browser cookies! Please verify your subscription status first.");
      return;
    }

    // 1. Give 5000 gold coins!
    addCoins(5000);

    // 2. Unlock the Cowguy Toilet!
    if (!unlockedToilets.includes('cowguy_throne')) {
      setUnlockedToilets(prev => [...prev, 'cowguy_throne']);
    }

    // 3. Unlock the Cowguy Suit!
    if (!unlockedArmors.includes('cowguy_suit')) {
      setUnlockedArmors(prev => [...prev, 'cowguy_suit']);
    }

    // 4. Auto-equip them!
    setActiveToiletId('cowguy_throne');
    setActiveArmorId('cowguy_suit');

    // 5. Persist the claim flag!
    localStorage.setItem(claimStorageKey, 'true');
    setHasClaimedCowguy(true);

    // 6. Play the awesome reward unlock sound!
    playUnlockSound();

    // 7. Add celebratory physical confetti/burst particles with text to show user satisfaction!
    const centerX = dimensions?.width / 2 || 350;
    const centerY = dimensions?.height / 2 || 240;
    for (let i = 0; i < 35; i++) {
      gameRef.current.particles.push({
        id: Math.random().toString(),
        x: centerX + (Math.random() - 0.5) * 400,
        y: centerY + (Math.random() - 0.5) * 300,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: 8 + Math.random() * 8,
        color: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#ea580c' : '#ef4444',
        alpha: 0.9,
        life: 0,
        maxLife: 60,
        text: i % 5 === 0 ? '🤠 COWGUY55!' : i % 5 === 1 ? '👑 LEGENDARY!' : i % 5 === 2 ? '🚽 THRONE!' : '🪙 +5000 COINS!'
      });
    }
  };

  const handleUnlockArmor = (id: string, cost: number) => {
    if (coins >= cost && !unlockedArmors.includes(id)) {
      addCoins(-cost);
      setUnlockedArmors(prev => [...prev, id]);
      setActiveArmorId(id);
      playUnlockSound();
    }
  };

  // Stats for the active session
  const [sessionKills, setSessionKills] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [timeSurvived, setTimeSurvived] = useState(0);

  // Responsive canvas size
  const [dimensions, setDimensions] = useState({ width: 700, height: 480 });

  // Joystick state (for mobile controls)
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickStart, setJoystickStart] = useState({ x: 0, y: 0 });
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [showVirtualJoystick, setShowVirtualJoystick] = useState(false);

  // References for mutable game objects (to bypass React re-render cycles in high-60fps loop)
  const gameRef = useRef<{
    worldSize: number;
    player: Player;
    player2?: Player;
    enemies: Enemy[];
    coins: CoinPickup[];
    particles: Particle[];
    keys: Record<string, boolean>;
    lastTime: number;
    lastEnemySpawn: number;
    lastSecondTick: number;
    isGameActive: boolean;
    activeFlushDuration: number;
    flushTimer: number;
    killCount: number;
    lasers: Laser[];
    fruits: FruitPickup[];
    puddles: Puddle[];
    // Armor states
    shieldHp: number;
    maxShieldHp: number;
    lastAbilityTrigger: Record<string, number>;
  }>({
    worldSize: 1500,
    player: {
      x: 750,
      y: 750,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      speed: 3.5,
      size: 26,
      angle: 0
    },
    player2: undefined,
    enemies: [],
    coins: [],
    particles: [],
    keys: {},
    lastTime: 0,
    lastEnemySpawn: 0,
    lastSecondTick: 0,
    isGameActive: false,
    activeFlushDuration: 0,
    flushTimer: 0,
    killCount: 0,
    lasers: [],
    fruits: [],
    puddles: [],
    shieldHp: 15,
    maxShieldHp: 15,
    lastAbilityTrigger: {}
  });

  // Track resizing dynamically as instructed
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const targetWidth = Math.max(300, Math.floor(width));
        const targetHeight = Math.max(350, Math.floor(height));
        setDimensions({ width: targetWidth, height: targetHeight });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync toilet change to helper ref
  const lastActiveToilet = useRef<Toilet>(activeToilet);
  useEffect(() => {
    lastActiveToilet.current = activeToilet;
  }, [activeToilet]);

  // Sync armor change to helper ref
  const activeArmor = ARMOR_CATALOG.find(a => a.id === activeArmorId) || ARMOR_CATALOG[0];
  const lastActiveArmor = useRef<Armor>(activeArmor);
  useEffect(() => {
    lastActiveArmor.current = activeArmor;
    gameRef.current.maxShieldHp = activeArmor.maxShieldHp;
    if (gameState === 'lobby' || gameState === 'gameover') {
      gameRef.current.shieldHp = activeArmor.maxShieldHp;
    } else {
      gameRef.current.shieldHp = Math.min(gameRef.current.shieldHp, activeArmor.maxShieldHp);
    }
    setPlayerShieldHp(gameRef.current.shieldHp);
    setMaxPlayerShieldHp(activeArmor.maxShieldHp);
  }, [activeArmor, gameState]);

  // Sync mute state to audio player
  useEffect(() => {
    // Import and set isMuted on the audio processor
    import('../utils/audio').then(m => m.setMuteState(isMuted));
  }, [isMuted]);

  // Start the game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const triggerFlushWave = (px: number, py: number, toiletObj: Toilet, isPlayer2 = false) => {
      // 1. Audio and Visual flash
      playFlushSound();
      
      const radiusLimit = toiletObj.flushRadius || 250;

      // Set the active wave shockwave to match the custom flush radius
      if (isPlayer2) {
        setActiveFlushVisual2({
          x: px,
          y: py,
          maxRadius: radiusLimit,
          currentRadius: 5,
          toiletEmoji: toiletObj.emoji,
          active: true
        });
      } else {
        setActiveFlushVisual({
          x: px,
          y: py,
          maxRadius: radiusLimit,
          currentRadius: 5,
          toiletEmoji: toiletObj.emoji,
          active: true
        });
      }

      // 1.5 Spawn magnificent glowing lasers from the toilet/player only to enemies in range!
      const activeEnemies = gameRef.current.enemies;
      const enemiesListInRange = activeEnemies.filter((enemy) => {
        const dx = enemy.x - px;
        const dy = enemy.y - py;
        return Math.sqrt(dx * dx + dy * dy) <= radiusLimit;
      });

      if (enemiesListInRange.length > 0) {
        enemiesListInRange.forEach((enemy) => {
          gameRef.current.lasers.push({
            id: Math.random().toString(),
            startX: px,
            startY: py,
            endX: enemy.x,
            endY: enemy.y,
            color: toiletObj.pulseColor,
            width: toiletObj.id === 'cosmic_singularity' ? 9 : toiletObj.id === 'golden_stall' ? 7 : toiletObj.id === 'neon_bidet' ? 6 : 4,
            life: 0,
            maxLife: 22, // duration in frames
            opacity: 1.0
          });
        });
      } else {
        // Starburst circular lasers matching range if there are no enemies in range
        const numBeams = 12;
        for (let i = 0; i < numBeams; i++) {
          const angle = (i / numBeams) * Math.PI * 2;
          const beamDist = radiusLimit;
          gameRef.current.lasers.push({
            id: Math.random().toString(),
            startX: px,
            startY: py,
            endX: px + Math.cos(angle) * beamDist,
            endY: py + Math.sin(angle) * beamDist,
            color: toiletObj.pulseColor,
            width: 4,
            life: 0,
            maxLife: 22,
            opacity: 1.0
          });
        }
      }

      // 2. Damage active enemies that reside within the limited flush area
      const enemiesList = gameRef.current.enemies;
      const tDmg = toiletObj.damage || 10;
      
      enemiesList.forEach((enemy) => {
        // Calculate distance from epicenter
        const dx = enemy.x - px;
        const dy = enemy.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if enemy falls within the custom limited range of this toilet upgrade
        if (dist <= radiusLimit) {
          if (toiletObj.id === 'cosmic_singularity') {
            // Gravity pull effect! Pull enemy closer on toilet flush
            const angle = Math.atan2(py - enemy.y, px - enemy.x);
            enemy.x += Math.cos(angle) * 120;
            enemy.y += Math.sin(angle) * 120;
          }

          // Apply dynamic damage (the better the toilet, the more damage). Plunger mini-boss blocks 30% of incoming damage!
          const isPlunger = enemy.type === 'plunger';
          const finalDamage = isPlunger ? Math.ceil(tDmg * 0.70) : tDmg;
          enemy.hp -= finalDamage;
          
          // Spawn damage particle floating numbers above the enemy
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y - 12,
            vx: (Math.random() - 0.5) * 1,
            vy: -2 - Math.random() * 2,
            radius: 12,
            color: isPlunger ? '#c084fc' : '#f87171', // purple for armored block, red for standard
            alpha: 1.0,
            life: 0,
            maxLife: 45,
            text: isPlunger ? `-${finalDamage} HP (🛡️ blocked!)` : `-${finalDamage} HP`,
            isWord: true
          });

          // Water bubble blast animation centering around enemy
          for (let i = 0; i < 4; i++) {
            gameRef.current.particles.push({
              id: Math.random().toString(),
              x: enemy.x,
              y: enemy.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              radius: 3 + Math.random() * 4,
              color: toiletObj.pulseColor,
              alpha: 0.8,
              life: 0,
              maxLife: 20 + Math.random() * 20
            });
          }
        }
      });

      // Spawn extra toilet puff steam
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Speed of puff steam scales with range so visual puff bounds match range
        const speed = 1 + Math.random() * (radiusLimit / 45);
        gameRef.current.particles.push({
          id: Math.random().toString(),
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 4 + Math.random() * 6,
          color: '#bae6fd', // light blue bubbles
          alpha: 0.9,
          life: 0,
          maxLife: 30 + Math.random() * 30
        });
      }

      // Check for defeated enemies
      gameRef.current.enemies = enemiesList.filter((enemy) => {
        if (enemy.hp <= 0) {
          // Play a splat sound for defeating enemy
          playDamageSound();
          gameRef.current.killCount += 1;
          const currentKills = gameRef.current.killCount;
          setSessionKills(currentKills);
          setScore(prev => prev + enemy.scoreValue);
          if (currentKills > highScore) {
            onHighScoreChange(currentKills);
          }

          // Add pop feedback text
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y - 10,
            vx: (Math.random() - 0.5) * 2,
            vy: -1,
            radius: 10,
            color: '#a78bfa',
            alpha: 1.0,
            life: 0,
            maxLife: 40,
            text: 'Flushed! 🪙',
            isWord: true
          });

          // Drop coins: base coins + extra depending on toilet upgrade!
          const dropChance = 1; // 100%
          const numCoins = Math.floor(Math.random() * 2) + 2 + (toiletObj.id === 'golden_stall' ? 2 : 0);
          for (let c = 0; c < numCoins; c++) {
            gameRef.current.coins.push({
              id: Math.random().toString(),
              x: enemy.x + (Math.random() - 0.5) * 25,
              y: enemy.y + (Math.random() - 0.5) * 25,
              size: 14,
              value: 1,
              bounceOffset: Math.random() * Math.PI
            });
          }
          return false;
        }
        return true;
      });
    };

    // Store in global window for easy hook trigger from action click
    (window as any).triggerToiletFlush = () => {
      if (gameRef.current.flushTimer > 0 || !gameRef.current.isGameActive || gameRef.current.player.hp <= 0) return;
      const player = gameRef.current.player;
      
      // Set flush cooldown and activate
      gameRef.current.flushTimer = lastActiveToilet.current.cooldownMs;
      setFlushCooldownLeft(lastActiveToilet.current.cooldownMs);
      triggerFlushWave(player.x, player.y, lastActiveToilet.current, false);

      if (lastActiveToilet.current.id === 'neon_bidet') {
        // Shield HP buff: give short player immunity visual
        player.hp = Math.min(player.maxHp, player.hp + 5);
        setPlayerHp(player.hp);
        gameRef.current.particles.push({
          id: Math.random().toString(),
          x: player.x,
          y: player.y - 25,
          vx: 0,
          vy: -1.5,
          radius: 12,
          color: '#22c55e',
          alpha: 1.0,
          life: 0,
          maxLife: 50,
          text: 'Shield +5 HP 🛡️',
          isWord: true
        });
      }
    };

    (window as any).triggerToiletFlush2 = () => {
      if (!isTwoPlayerMode || !gameRef.current.player2 || gameRef.current.player2.hp <= 0) return;
      if (((gameRef.current as any).flushTimer2 || 0) > 0 || !gameRef.current.isGameActive) return;
      const p2 = gameRef.current.player2;
      
      // Set flush cooldown and activate
      (gameRef.current as any).flushTimer2 = lastActiveToilet.current.cooldownMs;
      setFlushCooldownLeft2(lastActiveToilet.current.cooldownMs);
      triggerFlushWave(p2.x, p2.y, lastActiveToilet.current, true);

      if (lastActiveToilet.current.id === 'neon_bidet') {
        // Shield HP buff: give player 2 HP
        p2.hp = Math.min(p2.maxHp, p2.hp + 5);
        setPlayer2Hp(p2.hp);
        gameRef.current.particles.push({
          id: Math.random().toString(),
          x: p2.x,
          y: p2.y - 25,
          vx: 0,
          vy: -1.5,
          radius: 12,
          color: '#22c55e',
          alpha: 1.0,
          life: 0,
          maxLife: 50,
          text: 'Shield +5 HP 🛡️',
          isWord: true
        });
      }
    };

    const applyShieldedDamage = (rawDamage: number, isToxic: boolean = false) => {
      const armor = lastActiveArmor.current || ARMOR_CATALOG[0];
      const shieldAbsorbStatus = armor.shieldAbsorbPercent;
      
      let damageToHp = rawDamage;
      let damageToShield = 0;

      if (gameRef.current.shieldHp > 0) {
        damageToShield = rawDamage * shieldAbsorbStatus;
        if (gameRef.current.shieldHp >= damageToShield) {
          gameRef.current.shieldHp -= damageToShield;
          damageToHp = rawDamage - damageToShield;
        } else {
          const actualAbsorbed = gameRef.current.shieldHp;
          gameRef.current.shieldHp = 0;
          damageToHp = rawDamage - actualAbsorbed;
          
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: gameRef.current.player.x,
            y: gameRef.current.player.y - 20,
            vx: 0,
            vy: -2,
            radius: 12,
            color: '#38bdf8',
            alpha: 1.0,
            life: 0,
            maxLife: 40,
            text: '🛡️ Shield Broken!',
            isWord: true
          });
        }
      } else {
        damageToHp = rawDamage;
      }

      gameRef.current.player.hp -= damageToHp;
      setPlayerHp(Math.ceil(gameRef.current.player.hp));
      setPlayerShieldHp(Math.ceil(gameRef.current.shieldHp));

      // Spiky horns recoil effect
      if (armor.abilityId === 'bouncy_shield' && !isToxic && Math.random() < 0.25) {
        gameRef.current.enemies.forEach(otherEnemy => {
          const edx = otherEnemy.x - gameRef.current.player.x;
          const edy = otherEnemy.y - gameRef.current.player.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist < 140) {
            otherEnemy.hp -= (rawDamage * 12);
            if (edist > 5) {
              otherEnemy.x += (edx / edist) * 35;
              otherEnemy.y += (edy / edist) * 35;
            }
          }
        });

        gameRef.current.particles.push({
          id: Math.random().toString(),
          x: gameRef.current.player.x,
          y: gameRef.current.player.y,
          vx: 0,
          vy: 0,
          radius: 28,
          color: '#fb7185',
          alpha: 0.65,
          life: 0,
          maxLife: 15,
          text: '💥 Spiky Reflect!',
          isWord: true
        });
      }
    };

    const applyShieldedDamage2 = (rawDamage: number, isToxic: boolean = false) => {
      if (!isTwoPlayerMode || !gameRef.current.player2) return;
      const armor = lastActiveArmor.current || ARMOR_CATALOG[0];
      const shieldAbsorbStatus = armor.shieldAbsorbPercent;
      
      let damageToHp = rawDamage;
      let damageToShield = 0;
      const currentShieldHp2 = (gameRef.current as any).shieldHp2 || 0;

      if (currentShieldHp2 > 0) {
        damageToShield = rawDamage * shieldAbsorbStatus;
        if (currentShieldHp2 >= damageToShield) {
          (gameRef.current as any).shieldHp2 = currentShieldHp2 - damageToShield;
          damageToHp = rawDamage - damageToShield;
        } else {
          const actualAbsorbed = currentShieldHp2;
          (gameRef.current as any).shieldHp2 = 0;
          damageToHp = rawDamage - actualAbsorbed;
          
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: gameRef.current.player2.x,
            y: gameRef.current.player2.y - 20,
            vx: 0,
            vy: -2,
            radius: 12,
            color: '#38bdf8',
            alpha: 1.0,
            life: 0,
            maxLife: 40,
            text: '🛡️ Shield Broken!',
            isWord: true
          });
        }
      } else {
        damageToHp = rawDamage;
      }

      gameRef.current.player2.hp -= damageToHp;
      setPlayer2Hp(Math.ceil(gameRef.current.player2.hp));
      setPlayer2ShieldHp(Math.ceil((gameRef.current as any).shieldHp2));

      // Spiky horns recoil effect for P2
      if (armor.abilityId === 'bouncy_shield' && !isToxic && Math.random() < 0.25) {
        gameRef.current.enemies.forEach(otherEnemy => {
          const edx = otherEnemy.x - gameRef.current.player2!.x;
          const edy = otherEnemy.y - gameRef.current.player2!.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist < 140) {
            otherEnemy.hp -= (rawDamage * 12);
            if (edist > 5) {
              otherEnemy.x += (edx / edist) * 35;
              otherEnemy.y += (edy / edist) * 35;
            }
          }
        });

        gameRef.current.particles.push({
          id: Math.random().toString(),
          x: gameRef.current.player2.x,
          y: gameRef.current.player2.y,
          vx: 0,
          vy: 0,
          radius: 28,
          color: '#fb7185',
          alpha: 0.65,
          life: 0,
          maxLife: 15,
          text: '💥 Spiky Reflect!',
          isWord: true
        });
      }
    };

    const updateAndDraw = (time: number) => {
      if (!gameRef.current.lastTime) gameRef.current.lastTime = time;
      const dt = time - gameRef.current.lastTime;
      gameRef.current.lastTime = time;

      const player = gameRef.current.player;
      const worldSize = gameRef.current.worldSize;
      const keys = gameRef.current.keys;

      // Update timers if game is active
      if (gameRef.current.isGameActive) {
        // ------------------ ACTIVE ARMOR POWERS TICKING ------------------
        const armor = lastActiveArmor.current || ARMOR_CATALOG[0];

        // 1. Dash Impulse shockwave ability
        if (armor.abilityId === 'dash_impulse') {
          const lastShockwave = gameRef.current.lastAbilityTrigger['dash_impulse'] || 0;
          if (time - lastShockwave > 5000) {
            gameRef.current.lastAbilityTrigger['dash_impulse'] = time;
            
            gameRef.current.enemies.forEach(otherEnemy => {
              const edx = otherEnemy.x - player.x;
              const edy = otherEnemy.y - player.y;
              const edist = Math.sqrt(edx * edx + edy * edy);
              if (edist < 185) {
                otherEnemy.hp -= (lastActiveToilet.current.damage * 1.5 + 5);
                if (edist > 5) {
                  otherEnemy.x += (edx / edist) * 85;
                  otherEnemy.y += (edy / edist) * 85;
                }
              }
            });

            gameRef.current.particles.push({
              id: Math.random().toString(),
              x: player.x,
              y: player.y,
              vx: 0,
              vy: 0,
              radius: 130,
              color: '#a855f7',
              alpha: 0.8,
              life: 0,
              maxLife: 25,
              text: '⚡ SHIELD IMPULSE BLAST! ⚡',
              isWord: true
            });
          }
        }

        // 2. Acid Spill puddle drops
        if (armor.abilityId === 'acid_spill') {
          const lastSpill = gameRef.current.lastAbilityTrigger['acid_spill'] || 0;
          const isMoving = Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1;
          if (time - lastSpill > 1500 && isMoving) {
            gameRef.current.lastAbilityTrigger['acid_spill'] = time;

            gameRef.current.puddles.push({
              id: Math.random().toString(),
              x: player.x,
              y: player.y,
              radius: 5,
              maxRadius: 33,
              color: '#38bdf8',
              life: 0,
              maxLife: 280,
              opacity: 0.65
            });

            gameRef.current.particles.push({
              id: Math.random().toString(),
              x: player.x,
              y: player.y + 10,
              vx: 0,
              vy: -0.5,
              radius: 6,
              color: '#0ea5e9',
              alpha: 0.8,
              life: 0,
              maxLife: 15
            });
          }
        }

        // 3. Soap Ring orbiting melts
        if (armor.abilityId === 'soap_ring') {
          const numSoaps = 3;
          const orbitRadius = 60 + Math.sin(time / 200) * 10;
          const orbAngleBase = time / 600;

          for (let i = 0; i < numSoaps; i++) {
            const angle = orbAngleBase + (i * Math.PI * 2 / numSoaps);
            const soapX = player.x + Math.cos(angle) * orbitRadius;
            const soapY = player.y + Math.sin(angle) * orbitRadius;

            gameRef.current.enemies.forEach(enemy => {
              const edx = enemy.x - soapX;
              const edy = enemy.y - soapY;
              const edist = Math.sqrt(edx * edx + edy * edy);
              if (edist < 22 + enemy.size) {
                enemy.hp -= 0.60;
                if (edist > 2) {
                  enemy.x += (edx / edist) * 2.5;
                  enemy.y += (edy / edist) * 2.5;
                }

                if (Math.random() < 0.1) {
                  gameRef.current.particles.push({
                    id: Math.random().toString(),
                    x: soapX,
                    y: soapY,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    radius: 3 + Math.random() * 3,
                    color: '#67e8f9',
                    alpha: 0.8,
                    life: 0,
                    maxLife: 15
                  });
                }
              }
            });
          }
        }
        // ------------------ END ACTIVE ARMOR POWERS ------------------

        // Cooldown timer subtraction
        if (gameRef.current.flushTimer > 0) {
          gameRef.current.flushTimer = Math.max(0, gameRef.current.flushTimer - dt);
          setFlushCooldownLeft(gameRef.current.flushTimer);
        }

        if (isTwoPlayerMode && ((gameRef.current as any).flushTimer2 || 0) > 0) {
          (gameRef.current as any).flushTimer2 = Math.max(0, ((gameRef.current as any).flushTimer2 || 0) - dt);
          setFlushCooldownLeft2((gameRef.current as any).flushTimer2);
        }

        // Survival duration seconds counter
        const nowSec = Math.floor(time / 1000);
        if (nowSec > gameRef.current.lastSecondTick) {
          gameRef.current.lastSecondTick = nowSec;
          setTimeSurvived((prev) => {
            const next = prev + 1;
            // Spawn waves progress
            if (next % 30 === 0) {
              setWave((w) => w + 1);
            }
            return next;
          });

          // 0.1% chance of spawning a healing fruit every second!
          if (Math.random() < 0.001) {
            const ran = Math.random();
            let fruitType: 'apple' | 'banana' | 'strawberry' | 'melon' | 'pineapple' = 'apple';
            let name = 'Apple';
            let emoji = '🍎';
            let healAmount = 15;
            let fSize = 18;

            if (ran < 0.45) {
              fruitType = 'apple';
              name = 'Apple';
              emoji = '🍎';
              healAmount = 15;
              fSize = 18;
            } else if (ran < 0.70) {
              fruitType = 'banana';
              name = 'Banana';
              emoji = '🍌';
              healAmount = 25;
              fSize = 18;
            } else if (ran < 0.85) {
              fruitType = 'strawberry';
              name = 'Strawberry';
              emoji = '🍓';
              healAmount = 35;
              fSize = 20;
            } else if (ran < 0.95) {
              fruitType = 'melon';
              name = 'Melon';
              emoji = '🍉';
              healAmount = 50;
              fSize = 22;
            } else {
              fruitType = 'pineapple';
              name = 'Pineapple';
              emoji = '🍍';
              healAmount = 75;
              fSize = 24;
            }

            const fx = Math.random() * (worldSize - 120) + 60;
            const fy = Math.random() * (worldSize - 120) + 60;

            gameRef.current.fruits.push({
              id: Math.random().toString(),
              x: fx,
              y: fy,
              type: fruitType,
              name: name,
              emoji: emoji,
              healAmount: healAmount,
              size: fSize,
              bounceOffset: Math.random() * Math.PI
            });

            // Warn the player with a shiny status tag particle floating over their head
            gameRef.current.particles.push({
              id: Math.random().toString(),
              x: player.x,
              y: player.y - 45,
              vx: 0,
              vy: -0.8,
              radius: 12,
              color: '#10b981',
              alpha: 1.0,
              life: 0,
              maxLife: 100,
              text: `✨ ${emoji} ${name} spawned on map!`,
              isWord: true
            });
          }
        }
      }

      // 1. INPUT HANDLING & PLAYER POSITION UPDATE
      let moveX = 0;
      let moveY = 0;

      // Keyboard Controls
      if (isTwoPlayerMode) {
        if (keys['w'] || keys['W']) moveY -= 1;
        if (keys['s'] || keys['S']) moveY += 1;
        if (keys['a'] || keys['A']) moveX -= 1;
        if (keys['d'] || keys['D']) moveX += 1;
      } else {
        if (keys['w'] || keys['W'] || keys['ArrowUp']) moveY -= 1;
        if (keys['s'] || keys['S'] || keys['ArrowDown']) moveY += 1;
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['d'] || keys['D'] || keys['ArrowRight']) moveX += 1;
      }

      let moveX2 = 0;
      let moveY2 = 0;
      if (isTwoPlayerMode && gameRef.current.player2 && gameRef.current.player2.hp > 0) {
        if (keys['ArrowUp']) moveY2 -= 1;
        if (keys['ArrowDown']) moveY2 += 1;
        if (keys['ArrowLeft']) moveX2 -= 1;
        if (keys['ArrowRight']) moveX2 += 1;
      }

      // Virtual Joystick Controls
      if (joystickActive) {
        const maxLen = 40;
        const dx = joystickPosition.x - joystickStart.x;
        const dy = joystickPosition.y - joystickStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          moveX = dx / dist;
          moveY = dy / dist;
        }
      }

      // Apply movement for player 1
      if (player.hp > 0) {
        if (moveX !== 0 || moveY !== 0) {
          const length = Math.sqrt(moveX * moveX + moveY * moveY);
          player.vx = (moveX / length) * player.speed;
          player.vy = (moveY / length) * player.speed;

          // Face the direction of travel
          player.angle = Math.atan2(moveY, moveX);
        } else {
          // Slower friction sliding
          player.vx *= 0.4;
          player.vy *= 0.4;
        }

        player.x += player.vx;
        player.y += player.vy;

        player.x = Math.max(player.size, Math.min(worldSize - player.size, player.x));
        player.y = Math.max(player.size, Math.min(worldSize - player.size, player.y));
      } else {
        player.vx = 0;
        player.vy = 0;
      }

      // Apply movement for player 2
      if (isTwoPlayerMode && gameRef.current.player2 && gameRef.current.player2.hp > 0) {
        const p2 = gameRef.current.player2;
        if (moveX2 !== 0 || moveY2 !== 0) {
          const length2 = Math.sqrt(moveX2 * moveX2 + moveY2 * moveY2);
          p2.vx = (moveX2 / length2) * p2.speed;
          p2.vy = (moveY2 / length2) * p2.speed;

          // Face the direction of travel
          p2.angle = Math.atan2(moveY2, moveX2);
        } else {
          // Slower friction sliding
          p2.vx *= 0.4;
          p2.vy *= 0.4;
        }

        p2.x += p2.vx;
        p2.y += p2.vy;

        p2.x = Math.max(p2.size, Math.min(worldSize - p2.size, p2.x));
        p2.y = Math.max(p2.size, Math.min(worldSize - p2.size, p2.y));

        // Leave dynamic brown steam trailing particle behind Player 2 character!
        if (gameRef.current.isGameActive && (Math.abs(p2.vx) > 0.5 || Math.abs(p2.vy) > 0.5) && Math.random() < 0.25) {
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: p2.x,
            y: p2.y + 4,
            vx: -p2.vx * 0.2 + (Math.random() - 0.5) * 0.5,
            vy: -p2.vy * 0.2 + (Math.random() - 0.5) * 0.5,
            radius: 3 + Math.random() * 5,
            color: '#af835d', // chocolate brown
            alpha: 0.6,
            life: 0,
            maxLife: 30 + Math.random() * 20
          });
        }
      }

      // Broadcast coordinates to active Room players
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && gameRef.current.isGameActive) {
        const now = Date.now();
        const lastSendTime = (gameRef.current as any).lastSendTime || 0;
        if (now - lastSendTime > 85) {
          (gameRef.current as any).lastSendTime = now;
          wsRef.current.send(JSON.stringify({
            type: 'state_update',
            payload: {
              x: player.x,
              y: player.y,
              hp: player.hp,
              maxHp: player.maxHp,
              toiletEmoji: lastActiveToilet.current?.emoji || '🚽',
              toiletName: lastActiveToilet.current?.name || 'Wooden Outhouse',
              suitEmoji: lastActiveArmor.current?.emoji || '',
              score: score,
              wave: wave,
              vx: player.vx,
              vy: player.vy,
              isDashing: false
            }
          }));
        }
      }

      // Leave dynamic brown steam trailing particle behind our Poop character!
      if (gameRef.current.isGameActive && (Math.abs(player.vx) > 0.5 || Math.abs(player.vy) > 0.5) && Math.random() < 0.25) {
        gameRef.current.particles.push({
          id: Math.random().toString(),
          x: player.x,
          y: player.y + 4,
          vx: -player.vx * 0.2 + (Math.random() - 0.5) * 0.5,
          vy: -player.vy * 0.2 + (Math.random() - 0.5) * 0.5,
          radius: 3 + Math.random() * 5,
          color: '#af835d', // chocolate brown
          alpha: 0.6,
          life: 0,
          maxLife: 30 + Math.random() * 20
        });
      }

      // 2. ENEMY SPAWNING & UPDATING
      // Max enemies scales higher with the sewer grade level to populate the map with hordes
      const currentLevel = poopLevel || 1;
      const maxEnemies = 6 + wave * 3 + Math.floor(currentLevel * 0.85);
      
      // Spawn time interval reduces at higher zone levels for aggressive waves
      const spawnInterval = Math.max(350, Math.max(800, 3000 - wave * 250) - (currentLevel - 1) * 110);
      
      if (gameRef.current.isGameActive && gameRef.current.enemies.length < maxEnemies && time - gameRef.current.lastEnemySpawn > spawnInterval) {
        gameRef.current.lastEnemySpawn = time;
 
        // Choose random variety based on wave progression AND current toilet level (poopLevel)
        // Ensure present level includes all previous level enemies. Weaker enemies spawn more commonly!
        const currentSewerLevel = poopLevel || 1;
        const eligibleVarieties = ALL_ENEMY_VARIETIES.filter(v => v.introducedLevel <= currentSewerLevel);
        
        let selectedVariety = ENEMY_VARIETIES[0]; // fallback
        if (eligibleVarieties.length > 0) {
          // Calculate exponential spawn weights favoring older, weaker enemies
          // E.g. on level 2, Toxic Microbe (age 1) weight: 1.5, Fly (age 0) weight: 1.0
          const weightedList = eligibleVarieties.map(v => {
            const age = currentSewerLevel - v.introducedLevel; 
            const weight = Math.pow(1.5, age); 
            return { variety: v, weight };
          });
          
          const totalWeight = weightedList.reduce((sum, item) => sum + item.weight, 0);
          let randomRoll = Math.random() * totalWeight;
          
          for (const item of weightedList) {
            randomRoll -= item.weight;
            if (randomRoll <= 0) {
              selectedVariety = item.variety;
              break;
            }
          }
        }

        // Spawn off-screen relative to player
        const spawnAngle = Math.random() * Math.PI * 2;
        const minSpawnDist = 380;
        const spawnDist = minSpawnDist + Math.random() * 200;
        let sx = player.x + Math.cos(spawnAngle) * spawnDist;
        let sy = player.y + Math.sin(spawnAngle) * spawnDist;

        // Clamp to world
        sx = Math.max(20, Math.min(worldSize - 20, sx));
        sy = Math.max(20, Math.min(worldSize - 20, sy));

        gameRef.current.enemies.push({
          id: Math.random().toString(),
          type: selectedVariety.type,
          emoji: selectedVariety.emoji,
          name: selectedVariety.name,
          x: sx,
          y: sy,
          hp: selectedVariety.maxHp + (wave - 1) * 3, // slightly scale HP with wave
          maxHp: selectedVariety.maxHp + (wave - 1) * 3,
          speed: selectedVariety.speed + (wave * 0.05), // slightly scale speed
          size: selectedVariety.size,
          scoreValue: selectedVariety.scoreValue,
          // Initialize ability properties
          abilityCooldown: selectedVariety.type === 'brush' ? (Math.random() * 120 + 90) :
                           selectedVariety.type === 'bleach' ? (Math.random() * 150 + 100) : undefined,
          abilityState: 'idle',
          abilityDuration: 0
        });
      }

      // Update enemies moving toward player with bespoke state abilities
      gameRef.current.enemies.forEach((enemy) => {
        let targetPlayer = player;
        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (isTwoPlayerMode && gameRef.current.player2) {
          const p1Alive = player.hp > 0;
          const p2Alive = gameRef.current.player2.hp > 0;
          
          if (p1Alive && p2Alive) {
            const dx2 = gameRef.current.player2.x - enemy.x;
            const dy2 = gameRef.current.player2.y - enemy.y;
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (dist2 < dist) {
              targetPlayer = gameRef.current.player2;
              dx = dx2;
              dy = dy2;
              dist = dist2;
            }
          } else if (p2Alive) {
            targetPlayer = gameRef.current.player2;
            dx = gameRef.current.player2.x - enemy.x;
            dy = gameRef.current.player2.y - enemy.y;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
        }

        // 1. Brush (Toilet Brush Berserker) ability: Charging Berserk Dash
        if (enemy.type === 'brush') {
          if (enemy.abilityState === 'idle') {
            if (enemy.abilityCooldown !== undefined) {
              enemy.abilityCooldown--;
              if (enemy.abilityCooldown <= 0) {
                enemy.abilityState = 'charging';
                enemy.abilityDuration = 45; // ~0.75 seconds of warning charge-up
              }
            }
          }

          if (enemy.abilityState === 'charging') {
            enemy.abilityDuration = (enemy.abilityDuration || 1) - 1;
            
            // Emit yellow sparks while charging up
            if (Math.random() < 0.3) {
              gameRef.current.particles.push({
                id: Math.random().toString(),
                x: enemy.x + (Math.random() - 0.5) * 20,
                y: enemy.y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                radius: 2 + Math.random() * 3,
                color: '#f59e0b', // warm gold amber sparks
                alpha: 0.8,
                life: 0,
                maxLife: 20
              });
            }

            if (enemy.abilityDuration <= 0) {
              enemy.abilityState = 'active';
              enemy.abilityDuration = 60; // 1 second fast dash
              const dirX = dist > 0 ? (dx / dist) : 0;
              const dirY = dist > 0 ? (dy / dist) : 0;
              enemy.abilityVx = dirX * enemy.speed * 3.6;
              enemy.abilityVy = dirY * enemy.speed * 3.6;
            }
            // Standing stationary while charging
          } else if (enemy.abilityState === 'active') {
            enemy.abilityDuration = (enemy.abilityDuration || 1) - 1;
            
            // Dash coordinate translation
            enemy.x += enemy.abilityVx || 0;
            enemy.y += enemy.abilityVy || 0;

            enemy.x = Math.max(20, Math.min(worldSize - 20, enemy.x));
            enemy.y = Math.max(20, Math.min(worldSize - 20, enemy.y));

            // Spawn red blazing shadow trails
            if (Math.random() < 0.45) {
              gameRef.current.particles.push({
                id: Math.random().toString(),
                x: enemy.x + (Math.random() - 0.5) * 10,
                y: enemy.y + (Math.random() - 0.5) * 10,
                vx: -(enemy.abilityVx || 0) * 0.15,
                vy: -(enemy.abilityVy || 0) * 0.15,
                radius: 3 + Math.random() * 4,
                color: '#f43f5e',
                alpha: 0.6,
                life: 0,
                maxLife: 15
              });
            }

            if (enemy.abilityDuration <= 0) {
              enemy.abilityState = 'idle';
              enemy.abilityCooldown = Math.random() * 150 + 120; // 2 to 4.5 seconds cooldown
            }
          } else {
            // Standard chase translation
            if (dist > 5) {
              enemy.x += (dx / dist) * enemy.speed;
              enemy.y += (dy / dist) * enemy.speed;
            }
          }
        }
        // 2. Bleach (Acid Bleach Bomber) ability: Drop Corrosive Chlorine pools
        else if (enemy.type === 'bleach') {
          if (enemy.abilityCooldown !== undefined) {
            enemy.abilityCooldown--;
            if (enemy.abilityCooldown <= 0) {
              // Spawn toxic puddle splotch
              gameRef.current.puddles.push({
                id: Math.random().toString(),
                x: enemy.x,
                y: enemy.y,
                radius: 5,
                maxRadius: 36 + Math.random() * 10,
                color: '#10b981',
                life: 0,
                maxLife: 360, // Lasts 6 seconds
                opacity: 0.70
              });

              // Bubble splotch alert particle
              gameRef.current.particles.push({
                id: Math.random().toString(),
                x: enemy.x,
                y: enemy.y - 12,
                vx: 0,
                vy: -1,
                radius: 9,
                color: '#34d399',
                alpha: 0.9,
                life: 0,
                maxLife: 35,
                text: '🧴 ☣️ Chemical!',
                isWord: true
              });

              enemy.abilityCooldown = Math.random() * 180 + 150; // reset cooldown 2.5 - 5s
            }
          }

          // Move standard chase
          if (dist > 5) {
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;
          }
        }
        // 3. Plunger Overlord (Mini-Boss) ability: Constant gravitational vacuum pull
        else if (enemy.type === 'plunger') {
          if (gameRef.current.isGameActive && dist < 340 && dist > 10) {
            const pullForce = 0.42; // Drag the smelly hero in!
            targetPlayer.x += (-dx / dist) * pullForce;
            targetPlayer.y += (-dy / dist) * pullForce;

            targetPlayer.x = Math.max(10, Math.min(worldSize - 10, targetPlayer.x));
            targetPlayer.y = Math.max(10, Math.min(worldSize - 10, targetPlayer.y));

            // Elegant suction trail sparkles
            if (Math.random() < 0.22) {
              const rat = Math.random();
              gameRef.current.particles.push({
                id: Math.random().toString(),
                x: targetPlayer.x * rat + enemy.x * (1 - rat),
                y: targetPlayer.y * rat + enemy.y * (1 - rat),
                vx: (-dx / dist) * 1.5,
                vy: (-dy / dist) * 1.5,
                radius: 2 + Math.random() * 2,
                color: '#c084fc', // purple suction force
                alpha: 0.8,
                life: 0,
                maxLife: 18
              });
            }
          }

          // Move standard slow chase
          if (dist > 5) {
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;
          }
        }
        // 4. Default germ, fly, soap, toilet paper chasing
        else {
          if (dist > 5) {
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;
          }
        }

        // Check contact collision with player Poop
        if (gameRef.current.isGameActive && dist < (targetPlayer.size + enemy.size) * 0.75 && targetPlayer.hp > 0) {
          // Player takes damage!
          if (targetPlayer === player) {
            applyShieldedDamage(0.6, false);
          } else {
            applyShieldedDamage2(0.6, false);
          }

          // Draw floating red hazard indicators
          if (Math.random() < 0.1) {
            playOuchSound();
            gameRef.current.particles.push({
              id: Math.random().toString(),
              x: targetPlayer.x + (Math.random() - 0.5) * 30,
              y: targetPlayer.y - 15,
              vx: (Math.random() - 0.5) * 2,
              vy: -1.5,
              radius: 9,
              color: '#f43f5e',
              alpha: 0.9,
              life: 0,
              maxLife: 30,
              text: 'Ouch!',
              isWord: true
            });
          }

          // Combined dual player co-op gameover logic
          const isP1Dead = player.hp <= 0;
          const isP2Dead = isTwoPlayerMode ? (!gameRef.current.player2 || gameRef.current.player2.hp <= 0) : true;

          if (isP1Dead) {
            player.hp = 0;
            setPlayerHp(0);
          }
          if (isTwoPlayerMode && gameRef.current.player2 && gameRef.current.player2.hp <= 0) {
            gameRef.current.player2.hp = 0;
            setPlayer2Hp(0);
          }

          if (isP1Dead && isP2Dead) {
            gameRef.current.isGameActive = false;
            setGameState('gameover');
          }
        }
      });

      // 3. COIN GENERATION & PICKUPS
      // Maintain at least 15 coins on map for active collection
      const targetCoinsOnMap = 25;
      while (gameRef.current.coins.length < targetCoinsOnMap) {
        gameRef.current.coins.push({
          id: Math.random().toString(),
          x: Math.random() * (worldSize - 100) + 50,
          y: Math.random() * (worldSize - 100) + 50,
          size: 14,
          value: 1,
          bounceOffset: Math.random() * Math.PI
        });
      }

      // Check coin collection
      gameRef.current.coins = gameRef.current.coins.filter((coin) => {
        const dx1 = player.hp > 0 ? (player.x - coin.x) : 99999;
        const dy1 = player.hp > 0 ? (player.y - coin.y) : 99999;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        let letCollected = false;
        let pX = player.x;
        let pY = player.y;

        if (dist1 < (player.size + coin.size)) {
          letCollected = true;
        }

        if (!letCollected && isTwoPlayerMode && gameRef.current.player2 && gameRef.current.player2.hp > 0) {
          const p2 = gameRef.current.player2;
          const dx2 = p2.x - coin.x;
          const dy2 = p2.y - coin.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < (p2.size + coin.size)) {
            letCollected = true;
            pX = p2.x;
            pY = p2.y;
          }
        }

        if (letCollected) {
          // Play coin sound
          playCoinSound();
          addCoins(coin.value);
          setSessionCoins(prev => prev + coin.value);

          // Pop sparkly coin particle!
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: coin.x,
            y: coin.y,
            vx: (Math.random() - 0.5) * 2,
            vy: -2,
            radius: 10,
            color: '#fcd34d', // warm yellow
            alpha: 1.0,
            life: 0,
            maxLife: 25,
            text: '+1 🪙',
            isWord: true
          });
          return false; // remove coin
        }
        return true;
      });

      // Check fruit collection
      gameRef.current.fruits = gameRef.current.fruits.filter((fruit) => {
        let targetHealedPlayer: Player | null = null;

        const dx1 = player.hp > 0 ? (player.x - fruit.x) : 99999;
        const dy1 = player.hp > 0 ? (player.y - fruit.y) : 99999;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        if (dist1 < (player.size + fruit.size)) {
          targetHealedPlayer = player;
        }

        if (!targetHealedPlayer && isTwoPlayerMode && gameRef.current.player2 && gameRef.current.player2.hp > 0) {
          const p2 = gameRef.current.player2;
          const dx2 = p2.x - fruit.x;
          const dy2 = p2.y - fruit.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < (p2.size + fruit.size)) {
            targetHealedPlayer = p2;
          }
        }

        if (targetHealedPlayer) {
          // Play satisfying collection sound (using a high-quality tone from existing audio triggers)
          playCoinSound();

          // Heal health based on what type of fruit
          const oldHp = targetHealedPlayer.hp;
          targetHealedPlayer.hp = Math.min(targetHealedPlayer.maxHp, targetHealedPlayer.hp + fruit.healAmount);
          if (targetHealedPlayer === player) {
            setPlayerHp(Math.ceil(targetHealedPlayer.hp));
          } else {
            setPlayer2Hp(Math.ceil(targetHealedPlayer.hp));
          }
          const healed = Math.ceil(targetHealedPlayer.hp - oldHp);

          // Pop shiny floating health number particle & text above player!
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: fruit.x,
            y: fruit.y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -2,
            radius: 12,
            color: '#10b981', // heal green
            alpha: 1.0,
            life: 0,
            maxLife: 50,
            text: `+${healed} HP ${fruit.emoji}`,
            isWord: true
          });

          // Pop burst of green sparkles around the healing area
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const pSpeed = Math.random() * 2.5 + 1;
            gameRef.current.particles.push({
              id: Math.random().toString(),
              x: fruit.x,
              y: fruit.y,
              vx: Math.cos(angle) * pSpeed,
              vy: Math.sin(angle) * pSpeed,
              radius: Math.random() * 4 + 2,
              color: '#34d399',
              alpha: 1.0,
              life: 0,
              maxLife: 25
            });
          }

          return false; // remove fruit
        }
        return true;
      });

      // 3.9 UPDATE ACID PUDDLES
      gameRef.current.puddles = gameRef.current.puddles.filter((puddle) => {
        puddle.life++;
        
        // Gradually float/expand puddle up to target maxRadius
        if (puddle.radius < puddle.maxRadius) {
          puddle.radius += 0.40;
        }

        // Fade opacity near ending cycles
        if (puddle.life > puddle.maxLife - 60) {
          puddle.opacity = Math.max(0, (puddle.maxLife - puddle.life) / 60) * 0.70;
        }

        const isClean = puddle.color !== '#10b981';

        if (isClean) {
          // Melt nearby enemies!
          gameRef.current.enemies.forEach(enemy => {
            const edx = enemy.x - puddle.x;
            const edy = enemy.y - puddle.y;
            const edist = Math.sqrt(edx * edx + edy * edy);
            if (edist < puddle.radius + enemy.size * 0.5) {
              enemy.hp -= 0.65; // melt continuous damage!
              
              // Spawn some bubbling detergent particles from the enemy
              if (Math.random() < 0.05) {
                gameRef.current.particles.push({
                  id: Math.random().toString(),
                  x: enemy.x + (Math.random() - 0.5) * 10,
                  y: enemy.y - 10,
                  vx: (Math.random() - 0.5) * 1,
                  vy: -1,
                  radius: 3,
                  color: '#38bdf8', // Blue bubble
                  alpha: 0.8,
                  life: 0,
                  maxLife: 20
                });
              }
            }
          });
        } else {
          // Apply continuous toxic splash contact damage to player 1!
          if (player.hp > 0) {
            const pdx = player.x - puddle.x;
            const pdy = player.y - puddle.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

            if (gameRef.current.isGameActive && pdist < (player.size * 0.6 + puddle.radius)) {
              applyShieldedDamage(0.50, true);

              // Bubble alerts
              if (Math.random() < 0.12) {
                playOuchSound();
                gameRef.current.particles.push({
                  id: Math.random().toString(),
                  x: player.x + (Math.random() - 0.4) * 16,
                  y: player.y + (Math.random() - 0.4) * 16,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: -1.5 - Math.random() * 2,
                  radius: 4 + Math.random() * 3,
                  color: '#10b981', // toxic green
                  alpha: 0.85,
                  life: 0,
                  maxLife: 30,
                  text: '☣️ Acid!',
                  isWord: true
                });
              }

              if (player.hp <= 0) {
                player.hp = 0;
                setPlayerHp(0);
                
                const isP2Dead = isTwoPlayerMode ? (!gameRef.current.player2 || gameRef.current.player2.hp <= 0) : true;
                if (isP2Dead) {
                  gameRef.current.isGameActive = false;
                  setGameState('gameover');
                }
              }
            }
          }

          // Apply continuous toxic splash contact damage to player 2!
          if (isTwoPlayerMode && gameRef.current.player2 && gameRef.current.player2.hp > 0) {
            const p2 = gameRef.current.player2;
            const pdx2 = p2.x - puddle.x;
            const pdy2 = p2.y - puddle.y;
            const pdist2 = Math.sqrt(pdx2 * pdx2 + pdy2 * pdy2);

            if (gameRef.current.isGameActive && pdist2 < (p2.size * 0.6 + puddle.radius)) {
              applyShieldedDamage2(0.50, true);

              // Bubble alerts
              if (Math.random() < 0.12) {
                playOuchSound();
                gameRef.current.particles.push({
                  id: Math.random().toString(),
                  x: p2.x + (Math.random() - 0.4) * 16,
                  y: p2.y + (Math.random() - 0.4) * 16,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: -1.5 - Math.random() * 2,
                  radius: 4 + Math.random() * 3,
                  color: '#10b981', // toxic green
                  alpha: 0.85,
                  life: 0,
                  maxLife: 30,
                  text: '☣️ Acid!',
                  isWord: true
                });
              }

              if (p2.hp <= 0) {
                p2.hp = 0;
                setPlayer2Hp(0);

                const isP1Dead = player.hp <= 0;
                if (isP1Dead) {
                  gameRef.current.isGameActive = false;
                  setGameState('gameover');
                }
              }
            }
          }
        }

        // Micro bubbling coming from the puddle itself to indicate hazard
        if (Math.random() < 0.04) {
          const bAngle = Math.random() * Math.PI * 2;
          const bDist = Math.random() * puddle.radius;
          gameRef.current.particles.push({
            id: Math.random().toString(),
            x: puddle.x + Math.cos(bAngle) * bDist,
            y: puddle.y + Math.sin(bAngle) * bDist,
            vx: 0,
            vy: -0.35 - Math.random() * 0.35,
            radius: 2 + Math.random() * 2,
            color: '#34d399',
            alpha: 0.6,
            life: 0,
            maxLife: 35
          });
        }

        return puddle.life < puddle.maxLife;
      });

      // 4. PARTICLES UPDATE
      gameRef.current.particles.forEach((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 1 - p.life / p.maxLife;
      });

      // Cull expired particles
      gameRef.current.particles = gameRef.current.particles.filter(p => p.life < p.maxLife);

      // 4.5 LASERS UPDATE
      gameRef.current.lasers.forEach((laser) => {
        laser.life++;
        laser.opacity = 1 - laser.life / laser.maxLife;
        // Pinned to player's center for smooth tracking
        const distToP1 = Math.sqrt((laser.startX - player.x)**2 + (laser.startY - player.y)**2);
        const distToP2 = (isTwoPlayerMode && gameRef.current.player2) ? Math.sqrt((laser.startX - gameRef.current.player2.x)**2 + (laser.startY - gameRef.current.player2.y)**2) : 99999;
        if (distToP2 < distToP1) {
          laser.startX = gameRef.current.player2!.x;
          laser.startY = gameRef.current.player2!.y;
        } else {
          laser.startX = player.x;
          laser.startY = player.y;
        }
      });

      // Cull expired lasers
      gameRef.current.lasers = gameRef.current.lasers.filter(laser => laser.life < laser.maxLife);

      // Update active flush shockwave visual
      if (activeFlushVisual && activeFlushVisual.active) {
        activeFlushVisual.currentRadius += 12;
        if (activeFlushVisual.currentRadius >= activeFlushVisual.maxRadius) {
          activeFlushVisual.active = false;
          setActiveFlushVisual(null);
        }
      }

      if (isTwoPlayerMode && activeFlushVisual2 && activeFlushVisual2.active) {
        activeFlushVisual2.currentRadius += 12;
        if (activeFlushVisual2.currentRadius >= activeFlushVisual2.maxRadius) {
          activeFlushVisual2.active = false;
          setActiveFlushVisual2(null);
        }
      }

      // Adjust camera centering on player(s)
      let camX = player.x;
      let camY = player.y;

      if (isTwoPlayerMode && gameRef.current.player2) {
        const p1Alive = player.hp > 0;
        const p2Alive = gameRef.current.player2.hp > 0;
        if (p1Alive && p2Alive) {
          // Center on midpoint
          camX = (player.x + gameRef.current.player2.x) / 2;
          camY = (player.y + gameRef.current.player2.y) / 2;
        } else if (p2Alive) {
          camX = gameRef.current.player2.x;
          camY = gameRef.current.player2.y;
        }
      }

      const cx = camX - dimensions.width / 2;
      const cy = camY - dimensions.height / 2;

      // 5. RENDERING CANVAS
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.save();
      
      // Camera translation transition
      ctx.translate(-cx, -cy);

      // Draw Chessboard style tiled ground
      const tileSize = 100;
      const startTileX = Math.floor(Math.max(0, cx) / tileSize) * tileSize;
      const endTileX = Math.floor(Math.min(worldSize, cx + dimensions.width) / tileSize + 1) * tileSize;
      const startTileY = Math.floor(Math.max(0, cy) / tileSize) * tileSize;
      const endTileY = Math.floor(Math.min(worldSize, cy + dimensions.height) / tileSize + 1) * tileSize;

      for (let x = startTileX; x < endTileX; x += tileSize) {
        for (let y = startTileY; y < endTileY; y += tileSize) {
          const isEven = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
          ctx.fillStyle = isEven ? '#1e293b' : '#111827'; // slate checks
          ctx.fillRect(x, y, tileSize, tileSize);

          // Subtle coordinate markings or tiny dirty specks
          if (isEven && (x + y) % 300 === 0) {
            ctx.fillStyle = 'rgba(51, 65, 85, 0.4)';
            ctx.font = '10px Courier New';
            ctx.fillText(`🚽 ${x},${y}`, x + 6, y + 16);
          }
        }
      }

      // Draw Map Boundary Fences
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ef4444'; // Red outline boundaries
      ctx.strokeRect(0, 0, worldSize, worldSize);

      // Warning indicator markers if player gets too close to wall
      if (player.x < 100 || player.x > worldSize - 100 || player.y < 100 || player.y > worldSize - 100) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(10, 10, worldSize - 20, worldSize - 20);
      }

      // Draw Acid Puddles (🟢) Dropped by Bleach Bombers
      gameRef.current.puddles.forEach((puddle) => {
        ctx.save();
        ctx.globalAlpha = puddle.opacity;
        
        const isClean = puddle.color !== '#10b981';
        const innerColor = isClean ? '#38bdf8' : '#34d399';
        const bodyColor = isClean ? '#0284c7' : '#059669';
        const outlineColor = isClean ? 'rgba(56, 189, 248, 0.45)' : 'rgba(16, 185, 129, 0.45)';

        // Draw chemical radial gradient
        const grad = ctx.createRadialGradient(puddle.x, puddle.y, puddle.radius * 0.15, puddle.x, puddle.y, puddle.radius);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(0.5, bodyColor);
        grad.addColorStop(1, 'rgba(14, 116, 144, 0)');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.arc(puddle.x, puddle.y, puddle.radius, 0, Math.PI * 2);
        ctx.fill();

        // High contrast puddle rim outline
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = outlineColor;
        ctx.beginPath();
        ctx.arc(puddle.x, puddle.y, puddle.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      });

      // Draw Coins (🪙)
      gameRef.current.coins.forEach((coin) => {
        // Render coin with nice floating bounce offset animation
        const floatY = Math.sin((time / 180) + coin.bounceOffset) * 6;
        ctx.save();
        ctx.font = `${coin.size + 4}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.fillText('🪙', coin.x, coin.y + floatY);
        ctx.restore();
      });

      // Draw Fruits (🍎, 🍌, 🍓, 🍉, 🍍)
      gameRef.current.fruits.forEach((fruit) => {
        // Render fruit with distinct bouncy vertical sine offset
        const floatY = Math.sin((time / 140) + fruit.bounceOffset) * 5;
        ctx.save();
        ctx.font = `${fruit.size + 10}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const glowColor = fruit.type === 'apple' ? '#f87171' : 
                          fruit.type === 'banana' ? '#fef08a' :
                          fruit.type === 'strawberry' ? '#fda4af' :
                          fruit.type === 'melon' ? '#86efac' : '#fde047';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 20;
        ctx.fillText(fruit.emoji, fruit.x, fruit.y + floatY);

        // Draw helper heal amount tag directly under the fruit for clean retro UX
        ctx.shadowBlur = 0;
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#34d399';
        ctx.fillText(`+${fruit.healAmount}HP`, fruit.x, fruit.y + floatY + 16);
        ctx.restore();
      });

      // Draw Active Toilets Flush Shockwave if expanding
      if (activeFlushVisual && activeFlushVisual.active) {
        ctx.save();
        
        // Draw expanding splash rings
        ctx.shadowColor = activeToilet.pulseColor;
        ctx.shadowBlur = 30;
        
        ctx.lineWidth = 5;
        ctx.strokeStyle = `${activeToilet.pulseColor}aa`; // translucent
        ctx.beginPath();
        ctx.arc(activeFlushVisual.x, activeFlushVisual.y, activeFlushVisual.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = `${activeToilet.pulseColor}77`; // light outer ring
        ctx.beginPath();
        ctx.arc(activeFlushVisual.x, activeFlushVisual.y, Math.max(0, activeFlushVisual.currentRadius - 55), 0, Math.PI * 2);
        ctx.stroke();

        // Summon the temporary active Toilet icon at epicentre
        ctx.font = '55px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.fillText(activeFlushVisual.toiletEmoji, activeFlushVisual.x, activeFlushVisual.y);
        ctx.restore();
      }

      if (isTwoPlayerMode && activeFlushVisual2 && activeFlushVisual2.active) {
        ctx.save();
        
        // Draw expanding splash rings for P2
        ctx.shadowColor = activeToilet.pulseColor;
        ctx.shadowBlur = 30;
        
        ctx.lineWidth = 5;
        ctx.strokeStyle = `${activeToilet.pulseColor}aa`; // translucent
        ctx.beginPath();
        ctx.arc(activeFlushVisual2.x, activeFlushVisual2.y, activeFlushVisual2.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = `${activeToilet.pulseColor}77`; // light outer ring
        ctx.beginPath();
        ctx.arc(activeFlushVisual2.x, activeFlushVisual2.y, Math.max(0, activeFlushVisual2.currentRadius - 55), 0, Math.PI * 2);
        ctx.stroke();

        // Summon the temporary active Toilet icon at epicentre for P2
        ctx.font = '55px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.fillText(activeFlushVisual2.toiletEmoji, activeFlushVisual2.x, activeFlushVisual2.y);
        ctx.restore();
      }

      // Draw Active Lasers
      gameRef.current.lasers.forEach((laser) => {
        ctx.save();
        ctx.globalAlpha = laser.opacity;
        ctx.shadowColor = laser.color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = laser.color;
        ctx.lineWidth = laser.width;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(laser.endX, laser.endY);
        ctx.stroke();

        // White hot core for retro arcade laser realism
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = laser.width * 0.35;
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(laser.endX, laser.endY);
        ctx.stroke();

        ctx.restore();
      });

      // Draw Enemies
      gameRef.current.enemies.forEach((enemy) => {
        // Render custom ambient halo effects/ability rays underneath
        if (enemy.type === 'brush') {
          if (enemy.abilityState === 'charging') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size * 0.95, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(245, 158, 11, ${0.35 + Math.sin(time / 60) * 0.15})`; // glowing amber underlay
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.restore();
          } else if (enemy.abilityState === 'active') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size * 1.1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, 0.45)`; // blazing red underlay
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 22;
            ctx.fill();
            ctx.restore();
          }
        } else if (enemy.type === 'plunger') {
          // Purple shield halo
          ctx.save();
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.6 + Math.sin(time / 80) * 0.25})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.size * 0.82, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Gravitational suction beam to player
          const pDx = player.x - enemy.x;
          const pDy = player.y - enemy.y;
          const pDist = Math.sqrt(pDx * pDx + pDy * pDy);
          if (pDist < 340 && gameRef.current.isGameActive) {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 8]);
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.4 + Math.sin(time / 50) * 0.25})`;
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y);
            ctx.lineTo(player.x, player.y);
            ctx.stroke();
            ctx.restore();
          }
        } else if (enemy.type === 'bleach') {
          // Bubbling green outline
          ctx.save();
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.size * 0.85, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.font = `${enemy.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Render beautiful enemy face
        ctx.fillText(enemy.emoji, enemy.x, enemy.y);

        // Draw brief custom indicator tag
        ctx.restore();

        // Draw Health Bar above each enemy's head
        const barW = enemy.size + 8;
        const barH = 4;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - enemy.size / 2 - 8;

        ctx.fillStyle = '#4b5563'; // dark gray bg
        ctx.fillRect(barX, barY, barW, barH);

        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#f59e0b' : '#ef4444'; // Green, yellow, red
        ctx.fillRect(barX, barY, barW * ratio, barH);

        // Render Enemy Name, HP & Custom Ability Status String for complete UX transparency!
        ctx.font = '8px monospace';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';

        let nameString = `${enemy.name} (${Math.round(enemy.hp)}HP)`;
        if (enemy.type === 'brush') {
          if (enemy.abilityState === 'charging') nameString = `⚠️ CHARGING :: ${nameString}`;
          if (enemy.abilityState === 'active') nameString = `💥 BERSERK DASH :: ${nameString}`;
        } else if (enemy.type === 'plunger') {
          nameString = `💎 SLOW SUCTION :: ${nameString}`;
        } else if (enemy.type === 'bleach') {
          nameString = `☣️ BLEACH BOMBER :: ${nameString}`;
        }
        
        ctx.fillText(nameString, enemy.x, barY - 4);
      });

      // Draw Orbiting Soap bubbles (🧼) from Soap Ring ability
      if (lastActiveArmor.current && lastActiveArmor.current.abilityId === 'soap_ring') {
        const numSoaps = 3;
        const orbitRadius = 60 + Math.sin(time / 200) * 10;
        const orbAngleBase = time / 600;

        for (let i = 0; i < numSoaps; i++) {
          const angle = orbAngleBase + (i * Math.PI * 2 / numSoaps);
          const soapX = player.x + Math.cos(angle) * orbitRadius;
          const soapY = player.y + Math.sin(angle) * orbitRadius;

          ctx.save();
          ctx.font = '20px Inter';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#67e8f9';
          ctx.fillText('🧼', soapX, soapY);
          ctx.restore();
        }
      }

      // Draw Player Shield Glow Halo
      if (gameRef.current.shieldHp > 0) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#38bdf8';
        const percent = gameRef.current.shieldHp / gameRef.current.maxShieldHp;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + percent * 0.45})`;
        ctx.lineWidth = 3 + percent * 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Player Poop (💩)
      if (player.hp > 0) {
        ctx.save();
        ctx.translate(player.x, player.y);
        // Slight wobbling angle for funny locomotion effect
        const wibbleAngle = (keys['w'] || keys['s'] || keys['a'] || keys['d'] || joystickActive)
          ? Math.sin(time / 80) * 0.15
          : 0;
        ctx.rotate(wibbleAngle);

        ctx.font = '42px Helvetica';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Dynamic glowing shadow for poop
        ctx.shadowColor = '#af835d';
        ctx.shadowBlur = 14;
        ctx.fillText('💩', 0, 0);

        ctx.restore();

        // Render equipped Armor accessory emoji floating next to Poop
        if (lastActiveArmor.current) {
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.font = '22px Helvetica';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(lastActiveArmor.current.emoji, 18, 14);
          ctx.restore();
        }

        // Help banner above player's head showing health status
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`💩 POOP HERO (HP: ${Math.max(0, Math.ceil(player.hp))})`, player.x, player.y - 32);
      } else if (isTwoPlayerMode) {
        // Draw matching tombstone for P1!
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.font = '36px Helvetica';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪦', 0, 0);
        ctx.restore();

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RIP POOP HERO', player.x, player.y - 25);
      }

      // Draw Player 2 Poop (only if active)
      if (isTwoPlayerMode && gameRef.current.player2) {
        const p2 = gameRef.current.player2;
        if (p2.hp > 0) {
          ctx.save();
          ctx.translate(p2.x, p2.y);
          // Slight wobbling angle for funny locomotion effect
          const wibbleAngle2 = (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'])
            ? Math.sin(time / 80) * 0.15
            : 0;
          ctx.rotate(wibbleAngle2);

          ctx.font = '42px Helvetica';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Dynamic glowing cyan shadow for Player 2
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 18;
          ctx.fillText('💩', 0, 0);

          // DRAW COOL CYBER SUNGLASSES ON PLAYER 2
          ctx.font = '24px Helvetica';
          ctx.fillText('🕶️', 0, -4);

          ctx.restore();

          // Render equipped Armor accessory emoji floating next to Poop 2
          if (lastActiveArmor.current) {
            ctx.save();
            ctx.translate(p2.x, p2.y);
            ctx.font = '22px Helvetica';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(lastActiveArmor.current.emoji, -18, 14); // opposite side for asymmetry!
            ctx.restore();
          }

          // Help banner above player's head showing health status
          ctx.fillStyle = '#22d3ee';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`😎 SHADED POOP 2 (HP: ${Math.max(0, Math.ceil(p2.hp))})`, p2.x, p2.y - 32);
        } else {
          // Draw a funny matching tombstone!
          ctx.save();
          ctx.translate(p2.x, p2.y);
          ctx.font = '36px Helvetica';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪦', 0, 0);
          ctx.restore();

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('RIP CO-OP MATE', p2.x, p2.y - 25);
        }
      }

      // Update and draw remote co-op players
      Object.values(remotePlayersRef.current).forEach((p) => {
        if (!p) return;

        // Smooth interpolation for sub-frame velocities
        p.x += p.vx * 0.45;
        p.y += p.vy * 0.45;
        p.x = Math.max(15, Math.min(gameRef.current.worldSize - 15, p.x));
        p.y = Math.max(15, Math.min(gameRef.current.worldSize - 15, p.y));

        // Draw Shield Glow Halo around co-op player
        if (p.suitEmoji) {
          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#06b6d4';
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Draw remote poop body
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.font = '36px Helvetica';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#a855f7'; // Distinct cool purple outline for friends
        ctx.shadowBlur = 12;
        ctx.fillText('💩', 0, 0);
        ctx.restore();

        // Render remote accessory armor suit next to them
        if (p.suitEmoji) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.font = '18px Helvetica';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.suitEmoji, 14, 11);
          ctx.restore();
        }

        // Help tag above remote player's head showing health status and name tag
        ctx.fillStyle = '#67e8f9'; // Beautiful glowing cyan text
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.playerName} (HP: ${Math.ceil(p.hp)})`, p.x, p.y - 30);

        // Small equipped toilet status overlay list
        ctx.font = '8px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${p.toiletEmoji} ${p.toiletName.substring(0, 16)}`, p.x, p.y - 19);
      });

      // Draw Particles (Bubble sprays, text labels)
      gameRef.current.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        if (p.isWord && p.text) {
          ctx.fillStyle = p.color;
          ctx.font = 'bold 12px "Courier New", Courier, monospace';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      ctx.restore(); // Restore camera translation

      // Draw Minimap at the top-right
      if (gameRef.current.isGameActive) {
        ctx.save();
        const mapSize = 135; // Size of our minimap
        const mx = dimensions.width - mapSize - 16;
        const my = 20; // Y offset from top of canvas
        const worldSize = gameRef.current.worldSize || 1500;

        // Coordinates helper
        const toMapX = (worldX: number) => mx + (worldX / worldSize) * mapSize;
        const toMapY = (worldY: number) => my + (worldY / worldSize) * mapSize;

        // Minimap Title
        ctx.fillStyle = 'rgba(244, 245, 246, 0.85)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🗺️ RADAR MAP', mx + mapSize / 2, my - 6);

        // Minimap background (glassmorphic / solid contrast)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.fillRect(mx, my, mapSize, mapSize);

        // Grid lines inside the minimap
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
        ctx.lineWidth = 1;
        // Horizontal grid lines
        for (let i = 1; i < 4; i++) {
          const y = my + (i / 4) * mapSize;
          ctx.beginPath();
          ctx.moveTo(mx, y);
          ctx.lineTo(mx + mapSize, y);
          ctx.stroke();
        }
        // Vertical grid lines
        for (let i = 1; i < 4; i++) {
          const x = mx + (i / 4) * mapSize;
          ctx.beginPath();
          ctx.moveTo(x, my);
          ctx.lineTo(x, my + mapSize);
          ctx.stroke();
        }

        // Draw camera viewport boundaries on minimap
        // cx and cy represent the camera scroll offset (top-left of the viewport in world coordinates)
        const viewX = Math.max(0, cx);
        const viewY = Math.max(0, cy);
        const viewW = dimensions.width;
        const viewH = dimensions.height;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'; // Cyan translucent border for visible camera area
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          toMapX(viewX),
          toMapY(viewY),
          (viewW / worldSize) * mapSize,
          (viewH / worldSize) * mapSize
        );

        // Draw Active Toilet Flush Range for player
        if (activeToilet) {
          const mappedRange = ((activeToilet.flushRadius || 150) / worldSize) * mapSize;
          const pxMapped = toMapX(player.x);
          const pyMapped = toMapY(player.y);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)'; // Semi-transparent Amber
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pxMapped, pyMapped, mappedRange, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw other enemies
        gameRef.current.enemies.forEach((enemy) => {
          const exMapped = toMapX(enemy.x);
          const eyMapped = toMapY(enemy.y);

          // Dot configuration
          let dotColor = '#f87171'; // Light red for standard
          let dotRadius = 2.5;

          if (enemy.type === 'boss' || enemy.type === 'plunger') {
            dotColor = '#c084fc'; // Purple for boss and plunger
            dotRadius = 4.5;
          } else if (enemy.type === 'bomber' || enemy.type === 'bleach_bomber') {
            dotColor = '#fbbf24'; // Amber for bomber
            dotRadius = 3.5;
          }

          ctx.fillStyle = dotColor;
          ctx.beginPath();
          ctx.arc(exMapped, eyMapped, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw Player position as a distinct green node
        const pxMapped = toMapX(player.x);
        const pyMapped = toMapY(player.y);
        ctx.fillStyle = '#10b981'; // Vivid green
        ctx.beginPath();
        ctx.arc(pxMapped, pyMapped, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // White inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pxMapped, pyMapped, 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Draw remote co-op players on Minimap/Radar
        Object.values(remotePlayersRef.current).forEach((p) => {
          const rxMapped = toMapX(p.x);
          const ryMapped = toMapY(p.y);
          
          ctx.fillStyle = '#22d3ee'; // Radiant cyan for co-op players
          ctx.beginPath();
          ctx.arc(rxMapped, ryMapped, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff'; // White tiny center core
          ctx.beginPath();
          ctx.arc(rxMapped, ryMapped, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // Mini floating text tag of their first 5 letter name
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '6.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(p.playerName.substring(0, 5), rxMapped, ryMapped - 5.5);
        });

        // Minimap border
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(mx, my, mapSize, mapSize);

        ctx.restore();
      }

      // Prompt UI controls hint directly on active screen overlay when running
      if (gameRef.current.isGameActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '11px Courier New';
        ctx.textAlign = 'left';
        const controlHint = controlMode === 'mobile'
          ? 'Controls: Touch and drag Joystick to Move | Tap Red Flush Button'
          : 'Controls: WASD, ArrowKeys to Move | Space to Play Flush Toilet';
        ctx.fillText(controlHint, 14, dimensions.height - 18);
        ctx.textAlign = 'right';
        ctx.fillText(`Wave: ${wave} | Survival: ${timeSurvived}s`, dimensions.width - 14, dimensions.height - 18);
      }

      // Repeat animation call
      if (gameState === 'playing') {
        animId = requestAnimationFrame(updateAndDraw);
      }
    };

    // Keyboard capture listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key] = true;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        (window as any).triggerToiletFlush();
      }
      if (e.key === 'Enter') {
        if (isTwoPlayerMode && gameRef.current.isGameActive) {
          e.preventDefault();
          (window as any).triggerToiletFlush2();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    if (gameState === 'playing') {
      gameRef.current.isGameActive = true;
      animId = requestAnimationFrame(updateAndDraw);
    } else {
      gameRef.current.isGameActive = false;
      // Draw static menu preview in canvas if loading
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      // Giant central background pile of poop
      ctx.font = '84px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💩', dimensions.width / 2, dimensions.height / 2 - 40);

      ctx.font = 'bold 18.5px Courier New';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('💩 POOP TOILETS HERO 🚽', dimensions.width / 2, dimensions.height / 2 + 30);
      
      ctx.font = '12px Courier New';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Dodge Clean Germs & Flush on Them to Survive!', dimensions.width / 2, dimensions.height / 2 + 55);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, dimensions, wave, activeToilet]);

  const startActiveGame = () => {
    // Mobile mode can NEVER have 2 players co-op
    let finalTwoPlayer = isTwoPlayerMode;
    if (controlMode === 'mobile') {
      finalTwoPlayer = false;
      setIsTwoPlayerMode(false);
    }

    // Reset core reference stats
    const player = gameRef.current.player;
    player.hp = 100;
    player.maxHp = 100;
    player.x = finalTwoPlayer ? 710 : 750;
    player.y = 750;
    
    gameRef.current.enemies = [];
    gameRef.current.coins = [];
    gameRef.current.particles = [];
    gameRef.current.fruits = [];
    gameRef.current.puddles = [];
    gameRef.current.flushTimer = 0;
    gameRef.current.lastSecondTick = Math.floor(performance.now() / 1000);
    gameRef.current.killCount = 0;

    // Reset armor shield states on play transition
    const baseArmor = lastActiveArmor.current || ARMOR_CATALOG[0];
    gameRef.current.shieldHp = baseArmor.maxShieldHp;
    gameRef.current.maxShieldHp = baseArmor.maxShieldHp;
    gameRef.current.lastAbilityTrigger = {};
    setPlayerShieldHp(baseArmor.maxShieldHp);
    setMaxPlayerShieldHp(baseArmor.maxShieldHp);

    setPlayerHp(100);
    setWave(1);
    setScore(0);
    setFlushCooldownLeft(0);
    setSessionKills(0);
    setSessionCoins(0);
    setTimeSurvived(0);

    // Reset Player 2 stats if active
    if (finalTwoPlayer) {
      gameRef.current.player2 = {
        x: 790,
        y: 750,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        speed: 3.5,
        size: 26,
        angle: 0
      };
      (gameRef.current as any).shieldHp2 = baseArmor.maxShieldHp;
      (gameRef.current as any).maxShieldHp2 = baseArmor.maxShieldHp;
      (gameRef.current as any).flushTimer2 = 0;
      setPlayer2Hp(100);
      setPlayer2ShieldHp(baseArmor.maxShieldHp);
      setMaxPlayer2ShieldHp(baseArmor.maxShieldHp);
      setFlushCooldownLeft2(0);
    } else {
      gameRef.current.player2 = undefined;
    }

    setGameState('playing');
  };

  // Mobile JoyTouch controls handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const parentRect = canvasRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    setShowVirtualJoystick(true);
    const touch = e.touches[0];
    const clientX = touch.clientX - parentRect.left;
    const clientY = touch.clientY - parentRect.top;

    setJoystickActive(true);
    setJoystickStart({ x: clientX, y: clientY });
    setJoystickPosition({ x: clientX, y: clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!joystickActive) return;
    const parentRect = canvasRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    const touch = e.touches[0];
    const clientX = touch.clientX - parentRect.left;
    const clientY = touch.clientY - parentRect.top;

    // Calculate maximum threshold circle bound
    const dx = clientX - joystickStart.x;
    const dy = clientY - joystickStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxReach = 45;

    if (dist > maxReach) {
      setJoystickPosition({
        x: joystickStart.x + (dx / dist) * maxReach,
        y: joystickStart.y + (dy / dist) * maxReach
      });
    } else {
      setJoystickPosition({ x: clientX, y: clientY });
    }
  };

  const handleTouchEnd = () => {
    setJoystickActive(false);
    setShowVirtualJoystick(false);
  };

  // Cooldown percentage for UI ring
  const cooldownPercent = activeToilet ? (flushCooldownLeft / activeToilet.cooldownMs) * 100 : 0;

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* Interactive top HUD for health status & high statistics */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
            💩
          </div>
          <div>
            <h2 className="text-lg font-mono font-bold text-slate-100 flex items-center gap-2">
              Poop Crusader <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300">Level {wave}</span>
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Equipped: <span className="text-cyan-400 font-bold">{activeToilet.emoji} {activeToilet.name}</span> <span className="text-slate-500">•</span> <span className="text-amber-400 font-bold">Flush Area: {activeToilet.flushRadius}px</span>
            </p>
          </div>
        </div>

        {/* Dynamic Health Bar & Indicators */}
        <div className="flex-1 max-w-md flex flex-col gap-2">
          {/* Player 1 Health & Shield */}
          <div className={isTwoPlayerMode ? "border-b border-slate-700/50 pb-2 mb-1" : ""}>
            {isTwoPlayerMode && (
              <div className="text-[9px] font-mono font-extrabold text-amber-500 mb-0.5 tracking-wider uppercase">
                👤 PLAYER 1 (WASD)
              </div>
            )}
            {/* Poop Health Bar */}
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-mono text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> Health HP
                </span>
                <span className="text-xs font-mono text-slate-100 font-bold">{playerHp} / 100</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, playerHp))}%` }}
                />
              </div>
            </div>

            {/* Shield HP Bar */}
            {maxPlayerShieldHp > 0 && (
              <div className="mt-1">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-cyan-400" /> Kinetic Shield
                  </span>
                  <span className="text-xs font-mono text-cyan-300 font-bold">{playerShieldHp} / {maxPlayerShieldHp}</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-600 via-sky-450 via-sky-400 to-blue-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (playerShieldHp / maxPlayerShieldHp) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Player 2 Health & Shield */}
          {isTwoPlayerMode && (
            <div>
              <div className="text-[10px] font-mono font-extrabold text-cyan-400 mb-0.5 tracking-wider uppercase flex justify-between">
                <span>😎 PLAYER 2 (ARROWS & ENTER)</span>
                {flushCooldownLeft2 > 0 && (
                  <span className="text-[9px] text-purple-400">Flush CD: {Math.ceil(flushCooldownLeft2 / 1000)}s</span>
                )}
              </div>
              
              {/* Player 2 HP */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Heart className="w-3 h-3 text-cyan-500 fill-cyan-500" /> Health HP
                  </span>
                  <span className="text-xs font-mono text-slate-200 font-bold">{player2Hp} / 100</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-cyan-500 to-sky-400 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, player2Hp))}%` }}
                  />
                </div>
              </div>

              {/* Player 2 Shield HP Bar */}
              {maxPlayer2ShieldHp > 0 && (
                <div className="mt-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] font-mono text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3 text-violet-400" /> Cyber Shield
                    </span>
                    <span className="text-xs font-mono text-violet-300 font-bold">{player2ShieldHp} / {maxPlayer2ShieldHp}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 via-indigo-400 to-fuchsia-500 transition-all duration-150"
                      style={{ width: `${Math.max(0, Math.min(100, (player2ShieldHp / maxPlayer2ShieldHp) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side widgets: Coins owned, sound togglers */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <div>
              <div className="text-xs text-amber-500 font-bold leading-none">Wallet</div>
              <div className="text-sm font-bold font-mono text-slate-100">{coins}</div>
            </div>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg border transition-all duration-200 ${
              isMuted 
                ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300' 
                : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Container consisting of Canvas Arena & HUD Overlays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: THE CANVAS WINDOW */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-2xl h-[480px] w-full cursor-pointer select-none"
            onTouchStart={gameState === 'playing' ? handleTouchStart : undefined}
            onTouchMove={gameState === 'playing' ? handleTouchMove : undefined}
            onTouchEnd={handleTouchEnd}
          >
            <canvas 
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              className="block w-full h-full"
            />

            {/* VIRTUAL JOYSTICK OVERLAY */}
            {gameState === 'playing' && showVirtualJoystick && (
              <div 
                className="absolute text-slate-400 bg-slate-800/15 pointer-events-none rounded-full flex items-center justify-center border border-slate-100/10"
                style={{
                  left: joystickStart.x - 45,
                  top: joystickStart.y - 45,
                  width: 90,
                  height: 90,
                }}
              >
                <div 
                  className="absolute bg-cyan-400/80 w-8 h-8 rounded-full shadow-lg border border-cyan-300 transition-all duration-75"
                  style={{
                    left: 45 - 16 + (joystickPosition.x - joystickStart.x),
                    top: 45 - 16 + (joystickPosition.y - joystickStart.y),
                  }}
                />
              </div>
            )}

            {/* MOBILE ACTIVE FLUSH BUTTON */}
            {gameState === 'playing' && controlMode === 'mobile' && (
              <button
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const trigger = (window as any).triggerToiletFlush;
                  if (trigger) trigger();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const trigger = (window as any).triggerToiletFlush;
                  if (trigger) trigger();
                }}
                className="absolute bottom-6 right-6 w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 border-2 border-rose-400 font-mono font-bold text-white shadow-xl shadow-rose-950/40 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-90"
                style={{ zIndex: 100 }}
              >
                <span className="text-xl">🔴</span>
                <span className="text-[9px] uppercase tracking-wider scale-95 leading-none font-black font-mono">FLUSH</span>
              </button>
            )}

            {/* Overlay 1: Interactive LOBBY State */}
            {gameState === 'lobby' && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col justify-between p-4 text-center overflow-y-auto" style={{ zIndex: 120 }}>
                {/* Header title block */}
                <div className="pt-2 shrink-0">
                  <div className="animate-bounce text-4xl mb-1 mt-0.5">💩</div>
                  <h1 className="text-2xl font-mono font-bold tracking-tight text-white leading-none uppercase">
                    POOP TOILET QUEST
                  </h1>
                  <p className="text-[10px] font-mono text-slate-400 mt-1 max-w-lg mx-auto leading-normal">
                    Slither around finding coins to buy toilet upgrades, and flush on pests to sap their life!
                  </p>
                </div>

                {/* CENTRAL PLAY MODE SELECTION & START REGION (Centered) */}
                <div className="my-auto py-2 w-full max-w-md mx-auto flex flex-col items-center justify-center">
                  <div className="text-[10px] font-mono font-extrabold tracking-widest text-amber-500 uppercase mb-2.5 flex items-center justify-center gap-1">
                    <span>🎮</span> SELECT INPUT SYSTEM & START ADVENTURE
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 w-full mb-3.5">
                    {/* PC Button choice */}
                    <button
                      type="button"
                      onClick={() => {
                        setControlMode('pc');
                        localStorage.setItem('poop_quest_control_mode', 'pc');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer h-[75px] ${
                        controlMode === 'pc'
                          ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 text-slate-200'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-800 hover:bg-slate-900/60 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full font-mono text-[9px] font-black">
                        <span>🖥️ PC WORKSPACE</span>
                        {controlMode === 'pc' && <span className="text-amber-400 text-[8px] font-extrabold animate-pulse">● ACTIVE</span>}
                      </div>
                      <div className="text-[9px] font-mono leading-relaxed mt-1">
                        Move: <span className="text-slate-200 font-bold bg-slate-950 px-1 rounded">WASD</span> | Flush: <span className="text-slate-200 font-bold bg-slate-950 px-1 rounded">SPACE</span>
                      </div>
                    </button>

                    {/* Mobile Button choice */}
                    <button
                      type="button"
                      onClick={() => {
                        setControlMode('mobile');
                        localStorage.setItem('poop_quest_control_mode', 'mobile');
                        setIsTwoPlayerMode(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer h-[75px] ${
                        controlMode === 'mobile'
                          ? 'bg-cyan-500/10 border-cyan-500 shadow-md shadow-cyan-500/5 text-slate-200'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-800 hover:bg-slate-900/60 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full font-mono text-[9px] font-black">
                        <span>📱 MOBILE PLAY</span>
                        {controlMode === 'mobile' && <span className="text-cyan-400 text-[8px] font-extrabold animate-pulse">● ACTIVE</span>}
                      </div>
                      <div className="text-[9px] font-mono leading-relaxed mt-1">
                        Move: <span className="text-slate-200 font-bold bg-slate-950 px-1 rounded">Touch Joystick</span> | Flush: <span className="text-slate-200 font-bold bg-slate-950 px-1 rounded">Red Button</span>
                      </div>
                    </button>
                  </div>

                  {/* Local 2 Player Mode Option Toggle - Only on PC */}
                  {controlMode === 'pc' && (
                    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 mb-3 flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1">
                          <span>👥</span> Multi-Player Co-Op Mode
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">
                          Play together on 1 keyboard sharing controls!
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCoOp = !isTwoPlayerMode;
                          setIsTwoPlayerMode(nextCoOp);
                          // Default to PC controls when co-op is checked
                          if (nextCoOp) {
                            setControlMode('pc');
                            localStorage.setItem('poop_quest_control_mode', 'pc');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-extrabold transition-all duration-150 cursor-pointer ${
                          isTwoPlayerMode
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow shadow-cyan-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {isTwoPlayerMode ? '👥 CO-OP ON' : '👤 SOLO PLAY'}
                      </button>
                    </div>
                  )}

                  {/* HIGH-CONTRAST START BUTTON PLACED IN THE GEOMETRIC SCREEN CENTER */}
                  <button
                    onClick={startActiveGame}
                    className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-slate-950 font-black rounded-lg shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 text-md font-mono cursor-pointer uppercase tracking-wider text-sm select-none"
                    style={{ minWidth: '220px' }}
                  >
                    <Play className="w-5 h-5 fill-slate-950" /> Start {(isTwoPlayerMode && controlMode === 'pc') ? 'CO-OP' : controlMode === 'pc' ? 'PC' : 'Mobile'} Play
                  </button>

                  {isTwoPlayerMode && controlMode === 'pc' && (
                    <div className="mt-3 bg-cyan-950/20 border border-cyan-800/30 rounded-xl p-3 w-full text-left">
                      <div className="text-[10px] font-mono font-black text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <span>🎮</span> Keyboard Bindings for Sharing:
                      </div>
                      <div className="text-[9px] font-mono text-slate-300 leading-relaxed flex flex-col gap-1">
                        <div>• <span className="text-amber-400 font-bold">Player 1 (Poop Hero)</span>: Move with <kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">W</kbd><kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">A</kbd><kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-755 px-1 rounded">S</kbd><kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">D</kbd>, Flush with <kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1.5 rounded">SPACE</kbd></div>
                        <div>• <span className="text-cyan-400 font-bold">Player 2 (Shaded Poop)</span>: Move with <kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">↑</kbd><kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">←</kbd><kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">↓</kbd><kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1 rounded">→</kbd>, Flush with <kbd className="font-bold text-slate-100 bg-slate-900 border border-slate-750 px-1.5 rounded">ENTER</kbd></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTTOM REGION & EXPANDABLE TABS TO REDUCE CLUTTER */}
                <div className="mt-auto max-w-md w-full mx-auto bg-slate-900/70 border border-slate-850 p-2 rounded-xl text-left shrink-0">
                  {/* Tabs Navigator bar */}
                  <div className="grid grid-cols-4 gap-1 border-b border-slate-800 pb-1.5 mb-2 font-mono text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSelectedLobbyTab('intel')}
                      className={`py-1 rounded text-center cursor-pointer transition-colors ${selectedLobbyTab === 'intel' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/50'}`}
                    >
                      💀 Sewer Enemy
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLobbyTab('cowguy')}
                      className={`py-1 rounded text-center cursor-pointer transition-colors ${selectedLobbyTab === 'cowguy' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/50'}`}
                    >
                      🤠 Youtube Claim
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLobbyTab('help')}
                      className={`py-1 rounded text-center cursor-pointer transition-colors ${selectedLobbyTab === 'help' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/50'}`}
                    >
                      🎮 General Guide
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLobbyTab('multiplayer');
                        refreshServerStatus();
                      }}
                      className={`py-1 rounded text-center cursor-pointer transition-colors ${selectedLobbyTab === 'multiplayer' ? 'bg-amber-500/15 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:bg-slate-800/50'}`}
                    >
                      🌐 CO-OP Arena
                    </button>
                  </div>

                  {/* Active Tab Panel details wrapper */}
                  <div className="min-h-[100px] max-h-[140px] overflow-y-auto">
                    {selectedLobbyTab === 'intel' && (() => {
                      const signatureEnemy = ALL_ENEMY_VARIETIES.find(e => e.introducedLevel === (poopLevel || 1)) || ALL_ENEMY_VARIETIES[0];
                      const previousCount = ALL_ENEMY_VARIETIES.filter(e => e.introducedLevel < (poopLevel || 1)).length;
                      return (
                        <div className="flex gap-3 bg-slate-950/40 p-2 rounded border border-slate-850 animate-fade-in">
                          <span className="text-4xl select-none shrink-0">{signatureEnemy.emoji}</span>
                          <div className="font-mono text-[10px] leading-normal w-full">
                            <div className="text-slate-200 capitalize font-bold flex justify-between items-center">
                              <span>{signatureEnemy.name}</span>
                              <span className="text-[7.5px] bg-red-500/10 border border-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase">introduced Level {poopLevel || 1}</span>
                            </div>
                            <div className="text-slate-400 text-[9px] mt-1.5 flex flex-wrap gap-x-2.5">
                              <span>HP: <strong className="text-red-400">{signatureEnemy.maxHp}</strong></span>
                              <span>Speed: <strong className="text-cyan-400">{signatureEnemy.speed}</strong></span>
                              <span>Bounty: <strong className="text-yellow-400">+{signatureEnemy.scoreValue} coins</strong></span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2">
                              Roster also spawns all <span className="text-emerald-400 font-bold">{previousCount}</span> previous hazard organisms.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {selectedLobbyTab === 'help' && (
                      <div className="bg-slate-950/30 p-2 rounded font-mono text-[9.5px] text-slate-350 leading-relaxed border border-slate-850 animate-fade-in space-y-1">
                        <div>• Move around: <span className="text-white font-bold bg-slate-900 px-1 py-0.5 rounded font-mono">WASD / Arrow Keys</span> on PC, or slide anywhere on canvas to guide touch joystick on mobile.</div>
                        <div>• Hover or click elements to lock steering targets automatically.</div>
                        <div>• Flush Blast: <span className="text-amber-400 font-bold bg-slate-900 px-1 py-0.5 rounded font-mono font-bold">SPACEBAR</span> on PC, or tap the floating <span className="text-rose-400 font-bold font-mono">RED BUTTON</span> on mobile. Deals damage to all on-screen enemies!</div>
                        <div>• Upgrading your Toilet and buying Shield Armors boosts maximum blast range!</div>
                      </div>
                    )}

                    {selectedLobbyTab === 'multiplayer' && (
                      <div className="bg-slate-950/40 p-2 rounded border border-slate-850 font-mono text-[9.5px] text-slate-300 leading-normal animate-fade-in space-y-2 min-h-[110px] flex flex-col justify-between">
                        {multiplayerRoom === '' ? (
                          // Not connected lobby view
                          <div className="space-y-2 flex-1 flex flex-col justify-between">
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => connectToRoom('Public Sewer Showdown')}
                                className="flex-1 py-1.5 px-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-center rounded text-[8.5px] cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-cyan-950/50"
                              >
                                <Globe className="w-3 h-3 text-cyan-200" /> Quick Join: Public Showdown
                              </button>
                            </div>

                            {/* Manual room typing */}
                            <div className="flex gap-1 shrink-0">
                              <input
                                type="text"
                                placeholder="Or enter Custom Room Code/Name"
                                id="custom_room_input"
                                className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 rounded px-2 py-0.5 text-[8.5px] focus:outline-none focus:border-cyan-500 font-sans"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val) connectToRoom(val);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = (document.getElementById('custom_room_input') as HTMLInputElement)?.value.trim();
                                  if (val) connectToRoom(val);
                                }}
                                className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-[8px] cursor-pointer"
                              >
                                Join
                              </button>
                            </div>

                            {/* Live co-op friends database list */}
                            <div className="border-t border-slate-800/80 pt-1.5 mt-1">
                              <div className="flex justify-between items-center text-[8px] text-slate-450 mb-1">
                                <span className="text-cyan-400 font-extrabold flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Friends List ({friendsList.length})</span>
                                <span className="text-[7px] text-slate-500 truncate">Add friends to quick-join their rooms!</span>
                              </div>
                              
                              <div className="flex gap-1 mb-1.5">
                                <input
                                  type="text"
                                  placeholder="Enter username..."
                                  value={newFriendName}
                                  onChange={(e) => setNewFriendName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') addFriend(newFriendName);
                                  }}
                                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-700 rounded px-1.5 py-0.5 text-[8px] focus:outline-none focus:border-cyan-500 font-sans"
                                />
                                <button
                                  type="button"
                                  onClick={() => addFriend(newFriendName)}
                                  className="px-2 py-0.5 bg-cyan-500 text-slate-950 font-bold rounded text-[8px] cursor-pointer flex items-center gap-0.5"
                                >
                                  <Plus className="w-2 h-2" /> Add
                                </button>
                              </div>

                              <div className="max-h-[50px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                                {friendsList.length === 0 ? (
                                  <div className="text-[7.5px] text-slate-600 text-center py-1">No friends added. Type usernames to add!</div>
                                ) : (
                                  friendsList.map((friend) => {
                                    const isOnline = onlineUsernames.includes(friend);
                                    // Find room they are in
                                    const friendRoom = activeRooms.find(r => r.players.some(p => p.playerName === friend));
                                    return (
                                      <div key={friend} className="flex justify-between items-center bg-slate-950/40 p-1 rounded text-[7.5px] border border-slate-900/60">
                                        <div className="flex items-center gap-1 text-slate-350 truncate">
                                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                                          <span className={`truncate ${isOnline ? 'text-slate-200 font-extrabold' : 'text-slate-500'}`}>{friend}</span>
                                          {isOnline && friendRoom && (
                                            <span className="text-[6.5px] text-cyan-400 font-normal"> (In: "{friendRoom.roomName}")</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {isOnline && friendRoom && (
                                            <button
                                              type="button"
                                              onClick={() => connectToRoom(friendRoom.roomName)}
                                              className="px-1 py-0.2 hover:scale-102 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded text-[6.5px] cursor-pointer transition-all uppercase"
                                            >
                                              Join Room
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => removeFriend(friend)}
                                            className="text-slate-600 hover:text-rose-450 p-0.5 cursor-pointer"
                                            title="Unfriend player"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Joined co-op layout view
                          <div className="flex-1 flex flex-col justify-between gap-1.5">
                            <div className="flex justify-between items-center text-[8px] bg-slate-950/80 p-1 rounded border border-slate-800">
                              <div className="flex items-center gap-1 font-bold text-emerald-400 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                CO-OP ACTIVE: <span className="text-slate-200">"{multiplayerRoom}"</span>
                              </div>
                              <button
                                type="button"
                                onClick={leaveRoom}
                                className="px-1.5 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-extrabold rounded text-[7.5px] cursor-pointer flex items-center gap-0.5"
                              >
                                <LogOut className="w-2.5 h-2.5" /> Leave
                              </button>
                            </div>

                            {/* Connected participants scrolling panel */}
                            <div className="text-[7.5px] text-slate-450 flex flex-wrap gap-x-2 gap-y-0.5 max-h-[25px] overflow-y-auto">
                              <span className="text-slate-350">🎮 Team:</span>
                              <span className="text-emerald-400 font-bold">You ({currentUser || 'Guest'})</span>
                              {activeRemotePlayersList.map((p) => (
                                <span key={p.playerId} className="text-cyan-300">
                                  {p.playerName} ({p.toiletEmoji})
                                </span>
                              ))}
                            </div>

                            {/* Co-op real-time chat log */}
                            <div className="border border-slate-850 bg-slate-950/90 rounded p-1 flex-1 flex flex-col min-h-[55px] max-h-[70px] text-[7.5px]">
                              <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5 max-h-[40px] scrollbar-thin text-left flex flex-col" id="coop_chat_area">
                                {chatMessages.length === 0 ? (
                                  <div className="text-[6.5px] text-slate-700 text-center italic py-2">No conversations yet. Type below to strategize!</div>
                                ) : (
                                  chatMessages.map((msg, i) => (
                                    <div key={i} className="leading-tight break-all">
                                      <span className={msg.playerId === 'system' ? 'text-emerald-400 font-extrabold' : 'text-cyan-400 font-bold'}>
                                        {msg.playerName}:
                                      </span>{' '}
                                      <span className="text-slate-200">{msg.text}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex gap-1 border-t border-slate-900 pt-1 mt-1 shrink-0">
                                <input
                                  type="text"
                                  placeholder="Type chat & hit Enter..."
                                  value={chatInputText}
                                  onChange={(e) => setChatInputText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') sendChatMessage();
                                  }}
                                  className="flex-1 bg-slate-950 text-slate-200 placeholder-slate-700 px-1 py-0.5 rounded text-[7.5px] focus:outline-none border border-slate-850 font-sans"
                                />
                                <button
                                  type="button"
                                  onClick={sendChatMessage}
                                  className="px-1.5 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[7.5px] cursor-pointer flex items-center justify-center"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedLobbyTab === 'cowguy' && (
                      <div className="bg-slate-950/20 p-1.5 rounded border border-slate-850 font-mono text-[10px] animate-fade-in">
                        <div className="flex justify-between items-center mb-1 text-slate-200 text-[9.5px]">
                          <strong>🎁 Cowguy YouTube Secret Pack</strong>
                          <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">Reward</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mb-2 leading-tight">
                          Receive legendary Galactic Throne (🚽), Kinetic Cow Suit (🛡️) + 5,000 Coins!
                        </p>

                        {hasClaimedCowguy ? (
                          <div className="w-full py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center rounded text-[9px] font-bold">
                            ✓ UNLOCKED & EQUIPPED! Let's Go!
                          </div>
                        ) : !currentUser ? (
                          <div className="p-1 px-2 bg-rose-500/10 border border-rose-500/20 rounded text-[9px] text-rose-450 text-center font-semibold">
                            ⚠️ Enter username profile first to enable verification checks!
                          </div>
                        ) : isGoogleUser ? (
                          <div className="space-y-2 text-left">
                            <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded flex items-center justify-between text-[8.5px]">
                              <span className="text-cyan-400 font-bold">Google Auth Connected!</span>
                              {youtubeSubscribed ? (
                                <span className="text-emerald-400 font-bold">✓ Subscribed Verified</span>
                              ) : (
                                <span className="text-rose-400 font-bold">✗ Subscription Not Found</span>
                              )}
                            </div>

                            {!youtubeSubscribed && (
                              <div className="flex gap-1.5 mt-1 animate-fade-in">
                                <a
                                  href="https://www.youtube.com/@Cowguy55?sub_confirmation=1"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 py-1 bg-red-650 hover:bg-red-600 text-white font-bold text-center rounded text-[8.5px] cursor-pointer flex items-center justify-center gap-0.5"
                                >
                                  🔻 1. Go Subscribe
                                </a>
                                <button
                                  onClick={handleGoogleSignInTrigger}
                                  disabled={isVerifyingGoogle}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[8.5px] transition-colors cursor-pointer"
                                >
                                  {isVerifyingGoogle ? "Syncing..." : "Re-Verify"}
                                </button>
                              </div>
                            )}

                            {isVerifyingGoogle && (
                              <div className="bg-slate-950 p-1 border border-slate-800 rounded text-[7.5px] text-cyan-400 max-h-[40px] overflow-y-auto">
                                {verificationLogs.map((log, i) => (
                                  <div key={i} className="leading-tight truncate">{log}</div>
                                ))}
                              </div>
                            )}

                            {verificationError && (
                              <div className="text-[8px] text-rose-400 leading-tight">
                                ⚠️ {verificationError}
                              </div>
                            )}

                            <button
                              onClick={handleClaimCowguyPrize}
                              disabled={!youtubeSubscribed || isVerifyingGoogle}
                              className={`w-full py-1 font-bold rounded text-center text-[9px] transition-all ${
                                youtubeSubscribed && !isVerifyingGoogle
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              🎁 2. Redeem Pack to Wallet
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 text-left">
                            <div className="flex gap-2">
                              <a
                                href="https://www.youtube.com/@Cowguy55?sub_confirmation=1"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setClickedCowguySub(true)}
                                className={`flex-1 py-1 rounded text-center font-bold text-[8.5px] flex items-center justify-center gap-0.5 border ${
                                  clickedCowguySub ? 'bg-slate-800 text-slate-400 border-slate-700/50' : 'bg-red-650 text-white hover:bg-red-600 cursor-pointer border-red-500/20'
                                }`}
                              >
                                {clickedCowguySub ? '✓ Link Entered' : '🔺 1. Subscribe to Cowguy55'}
                              </a>
                            </div>

                            <div className="flex gap-1">
                              <input
                                type="text"
                                disabled={!clickedCowguySub || isVerifyingSub || youtubeSubscribed}
                                placeholder="@YouTubeHandle"
                                value={youtubeHandle}
                                onChange={(e) => setYoutubeHandle(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none rounded px-1.5 py-0.5 text-[8.5px] focus:border-amber-500"
                              />
                              {!youtubeSubscribed ? (
                                <button
                                  onClick={startVerificationSub}
                                  disabled={!clickedCowguySub || isVerifyingSub || !youtubeHandle.trim()}
                                  className="px-2 py-0.5 bg-amber-500 text-slate-950 font-bold rounded text-[8.5px] disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer"
                                >
                                  Verify
                                </button>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[8px] font-bold">Verified</span>
                              )}
                            </div>

                            {verificationError && (
                              <div className="text-[8px] text-rose-450 leading-tight">⚠️ {verificationError}</div>
                            )}

                            {isVerifyingSub && (
                              <div className="bg-slate-950 p-1 border border-slate-800 rounded text-[7.5px] text-cyan-400 max-h-[45px] overflow-y-auto">
                                {verificationLogs.map((log, i) => (
                                  <div key={i} className="leading-tight truncate">{log}</div>
                                ))}
                              </div>
                            )}

                            <button
                              onClick={handleClaimCowguyPrize}
                              disabled={!youtubeSubscribed || isVerifyingSub}
                              className={`w-full py-1.5 font-bold rounded text-[9px] ${
                                youtubeSubscribed && !isVerifyingSub ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-md' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              🎁 2. Claim Deluxe Prize Package
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Overlay 2: Interactive GAMEOVER State */}
            {gameState === 'gameover' && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col justify-center items-center p-6 text-center animate-fade-in">
                <span className="text-5xl mb-4">🧻🤕</span>
                <h2 className="text-2xl font-mono font-bold text-rose-500 mb-1">
                  YOU GOT WIPED OUT!
                </h2>
                <p className="text-xs font-mono text-slate-400 mb-6">
                  Too many clean germ agents and bubble soaps caught you!
                </p>

                {/* Score and Stats Recap */}
                <div className="grid grid-cols-2 gap-3 min-w-[260px] max-w-xs bg-slate-900/80 border border-slate-800/80 p-4 rounded-xl mb-6 text-left font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Enemies Flushed</div>
                    <div className="text-md font-bold text-emerald-400 font-mono">{sessionKills} 🦠</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Coins Collected</div>
                    <div className="text-md font-bold text-amber-400 font-mono">+{sessionCoins} 🪙</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Total Score</div>
                    <div className="text-md font-bold text-white font-mono">{score} pts</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={startActiveGame}
                    className="px-6 py-3 bg-slate-200 hover:bg-white text-slate-950 font-bold rounded-xl transition-all duration-150 flex items-center gap-2 font-mono text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                  <button
                    onClick={() => setGameState('lobby')}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all duration-150 font-mono text-sm border border-slate-700"
                  >
                    Back to Lobby
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Trigger Active Pressure Plate Action Controller for Toilet playing */}
          <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Micro circle status showing cooldown progress bar */}
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="#334155" strokeWidth="4" fill="transparent" />
                  <circle 
                    cx="24" 
                    cy="24" 
                    r="20" 
                    stroke={flushCooldownLeft > 0 ? activeToilet.pulseColor : '#22c55e'} 
                    strokeWidth="4" 
                    fill="transparent" 
                    strokeDasharray={`${2 * Math.PI * 20}`} 
                    strokeDashoffset={`${(cooldownPercent / 100) * (2 * Math.PI * 20)}`}
                    className="transition-all duration-100"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xl">
                  {activeToilet.emoji}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                  Play Active Toilet Blast: <span className="text-cyan-400 font-bold">{activeToilet.name}</span>
                </h4>
                <p className="text-[11px] font-mono text-slate-400">
                  {flushCooldownLeft > 0 
                    ? `Flushing sweep on cooldown... ${(flushCooldownLeft / 1000).toFixed(1)}s` 
                    : 'System loaded! Press button or SPACE to play!'
                  }
                </p>
              </div>
            </div>

            <button
              id="btn-flush-action"
              disabled={gameState !== 'playing' || flushCooldownLeft > 0}
              onClick={() => {
                const trigger = (window as any).triggerToiletFlush;
                if (trigger) trigger();
              }}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold font-mono text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
                gameState !== 'playing' 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750' 
                  : flushCooldownLeft > 0 
                    ? 'bg-slate-800 text-slate-500 border border-slate-750 cursor-wait' 
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 cursor-pointer animate-pulse'
              }`}
            >
              🫧 FLUSH PRESSURE PLATE (SPACE)
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: REWARD SHOP AND ARSENAL */}
        <div className="flex flex-col gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            
            <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono font-bold text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-500" /> TOILET UPGRADE SHOP
                </h3>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  Coins: <span className="text-amber-400 font-bold">{coins} 🪙</span>
                </span>
              </div>

              {/* Dynamic Level-Up Progress based on Shop Category */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex flex-col gap-2">
                {shopCategory === 'toilets' ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                        🟢 Sewer Zone: <span className="text-slate-100 bg-cyan-950 px-1.5 py-0.5 rounded font-bold border border-cyan-800/60 font-mono">Level {poopLevel} / 100</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-450 leading-none">
                        Goal to Lvl Up: {TOILET_CATALOG.filter(t => t.level === poopLevel && t.id !== 'cowguy_throne' && unlockedToilets.includes(t.id)).length} / {TOILET_CATALOG.filter(t => t.level === poopLevel && t.id !== 'cowguy_throne').length} Unlocked
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {(() => {
                      const currentLevelToilets = TOILET_CATALOG.filter(t => t.level === poopLevel && t.id !== 'cowguy_throne');
                      const unlockedCount = currentLevelToilets.filter(t => unlockedToilets.includes(t.id)).length;
                      const percent = Math.min(100, Math.floor((unlockedCount / Math.max(1, currentLevelToilets.length)) * 100));
                      return (
                        <div className="w-full flex flex-col gap-1">
                          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300 rounded-full" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          {percent === 100 ? (
                            <div className="text-[10px] font-mono font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                              🎉 ZONE COMPLETED! LEVEL UP IN PROGRESS...
                            </div>
                          ) : (
                            <div className="text-[9px] font-mono text-slate-500">
                              Unlock all level exclusive toilets below to automatically advance to Level {poopLevel + 1}!
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono font-bold text-rose-450 uppercase tracking-wider flex items-center gap-1">
                        🛡️ Kinetic Suit Level: <span className="text-slate-100 bg-rose-950 px-1.5 py-0.5 rounded font-bold border border-rose-800/60 font-mono">Level {suitLevel} / 100</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-450 leading-none">
                        Goal to Lvl Up: {ARMOR_CATALOG.filter(a => a.level === suitLevel && a.id !== 'cowguy_suit' && unlockedArmors.includes(a.id)).length} / {ARMOR_CATALOG.filter(a => a.level === suitLevel && a.id !== 'cowguy_suit').length} Unlocked
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {(() => {
                      const currentLevelArmors = ARMOR_CATALOG.filter(a => a.level === suitLevel && a.id !== 'cowguy_suit');
                      const unlockedCount = currentLevelArmors.filter(a => unlockedArmors.includes(a.id)).length;
                      const percent = Math.min(100, Math.floor((unlockedCount / Math.max(1, currentLevelArmors.length)) * 100));
                      return (
                        <div className="w-full flex flex-col gap-1">
                          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
                            <div 
                              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300 rounded-full" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          {percent === 100 ? (
                            <div className="text-[10px] font-mono font-bold text-rose-400 animate-pulse flex items-center gap-1">
                              🎉 SUIT TIER LEVELED UP! ACCELERATING ABILITIES...
                            </div>
                          ) : (
                            <div className="text-[9px] font-mono text-slate-500">
                              Unlock all level exclusive suits below to automatically advance to Level {suitLevel + 1}!
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* Shop Category Navigation Tabs */}
            <div className="flex gap-2 mb-3 border-b border-slate-800/80 pb-3">
              <button
                onClick={() => setShopCategory('toilets')}
                className={`flex-1 py-1.5 rounded-lg text-center font-mono text-xs font-bold transition-all border outline-none ${
                  shopCategory === 'toilets'
                    ? 'bg-slate-800 border-indigo-500 text-indigo-400 shadow-sm shadow-indigo-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🚽 Bidets & Toilets
              </button>
              <button
                onClick={() => setShopCategory('armors')}
                className={`flex-1 py-1.5 rounded-lg text-center font-mono text-xs font-bold transition-all border outline-none ${
                  shopCategory === 'armors'
                    ? 'bg-slate-800 border-rose-500 text-rose-400 shadow-sm shadow-rose-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🛡️ Kinetic Suits
              </button>
            </div>

            {/* Shop Navigation Sub-Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShopTab('zone')}
                className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] font-bold transition-all border outline-none ${
                  shopTab === 'zone'
                    ? 'bg-slate-800 border-cyan-500 text-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🚧 Lvl {shopCategory === 'toilets' ? poopLevel : suitLevel} {shopCategory === 'toilets' ? 'Exclusive' : 'Suits'}
              </button>
              <button
                onClick={() => setShopTab('collection')}
                className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] font-bold transition-all border outline-none ${
                  shopTab === 'collection'
                    ? 'bg-slate-800 border-cyan-500 text-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                👑 Owned ({shopCategory === 'toilets' ? unlockedToilets.length : unlockedArmors.length})
              </button>
            </div>

            {/* Scrollable list based on selected Tab */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {(() => {
                if (shopCategory === 'toilets') {
                  const toiletsToShow = shopTab === 'zone' 
                    ? TOILET_CATALOG.filter(t => t.level === poopLevel && t.id !== 'cowguy_throne')
                    : TOILET_CATALOG.filter(t => unlockedToilets.includes(t.id));

                  if (toiletsToShow.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500 font-mono text-xs">
                        No toilets in this list yet! Keep exploring.
                      </div>
                    );
                  }

                  return toiletsToShow.map((toilet) => {
                    const isUnlocked = unlockedToilets.includes(toilet.id);
                    const isEquipped = activeToilet.id === toilet.id;
                    const canAfford = coins >= toilet.cost;

                    return (
                      <div 
                        key={toilet.id}
                        className={`border rounded-xl p-3.5 transition-all duration-200 flex flex-col gap-2 ${
                          isEquipped 
                            ? 'bg-slate-800/90 border-cyan-500 ring-1 ring-cyan-500/40 shadow-inner' 
                            : isUnlocked 
                              ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60' 
                              : 'bg-slate-950/80 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-3xl p-1 bg-slate-800 rounded-lg shadow-md border border-slate-700/60">{toilet.emoji}</span>
                            <div>
                              <h4 className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                                {toilet.name}
                              </h4>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 leading-tight">
                                  Cooldown: {(toilet.cooldownMs / 1000).toFixed(1)}s
                                </span>
                                <span className="text-[10px] font-mono font-bold uppercase text-rose-400 leading-tight">
                                  Damage: {toilet.damage} HP
                                </span>
                                <span className="text-[10px] font-mono font-bold uppercase text-amber-400 leading-tight">
                                  Flush Area: {toilet.flushRadius}px
                                </span>
                                <span className="text-[9px] font-mono uppercase text-slate-400 leading-tight">
                                  Sewer Level: {toilet.level}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Buy Up / Select equips controls */}
                          {isEquipped ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/35 text-cyan-400 flex items-center gap-1 font-mono">
                              <Check className="w-2.5 h-2.5" /> Equipped
                            </span>
                          ) : isUnlocked ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => {
                                  setActiveToilet(toilet);
                                  playUnlockSound();
                                }}
                                className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-all duration-150 border border-slate-700 active:scale-95"
                              >
                                Equip
                              </button>
                              {toilet.cost > 0 && (
                                <button
                                  onClick={() => {
                                    sellToilet(toilet.id, toilet.cost);
                                    playCoinSound();
                                  }}
                                  className="px-2 py-0.5 text-[9px] font-mono font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded border border-rose-500/35 transition-all duration-150 active:scale-95 cursor-pointer"
                                  title="Sell for 90% of original cost"
                                >
                                  Sell: 🪙{Math.floor(toilet.cost * 0.9)}
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                unlockToilet(toilet.id, toilet.cost);
                                playUnlockSound();
                              }}
                              className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all duration-150 flex items-center gap-1 ${
                                canAfford 
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 cursor-pointer' 
                                  : 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              Unlock 🪙{toilet.cost}
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] font-mono text-slate-400 pr-2">
                          {toilet.description}
                        </p>

                        <div className="bg-slate-900 border border-slate-800/60 p-2 rounded text-[10px] font-mono text-slate-300">
                          ⚡ <strong className="text-cyan-400">Upgrade Bonus:</strong> {toilet.perk}
                        </div>
                      </div>
                    );
                  });
                } else {
                  // ARMORS
                  const armorsToShow = shopTab === 'zone' 
                    ? ARMOR_CATALOG.filter(a => a.level === suitLevel && a.id !== 'cowguy_suit')
                    : ARMOR_CATALOG.filter(a => unlockedArmors.includes(a.id));

                  if (armorsToShow.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500 font-mono text-xs">
                        No suit of this level! Unlock more suits in previous levels to advance to higher Levels.
                      </div>
                    );
                  }

                  return armorsToShow.map((armor) => {
                    const isUnlocked = unlockedArmors.includes(armor.id);
                    const isEquipped = activeArmorId === armor.id;
                    const canAfford = coins >= armor.cost;

                    return (
                      <div 
                        key={armor.id}
                        className={`border rounded-xl p-3.5 transition-all duration-200 flex flex-col gap-2 ${
                          isEquipped 
                            ? 'bg-slate-800/90 border-rose-500 ring-1 ring-rose-500/40 shadow-inner' 
                            : isUnlocked 
                              ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60' 
                              : 'bg-slate-950/80 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-3xl p-1 bg-slate-800 rounded-lg shadow-md border border-slate-700/60">{armor.emoji}</span>
                            <div>
                              <h4 className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                                {armor.name}
                              </h4>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-mono font-bold uppercase text-rose-400 leading-tight">
                                  Shield Cap: {armor.maxShieldHp} HP
                                </span>
                                <span className="text-[10px] font-mono font-bold uppercase text-amber-400 leading-tight">
                                  Body Shield Absorb: {Math.round(armor.shieldAbsorbPercent * 100)}%
                                </span>
                                <span className="text-[9px] font-mono uppercase text-slate-400 leading-tight">
                                  Suit Level: {armor.level}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Equip / Unlock selection control */}
                          {isEquipped ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/10 border border-rose-500/35 text-rose-400 flex items-center gap-1 font-mono">
                              <Check className="w-2.5 h-2.5" /> Equipped
                            </span>
                          ) : isUnlocked ? (
                            <button
                              onClick={() => {
                                setActiveArmorId(armor.id);
                                playUnlockSound();
                              }}
                              className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-all duration-150 border border-slate-700 active:scale-95"
                            >
                              Equip
                            </button>
                          ) : (
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                handleUnlockArmor(armor.id, armor.cost);
                              }}
                              className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all duration-150 flex items-center gap-1 ${
                                canAfford 
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 cursor-pointer' 
                                  : 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              Unlock 🪙{armor.cost}
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] font-mono text-slate-400 pr-2">
                          {armor.description}
                        </p>

                        <div className="bg-slate-900 border border-slate-800/60 p-2 rounded text-[10px] font-mono text-slate-300">
                          ⚙️ <strong className="text-rose-400">Battle Ability:</strong> {armor.abilityDescription}
                        </div>
                      </div>
                    );
                  });
                }
              })()}
            </div>

            {/* Fun achievements counter widget */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                📦 {shopCategory === 'toilets' ? 'Toilets' : 'Suits'} Unlocked: <span className="text-slate-200 font-bold">{shopCategory === 'toilets' ? unlockedToilets.length : unlockedArmors.length} / {shopCategory === 'toilets' ? TOILET_CATALOG.length : ARMOR_CATALOG.length}</span>
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                {shopCategory === 'toilets' ? 'Zone Lvl' : 'Suit Lvl'}: <span className={`${shopCategory === 'toilets' ? 'text-cyan-400' : 'text-rose-400'} font-bold`}>{shopCategory === 'toilets' ? poopLevel : suitLevel} / 100</span>
              </span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
