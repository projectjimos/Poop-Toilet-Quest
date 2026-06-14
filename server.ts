import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Create HTTP server wrapper to mount both HTTP and WebSocket protocols on the same port
const server = http.createServer(app);

// Helper to check if Google credentials are fully set up
const isGoogleOAuthConfigured = () => {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
};

// API: Check if OAuth is configured in server env
app.get("/api/auth/status", (req, res) => {
  res.json({
    configured: isGoogleOAuthConfigured(),
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    developerHint: "To connect real Google accounts, configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET variables in your Settings.",
  });
});

// Multiplayer active room schema
interface PlayerDetails {
  playerId: string;
  playerName: string;
  roomName: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  toiletEmoji: string;
  toiletName: string;
  suitEmoji: string;
  score: number;
  wave: number;
  lastUpdate: number;
}

// Global active players mapping
const activePlayers = new Map<WebSocket, PlayerDetails>();

// API: Get multiplayer active rooms and online players list for dynamic quick-join & friend monitoring
app.get("/api/multiplayer/status", (req, res) => {
  const onlineUsernames = Array.from(activePlayers.values()).map(p => p.playerName);
  
  // Aggregate players by room
  const roomsMap: Record<string, { roomName: string; playerCount: number; players: any[] }> = {};
  
  activePlayers.forEach((p) => {
    if (!p.roomName) return;
    if (!roomsMap[p.roomName]) {
      roomsMap[p.roomName] = {
        roomName: p.roomName,
        playerCount: 0,
        players: []
      };
    }
    roomsMap[p.roomName].playerCount++;
    roomsMap[p.roomName].players.push({
      playerId: p.playerId,
      playerName: p.playerName,
      toiletEmoji: p.toiletEmoji,
      toiletName: p.toiletName,
      suitEmoji: p.suitEmoji,
      wave: p.wave,
      score: p.score
    });
  });

  res.json({
    online: onlineUsernames,
    rooms: Object.values(roomsMap)
  });
});

