import express from "express";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const APP_BASIC_USER = String(process.env.APP_BASIC_USER || "").trim();
const APP_BASIC_PASSWORD = String(process.env.APP_BASIC_PASSWORD || "");

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

const pool = new Pool({ connectionString: DATABASE_URL });

const KEY_REGEX = /^[a-zA-Z0-9:_-]{1,120}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,40}$/;

function isValidKey(key) {
  return KEY_REGEX.test(key || "");
}

function isValidUsername(username) {
  return USERNAME_REGEX.test(username || "");
}

function parseBasicAuth(header) {
  if (!header || typeof header !== "string") return null;
  if (!header.toLowerCase().startsWith("basic ")) return null;
  try {
    const b64 = header.slice(6).trim();
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return {
      username: decoded.slice(0, sep),
      password: decoded.slice(sep + 1)
    };
  } catch {
    return null;
  }
}

function sendUnauthorized(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="AI Dashboard"');
  res.status(401).json({ error: "Unauthorized" });
}

async function authenticateFromRequest(req) {
  const parsed = parseBasicAuth(req.headers.authorization);
  if (!parsed) return null;

  const { rows } = await pool.query(
    "SELECT username, password_hash, is_admin FROM auth_users WHERE username = $1 LIMIT 1",
    [parsed.username]
  );
  if (!rows.length) return null;

  const user = rows[0];
  const ok = await bcrypt.compare(parsed.password, user.password_hash);
  if (!ok) return null;

  return {
    username: user.username,
    isAdmin: !!user.is_admin
  };
}

async function requireAuth(req, res, next) {
  const authUser = await authenticateFromRequest(req);
  if (!authUser) return sendUnauthorized(res);
  req.authUser = authUser;
  next();
}

async function requireAdmin(req, res, next) {
  const authUser = await authenticateFromRequest(req);
  if (!authUser) return sendUnauthorized(res);
  if (!authUser.isAdmin) return res.status(403).json({ error: "Admin required" });
  req.authUser = authUser;
  next();
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS state_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureBootstrapAdmin() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM auth_users");
  const userCount = rows[0]?.count || 0;
  if (userCount > 0) return;

  if (!APP_BASIC_USER || !APP_BASIC_PASSWORD) {
    throw new Error(
      "No auth users found. Set APP_BASIC_USER and APP_BASIC_PASSWORD to bootstrap the first admin."
    );
  }
  if (!isValidUsername(APP_BASIC_USER)) {
    throw new Error("APP_BASIC_USER is invalid. Use 3-40 chars: a-z A-Z 0-9 . _ -");
  }
  if (APP_BASIC_PASSWORD.length < 8) {
    throw new Error("APP_BASIC_PASSWORD must be at least 8 characters.");
  }

  const hash = await bcrypt.hash(APP_BASIC_PASSWORD, 12);
  await pool.query(
    `INSERT INTO auth_users(username, password_hash, is_admin, updated_at)
     VALUES ($1, $2, TRUE, NOW())`,
    [APP_BASIC_USER, hash]
  );
  console.log(`Bootstrap admin created: ${APP_BASIC_USER}`);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "db_unreachable" });
  }
});

app.get("/api/auth/validate", async (req, res) => {
  const authUser = await authenticateFromRequest(req);
  if (!authUser) return res.status(401).end();
  res.status(204).end();
});

app.get("/api/auth/users", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT username, is_admin, created_at, updated_at FROM auth_users ORDER BY username ASC"
  );
  res.json({
    users: rows.map((u) => ({
      username: u.username,
      isAdmin: !!u.is_admin,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }))
  });
});

app.post("/api/auth/users", requireAdmin, async (req, res) => {
  const { username, password, isAdmin } = req.body || {};

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Username inválido (3-40; letras, números, . _ -)" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    await pool.query(
      `INSERT INTO auth_users(username, password_hash, is_admin, updated_at)
       VALUES ($1, $2, $3, NOW())`,
      [username, hash, !!isAdmin]
    );
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "El usuario ya existe" });
    }
    throw error;
  }

  res.json({ ok: true });
});

app.put("/api/auth/users/:username/password", requireAdmin, async (req, res) => {
  const username = String(req.params.username || "");
  const { password } = req.body || {};

  if (!isValidUsername(username)) return res.status(400).json({ error: "Username inválido" });
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `UPDATE auth_users
     SET password_hash = $2, updated_at = NOW()
     WHERE username = $1`,
    [username, hash]
  );

  if (!result.rowCount) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ ok: true });
});

app.get("/api/state/export", async (_req, res) => {
  const { rows } = await pool.query("SELECT key, value FROM state_entries");
  const data = {};
  for (const row of rows) data[row.key] = row.value;
  res.json({ data });
});

app.get("/api/state", async (req, res) => {
  const keysRaw = String(req.query.keys || "").trim();
  if (!keysRaw) return res.json({ data: {} });

  const keys = keysRaw.split(",").map((x) => x.trim()).filter(Boolean);
  if (!keys.length) return res.json({ data: {} });

  for (const key of keys) {
    if (!isValidKey(key)) {
      return res.status(400).json({ error: `Invalid key: ${key}` });
    }
  }

  const { rows } = await pool.query(
    "SELECT key, value FROM state_entries WHERE key = ANY($1::text[])",
    [keys]
  );

  const data = {};
  for (const row of rows) data[row.key] = row.value;
  res.json({ data });
});

app.get("/api/state/:key", async (req, res) => {
  const { key } = req.params;
  if (!isValidKey(key)) return res.status(400).json({ error: "Invalid key" });

  const { rows } = await pool.query(
    "SELECT value FROM state_entries WHERE key = $1 LIMIT 1",
    [key]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json({ key, value: rows[0].value });
});

app.put("/api/state/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  if (!isValidKey(key)) return res.status(400).json({ error: "Invalid key" });
  if (typeof value !== "string") {
    return res.status(400).json({ error: "value must be a string" });
  }

  await pool.query(
    `INSERT INTO state_entries(key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
  res.json({ ok: true });
});

app.post("/api/state/bulk", async (req, res) => {
  const { data } = req.body || {};
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "data must be an object" });
  }

  const entries = Object.entries(data);
  for (const [key, value] of entries) {
    if (!isValidKey(key)) return res.status(400).json({ error: `Invalid key: ${key}` });
    if (typeof value !== "string") {
      return res.status(400).json({ error: `Value for ${key} must be string` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of entries) {
      await client.query(
        `INSERT INTO state_entries(key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, count: entries.length });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/state/:key", async (req, res) => {
  const { key } = req.params;
  if (!isValidKey(key)) return res.status(400).json({ error: "Invalid key" });

  await pool.query("DELETE FROM state_entries WHERE key = $1", [key]);
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "internal_server_error" });
});

await initDb();
await ensureBootstrapAdmin();

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
