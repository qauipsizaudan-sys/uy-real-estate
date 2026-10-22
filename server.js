require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const db = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;
const production = process.env.NODE_ENV === "production";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "uy.sid",
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: production, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, "public")));

const safeUser = user => user ? ({ id: user.id, name: user.name, email: user.email }) : null;
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Бұл әрекет үшін аккаунтқа кіру қажет." });
  next();
};

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/listings", (req, res) => {
  const { type, city, query, minPrice, maxPrice, rooms } = req.query;
  let sql = `SELECT l.*, u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.status='active'`;
  const args = [];
  if (type && ["sale", "rent"].includes(type)) { sql += " AND l.type=?"; args.push(type); }
  if (city) { sql += " AND l.city LIKE ?"; args.push(`%${String(city).slice(0,80)}%`); }
  if (query) { sql += " AND (l.title LIKE ? OR l.address LIKE ? OR l.description LIKE ?)"; const q = `%${String(query).slice(0,100)}%`; args.push(q,q,q); }
  if (minPrice && Number.isFinite(Number(minPrice))) { sql += " AND l.price>=?"; args.push(Number(minPrice)); }
  if (maxPrice && Number.isFinite(Number(maxPrice))) { sql += " AND l.price<=?"; args.push(Number(maxPrice)); }
  if (rooms && Number.isFinite(Number(rooms))) { sql += " AND l.rooms=?"; args.push(Number(rooms)); }
  sql += " ORDER BY l.created_at DESC LIMIT 60";
  res.json(db.prepare(sql).all(...args));
});

app.get("/api/listings/:id", (req, res) => {
  const listing = db.prepare(`SELECT l.*, u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=? AND l.status='active'`).get(Number(req.params.id));
  if (!listing) return res.status(404).json({ error: "Хабарландыру табылмады." });
  res.json(listing);
});

app.get("/api/me", (req, res) => {
  const user = req.session.userId ? db.prepare("SELECT id,name,email FROM users WHERE id=?").get(req.session.userId) : null;
  res.json({ user: safeUser(user) });
});

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0,80);
  const email = String(req.body.email || "").trim().toLowerCase().slice(0,160);
  const password = String(req.body.password || "");
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
    return res.status(400).json({ error: "Атыңызды, дұрыс email және кемінде 8 таңбалы құпиясөз енгізіңіз." });
  if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
    return res.status(409).json({ error: "Бұл email тіркелген. Жүйеге кіріп көріңіз." });
  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name,email,hash);
  req.session.userId = result.lastInsertRowid;
  res.status(201).json({ user: { id: result.lastInsertRowid, name, email } });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Email немесе құпиясөз қате." });
  req.session.userId = user.id;
  res.json({ user: safeUser(user) });
});

app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/favorites", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT l.* FROM favorites f JOIN listings l ON l.id=f.listing_id WHERE f.user_id=? ORDER BY f.created_at DESC`).all(req.session.userId);
  res.json(rows);
});
app.post("/api/favorites/:listingId", requireAuth, (req, res) => {
  const id = Number(req.params.listingId);
  if (!db.prepare("SELECT id FROM listings WHERE id=? AND status='active'").get(id)) return res.status(404).json({error:"Хабарландыру табылмады."});
  db.prepare("INSERT OR IGNORE INTO favorites(user_id,listing_id) VALUES(?,?)").run(req.session.userId,id);
  res.json({ ok: true });
});
app.delete("/api/favorites/:listingId", requireAuth, (req, res) => {
  db.prepare("DELETE FROM favorites WHERE user_id=? AND listing_id=?").run(req.session.userId,Number(req.params.listingId));
  res.json({ ok: true });
});

app.post("/api/listings", requireAuth, (req, res) => {
  const b = req.body;
  const title = String(b.title || "").trim().slice(0,120);
  const city = String(b.city || "").trim().slice(0,80);
  const address = String(b.address || "").trim().slice(0,180);
  const description = String(b.description || "").trim().slice(0,2000);
  const type = ["sale","rent"].includes(b.type) ? b.type : "";
  const price = Number(b.price), rooms = Number(b.rooms), area = Number(b.area);
  const image = String(b.image || "").trim().slice(0,500);
  if (title.length < 5 || !city || !address || !type || !Number.isFinite(price) || price <= 0 || !Number.isFinite(rooms) || rooms < 1 || !Number.isFinite(area) || area <= 0)
    return res.status(400).json({error:"Міндетті өрістерді дұрыс толтырыңыз."});
  const result = db.prepare(`INSERT INTO listings(owner_id,title,type,price,city,address,rooms,area,description,image) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(req.session.userId,title,type,price,city,address,rooms,area,description,image || null);
  res.status(201).json({id: result.lastInsertRowid});
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`ÜY server: http://localhost:${PORT}`));