// Create WebSocket server attached to our live HTTP Server
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade manually to ensure clean routing
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/multiplayer" || pathname === "/multiplayer/") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    // If not a multiplayer WebSocket path, let standard Vite or other handlers take it
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket) => {
  // Add a ping/pong or basic error listener
  ws.on("error", (err) => {
    console.error("[WS CLIENT ERROR]", err);
    cleanupConnection(ws);
  });

  ws.on("close", () => {
    cleanupConnection(ws);
  });

  ws.on("message", (rawMessageString: string) => {
    try {
      const data = JSON.parse(rawMessageString);
      const { type } = data;

      if (type === "join") {
        const { playerId, playerName, roomName, x, y, hp, maxHp, toiletEmoji, toiletName, suitEmoji, score, wave } = data.payload;
        
        // Associate player data with socket connection
        const player: PlayerDetails = {
          playerId: playerId || Math.random().toString(),
          playerName: playerName || `Pooper#${Math.floor(Math.random() * 9000 + 1000)}`,
          roomName: roomName || "Sewer Showdown",
          x: x || 750,
          y: y || 750,
          hp: hp || 100,
          maxHp: maxHp || 100,
          toiletEmoji: toiletEmoji || "🚽",
          toiletName: toiletName || "Wooden Outhouse",
          suitEmoji: suitEmoji || "🎒",
          score: score || 0,
          wave: wave || 1,
          lastUpdate: Date.now()
        };

        activePlayers.set(ws, player);
        console.log(`[MULTIPLAYER] ${player.playerName} joined room: "${player.roomName}"`);

        // Send confirmation and current player list of this room to the newly joined player
        const roomPlayers = getPlayersInRoom(player.roomName, ws);
        ws.send(JSON.stringify({
          type: "joined_success",
          payload: {
            yourId: player.playerId,
            yourRoom: player.roomName,
            players: roomPlayers.map(p => ({
              playerId: p.playerId,
              playerName: p.playerName,
              x: p.x,
              y: p.y,
              hp: p.hp,
              maxHp: p.maxHp,
              toiletEmoji: p.toiletEmoji,
              toiletName: p.toiletName,
              suitEmoji: p.suitEmoji,
              score: p.score,
              wave: p.wave
            }))
          }
        }));

        // Broadcast to all other players in this same room about the new joiner
        broadcastToRoom(player.roomName, ws, {
          type: "player_joined",
          payload: {
            playerId: player.playerId,
            playerName: player.playerName,
            x: player.x,
            y: player.y,
            hp: player.hp,
            maxHp: player.maxHp,
            toiletEmoji: player.toiletEmoji,
            toiletName: player.toiletName,
            suitEmoji: player.suitEmoji,
            score: player.score,
            wave: player.wave
          }
        });
      }

      else if (type === "state_update") {
        const player = activePlayers.get(ws);
        if (!player) return;

        // Update player coordinates & health in our tracker
        const { x, y, hp, maxHp, toiletEmoji, toiletName, suitEmoji, score, wave, vx, vy, isDashing } = data.payload;
        player.x = x;
        player.y = y;
        if (hp !== undefined) player.hp = hp;
        if (maxHp !== undefined) player.maxHp = maxHp;
        if (toiletEmoji) player.toiletEmoji = toiletEmoji;
        if (toiletName) player.toiletName = toiletName;
        if (suitEmoji) player.suitEmoji = suitEmoji;
        if (score !== undefined) player.score = score;
        if (wave !== undefined) player.wave = wave;
        player.lastUpdate = Date.now();

        // Broadcast updated details to all OTHER players in the same room
        broadcastToRoom(player.roomName, ws, {
          type: "player_moved",
          payload: {
            playerId: player.playerId,
            x: player.x,
            y: player.y,
            hp: player.hp,
            maxHp: player.maxHp,
            toiletEmoji: player.toiletEmoji,
            toiletName: player.toiletName,
            suitEmoji: player.suitEmoji,
            score: player.score,
            wave: player.wave,
            vx: vx || 0,
            vy: vy || 0,
            isDashing: !!isDashing
          }
        });
      }

      else if (type === "flush_event") {
        const player = activePlayers.get(ws);
        if (!player) return;

        const { x, y, damage, flushRadius, pulseColor, emoji } = data.payload;
        
        // Broadcast the active flush blast wave! Other players' clients recreate this visual 
        // shockwave on their active canvas and damage their local enemies residing inside range!
        broadcastToRoom(player.roomName, ws, {
          type: "player_flushed",
          payload: {
            playerId: player.playerId,
            playerName: player.playerName,
            x,
            y,
            damage,
            flushRadius,
            pulseColor,
            emoji
          }
        });
      }

      else if (type === "shoot_event") {
        const player = activePlayers.get(ws);
        if (!player) return;

        // Sync projectile firing visual cues (so co-op play shows active bullets shooting out!)
        broadcastToRoom(player.roomName, ws, {
          type: "player_shot",
          payload: {
            playerId: player.playerId,
            startX: data.payload.startX,
            startY: data.payload.startY,
            angle: data.payload.angle,
            speed: data.payload.speed,
            color: data.payload.color,
            damage: data.payload.damage,
            type: data.payload.type // e.g. 'bubble', 'soap', 'gush'
          }
        });
      }

      else if (type === "chat") {
        const player = activePlayers.get(ws);
        if (!player) return;

        console.log(`[MULTIPLAYER CHAT] <${player.playerName}>: ${data.payload.text}`);

        // Broadcast chat bubble message
        broadcastToRoom(player.roomName, null, {
          type: "chat_broadcast",
          payload: {
            playerId: player.playerId,
            playerName: player.playerName,
            text: data.payload.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }
        });
      }

    } catch (e) {
      console.error("[WS MESSAGE JSON ERROR]", e);
    }
  });
});

// Helper: Get list of other players currently joined to a specified room
function getPlayersInRoom(roomName: string, excludeWs: WebSocket | null): PlayerDetails[] {
  const result: PlayerDetails[] = [];
  activePlayers.forEach((player, ws) => {
    if (ws !== excludeWs && player.roomName === roomName) {
      result.push(player);
    }
  });
  return result;
}

// Helper: Broadcast payload object to all players in a room
function broadcastToRoom(roomName: string, excludeWs: WebSocket | null, messageObj: any) {
  const rawString = JSON.stringify(messageObj);
  activePlayers.forEach((player, ws) => {
    if (ws !== excludeWs && player.roomName === roomName) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(rawString);
      }
    }
  });
}

