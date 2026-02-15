import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const { TELEGRAM_BOT_TOKEN } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

const setupBotInfo = async () => {
  try {
    // Set bot description (shown when users first open the bot)
    await bot.setMyDescription(
      "Track real-time precious metal prices in INR! Get instant prices, interactive charts " +
      "(7-day/30-day/custom month), and daily updates for Gold, Silver, Platinum, Palladium, " +
      "Copper, Lead, Nickel, Zinc, and Aluminium.\n\n" +
      "Commands:\n" +
      "/prices - Current prices for all 9 metals\n" +
      "/yesterday - Yesterday's prices\n" +
      "/chart - View price charts (7/30 days or custom month)\n" +
      "/subscribe - Daily 9 AM price updates with change indicators\n" +
      "/unsubscribe - Stop daily updates\n\n" +
      "Features:\n" +
      "• Color-coded metal prices\n" +
      "• Price change tracking (↑↓)\n" +
      "• Custom month charts (YYYY-MM)\n" +
      "• Gold 22K carat pricing\n\n" +
      "Powered by Auric Ledger 💎"
    );
    console.log("✅ Bot description set");

    // Set short description (shown in search results and bot list)
    await bot.setMyShortDescription(
      "Real-time precious metal price tracker with charts and daily updates. " +
      "Track Gold, Silver, Platinum, and 6 more metals in INR! 💰📊"
    );
    console.log("✅ Short description set");

    // Set bot commands
    await bot.setMyCommands([
      { command: "start", description: "Welcome message and help" },
      { command: "help", description: "Show available commands" },
      { command: "prices", description: "Get current prices for all metals" },
      { command: "yesterday", description: "Get yesterday's metal prices" },
      { command: "chart", description: "View 7-day, 30-day, or custom month charts" },
      { command: "subscribe", description: "Subscribe to daily 9 AM price updates" },
      { command: "unsubscribe", description: "Unsubscribe from daily updates" }
    ]);
    console.log("✅ Bot commands set");

    console.log("\n🎉 Bot info setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting bot info:", error);
    process.exit(1);
  }
};

setupBotInfo();
