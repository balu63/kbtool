require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

app.post("/chat", async (req, res) => {
  const { messages, model } = req.body;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const response = await axios({
      method: "post",
      url: OPENROUTER_URL,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kbtool.local",
        "X-Title": "KB Tool",
      },
      data: {
        model: model || "openai/gpt-3.5-turbo",
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      },
      responseType: "stream",
    });

    response.data.on("data", (chunk) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {}
        }
      }
    });

    response.data.on("end", () => {
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Stream error:", err);
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error("API call error:", err.response?.data || err.message);
    res.write(
      `data: ${JSON.stringify({ error: "API error. Check key or network." })}\n\n`,
    );
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🤖 KB Tool Backend running on http://localhost:${PORT}`);
});
// Image generation endpoint (OpenRouter)
app.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });
  try {
    const response = await axios({
      method: "post",
      url: "https://openrouter.ai/api/v1/ai/image",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        model: "stabilityai/stable-diffusion-xl",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      },
    });
    res.json({ imageUrl: response.data.image_url });
  } catch (err) {
    console.error("Image gen error:", err.response?.data || err.message);
    res
      .status(500)
      .json({ error: "Image generation failed. Check API key or credits." });
  }
});
