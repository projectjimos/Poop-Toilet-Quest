import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

// Multiplayer has been intentionally removed. Keep these routes closed so old clients cannot connect.
app.get("/api/multiplayer/status", (_req, res) => {
  res.status(410).json({ disabled: true, soloOnly: true, rooms: [], online: [] });
});

app.all("/multiplayer", (_req, res) => {
  res.status(410).json({ disabled: true, soloOnly: true });
});

// API: Generate OAuth URL based on origin redirected back
app.get("/api/auth/url", (req, res) => {
  const origin = req.query.origin as string || `https://${req.headers.host}`;
  const redirectUri = `${origin}/auth/callback`;
  
  if (!isGoogleOAuthConfigured()) {
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
        ? "✓ Sandbox: Cowguy55 subscription found." 
        : "✗ Sandbox: Cowguy55 subscription not found."
    });
  }

  const redirectUri = `${origin}/auth/callback`;

  try {
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

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    let profile: any = { name: "Google Plumber" };
    if (profileRes.ok) {
      profile = await profileRes.json();
    }

    let subscribed = false;
    let youtubeLog = "Contacting YouTube Data API...";

    const ytRes = await fetch(
      "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (ytRes.ok) {
      const ytData = await ytRes.json();
      const subs = ytData.items || [];
      const match = subs.find((sub: any) => {
        const title = sub.snippet?.title?.toLowerCase() || "";
        const desc = sub.snippet?.description?.toLowerCase() || "";
        const chanId = sub.snippet?.resourceId?.channelId || "";
        return (
          title.includes("cowguy55") || 
          desc.includes("cowguy55") ||
          chanId === "UC-Cowguy55" ||
          chanId === "UC7Fz_V8dFm2g8A4KAg"
        );
      });

      if (match) {
        subscribed = true;
        youtubeLog = `Subscription verified: Found match "${match.snippet.title}".`;
      } else {
        youtubeLog = "Subscription status not found in active YouTube subscriptions list.";
      }
    } else {
      const ytErrText = await ytRes.text();
      console.warn("[YT API WARNING]", ytErrText);
      youtubeLog = "YouTube sub check encountered an API error.";
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
app.get("/auth/mock-callback", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google Authentication Sandbox</title>
        <style>
          body { background:#020617; color:#f1f5f9; font-family:monospace; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; text-align:center; }
          .box { border:2px dashed #f59e0b; background:#0f172a; padding:24px; border-radius:16px; max-width:440px; box-shadow:0 10px 30px rgba(245,158,11,.15); }
          button { border:0; border-radius:8px; padding:10px 14px; margin:8px; font-weight:900; font-family:monospace; cursor:pointer; }
          .yes { background:#22c55e; color:white; }
          .no { background:#1e293b; color:#cbd5e1; border:1px solid #334155; }
          h3 { color:#f59e0b; }
          p { color:#94a3b8; font-size:12px; line-height:1.5; }
        </style>
      </head>
      <body>
        <div class="box">
          <h3>🤠 Google Login Sandbox</h3>
          <p>Choose a sandbox subscription state for testing Cowguy55 reward logic.</p>
          <button class="yes" onclick="send(true)">Subscribed to @Cowguy55</button>
          <button class="no" onclick="send(false)">Not subscribed</button>
        </div>
        <script>
          function send(subscribed) {
            if (window.opener) {
              window.opener.postMessage({ type:'OAUTH_GOOGLE_SUCCESS', code: subscribed ? 'SIM_CODE_SUBSCRIBED' : 'SIM_CODE_UNSUBSCRIBED' }, '*');
              window.close();
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
      <head><title>Google Authentication Success</title></head>
      <body style="background:#020617;color:#f1f5f9;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
        <div>
          <h2>🔒 Google Authentication</h2>
          <p>Completing secure login...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_GOOGLE_SUCCESS', code: '${code || ""}' }, '*');
              window.close();
            } else {
              document.write('<p style="color:#f87171;">Error: Opener handle closed. Please retry from the game.</p>');
            }
          </script>
        </div>
      </body>
    </html>
  `);
});

// Vite middleware for development
let viteServerPromise: Promise<any> | undefined;
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
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function startServer() {
  if (viteServerPromise) {
    await viteServerPromise;
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();