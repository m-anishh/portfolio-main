const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "portfolio.db"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    likes INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate older dbs created before category/likes columns existed
const postCols = db.prepare("PRAGMA table_info(posts)").all().map((c) => c.name);
if (!postCols.includes("category")) {
  db.exec("ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
}
if (!postCols.includes("likes")) {
  db.exec("ALTER TABLE posts ADD COLUMN likes INTEGER NOT NULL DEFAULT 0");
}

if (db.prepare("SELECT COUNT(*) AS count FROM posts").get().count === 0) {
  const seedPath = path.join(__dirname, "..", "data", "blog-posts.json");

  if (fs.existsSync(seedPath)) {
    const seedPosts = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    const insertPost = db.prepare(
      `INSERT INTO posts (title, slug, excerpt, content, cover_image, category, published)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const seed = db.transaction((posts) => {
      for (const post of posts) {
        insertPost.run(
          post.title,
          post.slug,
          post.excerpt || "",
          post.content,
          post.cover_image || "",
          post.category || "general",
          post.published ? 1 : 0,
        );
      }
    });

    seed(seedPosts);
  }
}

module.exports = db;