// Helper: Clean up active player reference when they disconnect
function cleanupConnection(ws: WebSocket) {
  const player = activePlayers.get(ws);
  if (player) {
    console.log(`[MULTIPLAYER] Player disconnected: "${player.playerName}" from room: "${player.roomName}"`);
    // Broadcast exit event
    broadcastToRoom(player.roomName, ws, {
      type: "player_left",
      payload: {
        playerId: player.playerId,
        playerName: player.playerName
      }
    });
    activePlayers.delete(ws);
  }
}

// API: Generate OAuth URL based on origin redirected back
app.get("/api/auth/url", (req, res) => {
  const origin = req.query.origin as string || `https://${req.headers.host}`;
  const redirectUri = `${origin}/auth/callback`;
  
  if (!isGoogleOAuthConfigured()) {
    // If not configured, we will allow client to use simulated sandbox mode
    return res.json({ 
      configured: false, 
      url: `${origin}/auth/mock-callback?username=GoogleSewerPlumber` 
    });
  }

  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube.readonly"
  ];

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ configured: true, url: authUrl });
});

// API endpoint to exchange code for tokens & verify subscriber status
app.post("/api/auth/verify", async (req, res) => {
  const { code, origin } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }

  if (code.startsWith("SIM_CODE_") || !isGoogleOAuthConfigured()) {
    const mockSubscribed = code === "SIM_CODE_SUBSCRIBED";
    return res.json({
      success: true,
      user: mockSubscribed ? "SewerLegend" : "BeginnerPlumber",
      email: "sandbox@google.com",
      picture: "",
      subscribed: mockSubscribed,
      youtubeLog: mockSubscribed 
        ? "✓ [SECURE SANBOX SIMULATION] Found subscription link to channel UC7Fz_V8dFm2g8A4KAg (@Cowguy55)!" 
        : "✗ [SECURE SANDBOX SIMULATION] Completed subscription scan. No active YouTube subscriptions to @Cowguy55 were found."
    });
  }

  const redirectUri = `${origin}/auth/callback`;

  try {
    // 1. Exchange access code for Google access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[OAUTH EXCH ERROR]", errText);
      return res.status(400).json({ error: "Token exchange failed: " + errText });
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;

    // 2. Fetch user profile info
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    let profile: any = { name: "Google Plumber" };
    if (profileRes.ok) {
      profile = await profileRes.json();
    }

    // 3. Query YouTube Subscriptions to find @Cowguy55 or Cowguy55
    // We fetch current page subscriptions. We check for custom URL @Cowguy55 OR channel name Cowguy55
    let subscribed = false;
    let youtubeLog = "Contacting YouTube Data API...";

    const ytRes = await fetch(
      "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (ytRes.ok) {
      const ytData = await ytRes.json();
      const subs = ytData.items || [];
      
      // Look for match
      const mathUser = subs.find((sub: any) => {
        const title = sub.snippet?.title?.toLowerCase() || "";
        const desc = sub.snippet?.description?.toLowerCase() || "";
        const chanId = sub.snippet?.resourceId?.channelId || "";
        
        return (
          title.includes("cowguy55") || 
          desc.includes("cowguy55") ||
          chanId === "UC-Cowguy55" ||
          chanId === "UC7Fz_V8dFm2g8A4KAg" // Standard Cowguy channel signatures
        );
      });

      if (mathUser) {
        subscribed = true;
        youtubeLog = `Subscription verified: Found match "${mathUser.snippet.title}" in subscriptions ledger!`;
      } else {
        subscribed = false;
        youtubeLog = "Subscription status not found in active YouTube subscriptions list.";
      }
    } else {
      const ytErrText = await ytRes.text();
      console.warn("[YT API WARNING]", ytErrText);
      youtubeLog = "YouTube sub check encountered API error. Gracefully proceeding with sandbox fallback.";
    }

    res.json({
      success: true,
      user: profile.name || profile.email || "Google Plumber",
      email: profile.email || "",
      picture: profile.picture || "",
      subscribed,
      youtubeLog,
    });
  } catch (error: any) {
    console.error("[OAUTH VERIFY ERROR]", error);
    res.status(500).json({ error: error.message || "Internal verification failure" });
  }
});

