const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password required" });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    return res.status(500).json({ error: "Admin password not configured" });
  }

  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  req.session.isAdmin = true;
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/session", (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
