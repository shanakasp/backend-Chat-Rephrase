const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require("dotenv").config(); // Load environment variables

class MessageService {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey: apiKey });
  }

  async rephraseMessage(originalMessage, category) {
    const categoryPrompts = {
      positive:
        "Rephrase the message to be encouraging, optimistic, and uplifting. Focus on highlighting strengths and potential.",
      supportive:
        "Rephrase the message to show empathy, understanding, and emotional support. Use caring and compassionate language.",
      collaborative:
        "Rephrase the message to emphasize teamwork, mutual understanding, and collective problem-solving. Use inclusive language.",
      "problem-solving":
        "Rephrase the message to be constructive, solution-oriented, and focused on addressing challenges systematically and objectively.",
    };

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a professional communication assistant. ${
              categoryPrompts[category] || categoryPrompts["collaborative"]
            } 
            Ensure the rephrased message:
            - Maintains the original intent
            - Uses professional and respectful language
            - Avoids harsh or negative tone
            - Focuses on constructive communication`,
          },
          {
            role: "user",
            content: originalMessage,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error rephrasing message:", error);
      return originalMessage;
    }
  }
}

class MessageApp {
  constructor(openaiApiKey) {
    this.app = express();
    this.messageService = new MessageService(openaiApiKey);

    this.app.use(bodyParser.json());
    this.conversations = {};
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.post("/send-message", async (req, res) => {
      const {
        sender,
        recipient,
        message,
        category = "collaborative",
      } = req.body;

      if (!sender || !recipient || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const phrasedMessage = await this.messageService.rephraseMessage(
          message,
          category
        );

        if (!this.conversations[sender]) {
          this.conversations[sender] = {};
        }
        if (!this.conversations[sender][recipient]) {
          this.conversations[sender][recipient] = [];
        }

        const messageEntry = {
          sender,
          message: phrasedMessage,
          originalMessage: message,
          category,
          timestamp: new Date(),
        };

        this.conversations[sender][recipient].push(messageEntry);

        res.status(200).json({
          message: "Message sent successfully",
          phrasedMessage,
          category,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to send message" });
      }
    });

    this.app.get("/conversation", (req, res) => {
      const { user1, user2 } = req.query;

      if (!user1 || !user2) {
        return res.status(400).json({ error: "Missing users" });
      }

      const conversation =
        this.conversations[user1]?.[user2] ||
        this.conversations[user2]?.[user1] ||
        [];

      res.status(200).json(conversation);
    });
  }

  start(port = 3000) {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

module.exports = MessageApp;

// Main startup file (e.g., index.js)
if (require.main === module) {
  const app = new MessageApp(process.env.OPENAI_API_KEY);
  app.start(3000);
}
