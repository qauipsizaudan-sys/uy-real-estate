const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "uy.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('sale','rent')),
  price INTEGER NOT NULL CHECK(price > 0),
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  rooms INTEGER NOT NULL,
  area REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, listing_id)
);
`);

const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (!count) {
  const user = db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run("ÜY демо иесі","demo@uy.kz","not-a-login-hash");
  const add = db.prepare("INSERT INTO listings(owner_id,title,type,price,city,address,rooms,area,description,image) VALUES(?,?,?,?,?,?,?,?,?,?)");
  const samples = [
    ["Жарық әрі кең заманауи пәтер","sale",28500000,"Ақтау","15-шағын аудан",3,86,"Кең бөлмелер, жарық интерьер және күнделікті өмірге ыңғайлы жоспарлау.","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85"],
    ["Теңізге жақын жайлы пәтер","rent",220000,"Ақтау","4-шағын аудан",2,64,"Жиһаздалған пәтер. Жақын маңда дүкендер мен қоғамдық көлік аялдамалары бар.","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85"],
    ["Отбасылық кең пәтер","sale",34700000,"Ақтау","12-шағын аудан",4,104,"Отбасымен тұруға арналған кең жоспар, табиғи жарық және сақтауға ыңғайлы орындар.","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85"],
    ["Минималистік студия","rent",145000,"Ақтау","Маңғыстау шағын ауданы",1,42,"Ықшам, ұқыпты студия. Жеке тұруға немесе студентке қолайлы нұсқа.","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85"],
    ["Жаңа үйдегі пәтер","sale",24100000,"Ақтау","17-шағын аудан",2,71,"Жаңа тұрғын үй кешеніндегі пәтер. Инфрақұрылымды өзіңіз барып тексеріңіз.","https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=85"],
    ["Жылы интерьерлі пәтер","rent",185000,"Ақтау","7-шағын аудан",2,58,"Жайлы интерьер, ыңғайлы асүй және күнделікті қажетті орындарға қолжетімділік.","https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85"]
  ];
  for (const s of samples) add.run(user.lastInsertRowid,...s);
}
module.exports = db;