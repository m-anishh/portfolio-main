const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const crypto = require("crypto");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "frontend", "uploads");

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Keep the original in memory only — we never write the raw upload to disk.
// Every cover image gets normalized to the same shape/format so cards and
// featured posts always look consistent, regardless of what was uploaded.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, GIF, or WEBP images are allowed"));
    }
    cb(null, true);
  },
});

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 630; // standard 1.91:1 cover/social-share ratio

router.post("/", requireAuth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    try {
      const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;

      await sharp(req.file.buffer)
        .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "attention" })
        .flatten({ background: "#121212" })
        .jpeg({ quality: 82 })
        .toFile(path.join(UPLOAD_DIR, filename));

      res.json({ url: `/uploads/${filename}` });
    } catch (processErr) {
      console.error("Image processing failed:", processErr.message);
      res.status(400).json({ error: "Could not process that image" });
    }
  });
});

module.exports = router;