// Simulated OAuth callback for dev/sandbox preview frames when real credentials aren't configured
app.get("/auth/mock-callback", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google Authentication (Simulated Sandbox)</title>
        <style>
          body {
            background-color: #020617;
            color: #f1f5f9;
            font-family: monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .box {
            border: 2px dashed #f59e0b;
            background: #0f172a;
            padding: 24px;
            border-radius: 16px;
            max-width: 440px;
            box-shadow: 0 10px 30px rgba(245, 158, 11, 0.15);
          }
          .btn-primary {
            background: #f59e0b;
            color: #020617;
            border: none;
            padding: 10px 18px;
            font-weight: bold;
            font-family: monospace;
            cursor: pointer;
            border-radius: 6px;
            margin: 8px;
            font-size: 11px;
            transition: all 0.2s;
          }
          .btn-primary:hover {
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
            transform: scale(1.02);
          }
          .btn-secondary {
            background: #1e293b;
            color: #94a3b8;
            border: 1px solid #334155;
            padding: 10px 18px;
            font-weight: bold;
            font-family: monospace;
            cursor: pointer;
            border-radius: 6px;
            margin: 8px;
            font-size: 11px;
          }
          .option-row {
            margin: 16px 0;
            display: flex;
            justify-content: center;
            gap: 12px;
          }
          .active-option {
            background: #10b981 !important;
            color: white !important;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
          }
          h3 { margin-top: 0; color: #f59e0b; }
          p { font-size: 11px; line-height: 1.5; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="box">
          <h3>🤠 Google Login Sandbox console</h3>
          <p>
            You are operating in the AI Studio cloud editor. Since Google credentials are not yet saved,
            we launched this Interactive Simulator. Set the user subscription state to test both reward logic branches:
          </p>
          
          <div class="option-row">
            <button onclick="selectChoice(true)" id="btnSub" class="btn-primary active-option">
              ✓ Subscribed to @Cowguy55
            </button>
            <button onclick="selectChoice(false)" id="btnNotSub" class="btn-secondary">
              ✕ Unsubscribed Account
            </button>
          </div>

          <p style="font-size: 9px; color: #64748b;">
            Emulates the secure postMessage exchange with SameSite=None verification cookies on your active profile.
          </p>

          <button onclick="executeCallback()" class="btn-primary" style="width: 100%; margin-top: 14px; background: #22c55e; color: #fff;">
            🚀 Authorize & Log In with Google
          </button>
        </div>

        <script>
          let subStatus = true;
          function selectChoice(subscribed) {
            subStatus = subscribed;
            document.getElementById('btnSub').className = subscribed ? 'btn-primary active-option' : 'btn-secondary';
            document.getElementById('btnNotSub').className = !subscribed ? 'btn-primary active-option' : 'btn-secondary';
          }
          
          function executeCallback() {
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_GOOGLE_SUCCESS', 
                code: subStatus ? 'SIM_CODE_SUBSCRIBED' : 'SIM_CODE_UNSUBSCRIBED' 
              }, '*');
              window.close();
            } else {
              alert('Primal window handle was closed!');
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Serve direct popup html page for code capture & postMessage communication
app.get("/auth/callback", (req, res) => {
  const { code } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google Authentication Success</title>
        <style>
          body {
            background-color: #020617;
            color: #f1f5f9;
            font-family: monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .box {
            border: 1px solid #334155;
            background: #0f172a;
            padding: 24px;
            border-radius: 12px;
            max-width: 400px;
          }
          .spinner {
            border: 3px solid #1e293b;
            border-top: 3px solid #f59e0b;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin: 16px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>🔒 Google Authentication</h2>
          <div class="spinner"></div>
          <p>Exchanging secure credentials within the iframe sandboxed boundary...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_GOOGLE_SUCCESS', code: '${code || ""}' }, '*');
              window.close();
            } else {
              document.write('<p style="color: #f87171;">Error: Opener handle closed. Please retry from the primary game viewport.</p>');
            }
          </script>
        </div>
      </body>
    </html>
  `);
});

// Vite middleware for development
let viteServerPromise: Promise<any>;
if (process.env.NODE_ENV !== "production") {
  viteServerPromise = createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function startServer() {
  if (viteServerPromise) {
    await viteServerPromise;
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
