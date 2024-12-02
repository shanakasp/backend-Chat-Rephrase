const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const cors = require("cors");
require("dotenv").config();
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

class MessageService {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey: apiKey });
  }

  async rephraseMessage(originalMessage, categoryPrompt) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4", // Changed from gpt-3.5-turbo to gpt-4
        messages: [
          {
            role: "system",
            content: `${categoryPrompt}`,
          },
          {
            role: "user",
            content: originalMessage,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      // Ensure only the rephrased message is returned
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error rephrasing message:", error);
      return originalMessage; // Return original message if something goes wrong
    }
  }
}

class MessageApp {
  constructor(openaiApiKey) {
    this.app = express();
    this.messageService = new MessageService(openaiApiKey);

    this.app.use(bodyParser.json());
    this.app.use(
      cors({
        origin: "https://jovial-semolina-6bb8cb.netlify.app", // Allow requests from your React app
        methods: ["GET", "POST"], // Allow specific HTTP methods
        allowedHeaders: ["Content-Type"], // Allow specific headers
      })
    );

    this.conversations = {};
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.post("/send-message", async (req, res) => {
      const { sender, recipient, message, categoryPrompt } = req.body;

      if (!sender || !recipient || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        // Call the rephrasing method
        const phrasedMessage = await this.messageService.rephraseMessage(
          message,
          categoryPrompt
        );

        // Save the conversation (if needed)
        if (!this.conversations[sender]) {
          this.conversations[sender] = {};
        }
        if (!this.conversations[sender][recipient]) {
          this.conversations[sender][recipient] = [];
        }

        const messageEntry = {
          sender,
          message: phrasedMessage, // The rephrased message
          originalMessage: message,
          categoryPrompt,
          timestamp: new Date(),
        };

        this.conversations[sender][recipient].push(messageEntry);

        // Return the rephrased message along with other details
        res.status(200).json({
          sender,
          recipient,
          message: phrasedMessage, // Return the rephrased message
          originalMessage: message,
          categoryPrompt,
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

    this.app.post("/restart", (req, res) => {
      try {
        // Path to the main index.js file
        const indexPath = path.join(__dirname, "index.js");

        // Get current timestamp
        const timestamp = new Date().toISOString();

        // Update file timestamp to trigger Nodemon restart
        fs.utimesSync(indexPath, new Date(), new Date());

        console.log("Restart requested. Nodemon will handle restart.");

        res.status(200).json({
          message: "Restart initiated",
          timestamp: timestamp,
        });
      } catch (error) {
        console.error("Restart failed:", error);
        res.status(500).json({
          error: "Restart failed",
          details: error.message,
        });
      }
    });
  }

  start(port = 4000) {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

module.exports = MessageApp;

// Main startup file (e.g., index.js)
if (require.main === module) {
  const app = new MessageApp(process.env.OPENAI_API_KEY);
  app.start(4000);
}
