const express = require("express");
const db = require("../../database");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Responses vary by session (admin vs public), so never let the browser cache them
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSlug(base) {
  let slug = base || "post";
  let n = 1;
  const exists = db.prepare("SELECT id FROM posts WHERE slug = ?");

  while (exists.get(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }

  return slug;
}

// Public: list posts (published only, unless admin session requests all)
router.get("/", (req, res) => {
  const isAdmin = !!(req.session && req.session.isAdmin);
  const includeDrafts = isAdmin && req.query.all === "1";

  const rows = includeDrafts
    ? db
        .prepare(
          `SELECT posts.*,
            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
           FROM posts
           ORDER BY created_at DESC`,
        )
        .all()
    : db
        .prepare(
          `SELECT posts.*,
            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
           FROM posts
           WHERE published = 1
           ORDER BY created_at DESC`,
        )
        .all();

  res.json(rows);
});

// Public: single post by slug (published only, unless admin)
router.get("/:slug", (req, res) => {
  const isAdmin = !!(req.session && req.session.isAdmin);
  const post = db
    .prepare("SELECT * FROM posts WHERE slug = ?")
    .get(req.params.slug);

  if (!post || (!post.published && !isAdmin)) {
    return res.status(404).json({ error: "Post not found" });
  }

  res.json(post);
});

// Admin: create post
router.post("/", requireAuth, (req, res) => {
  const { title, excerpt, content, cover_image, category, published } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content required" });
  }

  const slug = uniqueSlug(slugify(title));

  const info = db
    .prepare(
      `INSERT INTO posts (title, slug, excerpt, content, cover_image, category, published)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      slug,
      excerpt || "",
      content,
      cover_image || "",
      category || "general",
      published ? 1 : 0,
    );

  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(post);
});

// Admin: update post
router.put("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: "Post not found" });
  }

  const { title, excerpt, content, cover_image, category, published } = req.body;

  db.prepare(
    `UPDATE posts SET
       title = ?, excerpt = ?, content = ?, cover_image = ?, category = ?, published = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    title ?? existing.title,
    excerpt ?? existing.excerpt,
    content ?? existing.content,
    cover_image ?? existing.cover_image,
    category ?? existing.category,
    published !== undefined ? (published ? 1 : 0) : existing.published,
    req.params.id,
  );

  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  res.json(post);
});

// Admin: delete post
router.delete("/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);

  if (info.changes === 0) {
    return res.status(404).json({ error: "Post not found" });
  }

  res.json({ ok: true });
});

// Public: like a post
router.post("/:slug/like", (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE slug = ? AND published = 1").get(req.params.slug);

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  db.prepare("UPDATE posts SET likes = likes + 1 WHERE id = ?").run(post.id);
  const likes = db.prepare("SELECT likes FROM posts WHERE id = ?").get(post.id).likes;
  res.json({ likes });
});

// Public: list comments for a post
router.get("/:slug/comments", (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(req.params.slug);

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comments = db
    .prepare("SELECT id, name, body, created_at FROM comments WHERE post_id = ? ORDER BY created_at ASC")
    .all(post.id);

  res.json(comments);
});

router.get("/:slug/comments/admin", requireAuth, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(req.params.slug);

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comments = db
    .prepare(
      "SELECT id, name, body, created_at FROM comments WHERE post_id = ? ORDER BY created_at DESC",
    )
    .all(post.id);

  res.json(comments);
});

// Public: add a comment
router.post("/:slug/comments", (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE slug = ? AND published = 1").get(req.params.slug);

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const { name, body } = req.body;

  if (!name || !name.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: "Name and comment are required" });
  }

  if (name.length > 80 || body.length > 2000) {
    return res.status(400).json({ error: "Name or comment too long" });
  }

  const info = db
    .prepare("INSERT INTO comments (post_id, name, body) VALUES (?, ?, ?)")
    .run(post.id, name.trim(), body.trim());

  const comment = db.prepare("SELECT id, name, body, created_at FROM comments WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(comment);
});

module.exports = router;
