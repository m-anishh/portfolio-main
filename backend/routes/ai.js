const express = require("express");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

router.post("/blog-draft", requireAuth, async (req, res) => {
  const { topic, category } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "Gemini API key is not configured" });
  }

  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return res.status(400).json({ error: "Enter a blog topic first" });
  }

  const prompt = [
    "Create a professional technical blog draft.",
    `Topic: ${topic.trim()}`,
    `Category: ${(category || "Technology").trim()}`,
    "Return only valid JSON with exactly these string fields:",
    "title, excerpt, content",
    "The content must be clear Markdown with headings, paragraphs, and lists where useful.",
    "Do not include code fences around the JSON.",
  ].join("\n");

  try {
    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini request failed:", data.error?.message || response.status);
      return res.status(502).json({ error: "Gemini could not generate the draft" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "Gemini returned an empty draft" });
    }

    const draft = JSON.parse(text);
    if (!draft.title || !draft.excerpt || !draft.content) {
      return res.status(502).json({ error: "Gemini returned an incomplete draft" });
    }

    res.json({
      title: String(draft.title),
      excerpt: String(draft.excerpt),
      content: String(draft.content),
    });
  } catch (error) {
    console.error("Gemini draft generation failed:", error.message);
    res.status(502).json({ error: "Unable to reach Gemini" });
  }
});

module.exports = router;
