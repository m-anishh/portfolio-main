require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const uploadRoutes = require("./routes/upload");
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.error("Missing SESSION_SECRET in .env — refusing to start.");
  process.exit(1);
}

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);

// Serve current frontend files without browser caching during local development.
app.use(
  express.static(path.join(__dirname, "..", "frontend"), {
    cacheControl: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  }),
);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
