import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const { TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.warn("⚠️  TELEGRAM_BOT_TOKEN not set. Telegram bot will not start.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_KEY || "");

let bot = null;
let botInitialized = false;

if (TELEGRAM_BOT_TOKEN && !botInitialized) {
  // Create bot in WEBHOOK mode only - no polling
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  botInitialized = true;
  console.log("✅ Telegram bot initialized (Webhook mode)");
  console.log("💡 Webhook must be set manually via Telegram API");
}

// Helper function to send "collecting data" message
const sendCollectingIndicator = async (chatId) => {
  try {
    return await bot.sendMessage(chatId, "⏳ *Collecting data...* Please wait while we fetch the latest prices.", { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error sending indicator:", error);
  }
};

// Helper function to update/delete the collecting message
const deleteMessage = async (chatId, messageId) => {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    console.warn("Could not delete message:", error.message);
  }
};

// Helper function to format price data for Telegram
const formatPricesForTelegram = (metalPrices) => {
  if (!metalPrices || Object.keys(metalPrices).length === 0) {
    return "⚠️ No price data available at the moment.";
  }

  const metalNames = {
    XAU: "Gold (22K)",
    XAG: "Silver",
    XPT: "Platinum",
    XPD: "Palladium",
    XCU: "Copper",
    LEAD: "Lead",
    NI: "Nickel",
    ZNC: "Zinc",
    ALU: "Aluminium"
  };

  let message = "💰 *Current Metal Prices* 💰\n\n";
  
  Object.entries(metalPrices).forEach(([symbol, price]) => {
    const name = metalNames[symbol] || symbol;
    const formattedPrice = price ? `₹${price.toFixed(2)}` : "N/A";
    message += `${name}: ${formattedPrice}\n`;
  });

  message += `\n_Updated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}_`;
  
  return message;
};

// Helper function to get metal name from symbol
const getMetalName = (symbol) => {
  const metalNames = {
    XAU: "Gold (22K)",
    XAG: "Silver",
    XPT: "Platinum",
    XPD: "Palladium",
    XCU: "Copper",
    LEAD: "Lead",
    NI: "Nickel",
    ZNC: "Zinc",
    ALU: "Aluminium"
  };
  return metalNames[symbol] || symbol;
};

// Helper function to send charts for a specific metal
const sendChartForMetal = async (chatId, metalSymbol, days = 30) => {
  try {
    const metalName = getMetalName(metalSymbol);
    
    // Fetch data based on requested days
    const { data: priceData, error } = await supabase
      .from("metal_prices")
      .select("date, price_1g")
      .eq("metal_name", metalSymbol)
      .order("date", { ascending: false })
      .limit(days);

    if (error) throw error;

    if (!priceData || priceData.length === 0) {
      await bot.sendMessage(chatId, `⚠️ No historical data available for ${metalName}`);
      return;
    }

    // Filter for Gold 22K carat only
    let filteredData = priceData;
    if (metalSymbol === "XAU") {
      const { data: goldData } = await supabase
        .from("metal_prices")
        .select("date, price_1g, carat")
        .eq("metal_name", metalSymbol)
        .eq("carat", "22")
        .order("date", { ascending: false })
        .limit(days);
      
      if (goldData && goldData.length > 0) {
        filteredData = goldData;
      }
    }

    // Remove duplicates by date and reverse to get chronological order
    const uniqueData = [];
    const seenDates = new Set();
    for (const row of filteredData) {
      if (!seenDates.has(row.date) && row.price_1g) {
        seenDates.add(row.date);
        uniqueData.push(row);
      }
    }
    uniqueData.reverse();

    if (uniqueData.length < 2) {
      await bot.sendMessage(chatId, `⚠️ Not enough historical data for ${metalName}`);
      return;
    }

    // Generate chart based on requested period
    const chartUrl = generateQuickChartUrl(uniqueData, metalName, `${days}-Day`);
    const latestPrice = uniqueData[uniqueData.length - 1].price_1g;

    await bot.sendPhoto(chatId, chartUrl, {
      caption: `📈 *${days}-Day Price Chart*\n${metalName}: ₹${latestPrice.toFixed(2)}/g`,
      parse_mode: "Markdown"
    });

  } catch (error) {
    console.error("Error sending chart:", error);
    await bot.sendMessage(chatId, "❌ Error generating chart. Please try again later.");
  }
};

// Helper function to send month chart for a specific metal
const sendMonthChartForMetal = async (chatId, metalSymbol, month) => {
  try {
    const metalName = getMetalName(metalSymbol);
    
    // Parse month (YYYY-MM format)
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate(); // Last day of month
    const endDateStr = `${year}-${monthNum}-${endDate.toString().padStart(2, '0')}`;
    
    // Fetch data for the entire month
    const { data: priceData, error } = await supabase
      .from("metal_prices")
      .select("date, price_1g")
      .eq("metal_name", metalSymbol)
      .gte("date", startDate)
      .lte("date", endDateStr)
      .order("date", { ascending: true });

    if (error) throw error;

    if (!priceData || priceData.length === 0) {
      await bot.sendMessage(chatId, `⚠️ No data available for ${metalName} in ${month}`);
      return;
    }

    // Filter for Gold 22K carat only
    let filteredData = priceData;
    if (metalSymbol === "XAU") {
      const { data: goldData } = await supabase
        .from("metal_prices")
        .select("date, price_1g, carat")
        .eq("metal_name", metalSymbol)
        .eq("carat", "22")
        .gte("date", startDate)
        .lte("date", endDateStr)
        .order("date", { ascending: true });
      
      if (goldData && goldData.length > 0) {
        filteredData = goldData;
      }
    }

    // Remove duplicates by date
    const uniqueData = [];
    const seenDates = new Set();
    for (const row of filteredData) {
      if (!seenDates.has(row.date) && row.price_1g) {
        seenDates.add(row.date);
        uniqueData.push(row);
      }
    }

    if (uniqueData.length < 2) {
      await bot.sendMessage(chatId, `⚠️ Not enough data for ${metalName} in ${month}`);
      return;
    }

    // Get month name
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(monthNum) - 1];
    
    // Generate chart
    const chartUrl = generateQuickChartUrl(uniqueData, metalName, `${monthName} ${year}`);
    const latestPrice = uniqueData[uniqueData.length - 1].price_1g;

    await bot.sendPhoto(chatId, chartUrl, {
      caption: `📈 *${monthName} ${year} Price Chart*\n${metalName}: ₹${latestPrice.toFixed(2)}/g (${uniqueData.length} days)`,
      parse_mode: "Markdown"
    });

  } catch (error) {
    console.error("Error sending chart:", error);
    await bot.sendMessage(chatId, "❌ Error generating charts. Please try again later.");
  }
};

// Generate QuickChart.io URL for chart
const generateQuickChartUrl = (data, metalName, period) => {
  const labels = data.map(d => {
    const date = new Date(d.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });
  
  const prices = data.map(d => d.price_1g.toFixed(2));
  
  const minPrice = Math.min(...data.map(d => d.price_1g));
  const maxPrice = Math.max(...data.map(d => d.price_1g));
  const priceRange = maxPrice - minPrice;
  const suggestedMin = Math.floor(minPrice - priceRange * 0.1);
  const suggestedMax = Math.ceil(maxPrice + priceRange * 0.1);

  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${metalName} (₹/g)`,
        data: prices,
        borderColor: '#d4af37',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#d4af37',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${metalName} - ${period} Price Trend`,
          font: { size: 18, weight: 'bold' },
          color: '#2c3e50'
        },
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: suggestedMin,
          suggestedMax: suggestedMax,
          ticks: {
            callback: function(value) {
              return '₹' + value;
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  };

  const chartConfigStr = JSON.stringify(chartConfig);
  const encodedConfig = encodeURIComponent(chartConfigStr);
  
  return `https://quickchart.io/chart?width=800&height=400&c=${encodedConfig}`;
};

// Command handlers
if (bot) {
  // Single message handler to avoid duplicate responses
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    // Check if it's a metal symbol with period/month (e.g., "XAU 7", "XAU 30", "XAU 2026-01")
    const metalSymbols = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];
    const parts = text.toUpperCase().split(/\s+/);
    
    if (metalSymbols.includes(parts[0]) && !text.startsWith('/')) {
      const metalSymbol = parts[0];
      
      // If only metal symbol, ask for period
      if (parts.length === 1) {
        const periodMessage = `
📊 Select chart period for *${getMetalName(metalSymbol)}*:

Reply with:
• \`${metalSymbol} 7\` - Last 7 days
• \`${metalSymbol} 30\` - Last 30 days
• \`${metalSymbol} 2026-01\` - Specific month (YYYY-MM)

_Example: Send "${metalSymbol} 7" for 7-day chart_
        `.trim();
        await bot.sendMessage(chatId, periodMessage, { parse_mode: "Markdown" });
        return;
      }
      
      // Parse period/month
      const period = parts[1];
      
      // Check if it's a month format (YYYY-MM)
      if (/^\d{4}-\d{2}$/.test(period)) {
        await sendMonthChartForMetal(chatId, metalSymbol, period);
        return;
      }
      
      // Check if it's 7 or 30 days
      if (period === '7' || period === '30') {
        await sendChartForMetal(chatId, metalSymbol, parseInt(period));
        return;
      }
      
      // Invalid period
      await bot.sendMessage(chatId, `❌ Invalid period. Use "7", "30", or month format (YYYY-MM)`);
      return;
    }
    
    // Only process commands (starting with /)
    if (!text.startsWith('/')) return;
    
    const command = text.split(' ')[0].toLowerCase();
    
    try {
      // /start and /help commands
      if (command === '/start' || command === '/help') {
        const welcomeMessage = `
🌟 *Welcome to Auric Ledger Bot!* 🌟

Your instant precious metals price tracker.

*📋 Available Commands:*

/prices - Get current prices for all metals
/yesterday - View yesterday's prices  
/chart - See 7-day & 30-day charts
/download - Get PDF price reports
/subscribe - Daily updates (9 AM IST)
/unsubscribe - Stop daily updates

*💡 Quick Tips:*

Send metal symbol + period:
• \`XAU 7\` → Gold 7-day chart
• \`XAU 30\` → Gold 30-day chart
• \`XAU 2026-01\` → Gold January 2026

_Metal codes: XAU, XAG, XPT, XPD, XCU, LEAD, NI, ZNC, ALU_

Get started → /prices 💎
        `.trim();
        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
        return;
      }

      // /prices command
      if (command === '/prices') {
        // Show collecting indicator
        const indicatorMsg = await sendCollectingIndicator(chatId);
        
        try {
          // Get the latest date from database
          const { data: latestDateData, error: dateError } = await supabase
            .from("metal_prices")
            .select("date")
            .order("date", { ascending: false })
            .limit(1);

          if (dateError) throw dateError;

          if (!latestDateData || latestDateData.length === 0) {
            await bot.sendMessage(chatId, "⚠️ No price data available at the moment. Please try again later.");
            if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
            return;
          }

          const latestDate = latestDateData[0].date;

          // Fetch all prices for the latest date
          const { data, error } = await supabase
            .from("metal_prices")
            .select("*")
            .eq("date", latestDate);

          if (error) throw error;

          if (!data || data.length === 0) {
            await bot.sendMessage(chatId, "⚠️ No price data available at the moment. Please try again later.");
            if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
            return;
          }

          // Process prices (similar to email logic)
          const availableMetals = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];
          const metalPrices = {};

          data.forEach(row => {
            if (!availableMetals.includes(row.metal_name)) return;
            
            // Special handling for Gold - only use 22K carat
            if (row.metal_name === "XAU") {
              if (row.carat === "22" && row.price_1g) {
                metalPrices['XAU'] = row.price_1g;
              }
              return;
            }
            
            // For other metals, just take the first price
            if (!metalPrices[row.metal_name] && row.price_1g) {
              metalPrices[row.metal_name] = row.price_1g;
            }
          });

          const message = formatPricesForTelegram(metalPrices);
          await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
          if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
        } catch (error) {
          console.error("Error in /prices command:", error);
          await bot.sendMessage(chatId, "❌ Error fetching prices. Please try again later.");
          if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
        }
        return;
      }

      // /yesterday command - show yesterday's prices
      if (command === '/yesterday') {
        // Show collecting indicator
        const indicatorMsg = await sendCollectingIndicator(chatId);
        
        try {
          // Get the latest two dates from database
          const { data: dates, error: dateError } = await supabase
            .from("metal_prices")
            .select("date")
            .order("date", { ascending: false })
            .limit(10);

          if (dateError) throw dateError;

          if (!dates || dates.length < 1) {
            await bot.sendMessage(chatId, "⚠️ No historical data available.");
            if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
            return;
          }

          // Get unique dates
          const uniqueDates = [...new Set(dates.map(d => d.date))];
          if (uniqueDates.length < 1) {
            await bot.sendMessage(chatId, "⚠️ No data available yet.");
            if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
            return;
          }

const yesterdayDate = uniqueDates[1] || uniqueDates[0]; // Second most recent date or latest if only 1

          // Fetch all prices for yesterday
          const { data, error } = await supabase
            .from("metal_prices")
            .select("*")
            .eq("date", yesterdayDate);

          if (error) throw error;

          if (!data || data.length === 0) {
            await bot.sendMessage(chatId, "⚠️ Yesterday's data not available.");
            if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
            return;
          }

          // Process prices (similar to current prices)
          const availableMetals = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];
          const metalPrices = {};

          data.forEach(row => {
            if (!availableMetals.includes(row.metal_name)) return;
            
            // Special handling for Gold - only use 22K carat
            if (row.metal_name === "XAU") {
              if (row.carat === "22" && row.price_1g) {
                metalPrices['XAU'] = row.price_1g;
              }
              return;
            }
            
            // For other metals, just take the first price
            if (!metalPrices[row.metal_name] && row.price_1g) {
              metalPrices[row.metal_name] = row.price_1g;
            }
          });

          const metalNames = {
            XAU: "Gold (22K)",
            XAG: "Silver",
            XPT: "Platinum",
            XPD: "Palladium",
            XCU: "Copper",
            LEAD: "Lead",
            NI: "Nickel",
            ZNC: "Zinc",
            ALU: "Aluminium"
          };

          let message = `📅 *Yesterday's Prices* /${yesterdayDate}\n\n`;
          
          Object.entries(metalPrices).forEach(([symbol, price]) => {
            const name = metalNames[symbol] || symbol;
            const formattedPrice = price ? `₹${price.toFixed(2)}/g` : "N/A";
            message += `*${name}*: ${formattedPrice}\n`;
          });

          await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
          if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
        } catch (error) {
          console.error("Error in /yesterday command:", error);
          await bot.sendMessage(chatId, "❌ Error fetching yesterday's prices. Please try again later.");
          if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
        }
        return;
      }

      // /chart command - show price charts
      if (command === '/chart') {
        const selectMessage = `
📊 *Select a metal to view charts:*

*Available metals:*
• XAU - Gold (22K)
• XAG - Silver
• XPT - Platinum
• XPD - Palladium
• XCU - Copper
• LEAD - Lead
• NI - Nickel
• ZNC - Zinc
• ALU - Aluminium

*How to use:*
• Send \`XAU 7\` for 7-day chart
• Send \`XAU 30\` for 30-day chart
• Send \`XAU 2026-01\` for specific month

_Example: Send "XAU 7" to see Gold 7-day chart_
        `.trim();
        
        await bot.sendMessage(chatId, selectMessage, { parse_mode: "Markdown" });
        return;
      }

      // /subscribe command
      if (command === '/subscribe') {
        // Check if already subscribed
        const { data: existing, error: checkError } = await supabase
          .from("telegram_subscribers")
          .select("*")
          .eq("chat_id", chatId)
          .single();

        if (existing && existing.active) {
          await bot.sendMessage(chatId, "✅ You're already subscribed to daily price updates!");
          return;
        }

        // Subscribe or reactivate
        if (existing && !existing.active) {
          const { error: updateError } = await supabase
            .from("telegram_subscribers")
            .update({ active: true })
            .eq("chat_id", chatId);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from("telegram_subscribers")
            .insert([{ chat_id: chatId, active: true }]);

          if (insertError) throw insertError;
        }

        await bot.sendMessage(
          chatId,
          "✅ *Successfully subscribed!*\n\nYou'll receive daily price updates at 9:00 AM (IST). 🔔",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // /download command - guide users to download PDF reports
      if (command === '/download') {
        const downloadMessage = `
📥 *Download Price Data Reports*

You can download detailed PDF reports of metal prices:

*Available Downloads:*
• 📅 *Weekly Reports* - 7 days of price history
• 📊 *Monthly Reports* - Full month price data
• 📈 *Trend Analysis* - Charts and statistics

*How to Download:*

1️⃣ Visit the web app:
[Auric Ledger](https://auric-ledger.vercel.app)

2️⃣ Select a metal from the dropdown

3️⃣ Click "📄 Download PDF" button

*Available Metals:*
🥇 Gold • 🥈 Silver • Platinum • Palladium • Copper • Lead • Nickel • Zinc • Aluminium

_PDF reports include price summaries, 7-day analysis, and detailed price tables._
        `.trim();
        
        await bot.sendMessage(chatId, downloadMessage, { parse_mode: "Markdown" });
        return;
      }

      // /unsubscribe command
      if (command === '/unsubscribe') {
        const { data: existing, error: checkError } = await supabase
          .from("telegram_subscribers")
          .select("*")
          .eq("chat_id", chatId)
          .single();

        if (!existing || !existing.active) {
          await bot.sendMessage(chatId, "ℹ️ You're not currently subscribed to daily updates.");
          return;
        }

        const { error: updateError } = await supabase
          .from("telegram_subscribers")
          .update({ active: false })
          .eq("chat_id", chatId);

        if (updateError) throw updateError;

        await bot.sendMessage(
          chatId,
          "✅ *Successfully unsubscribed!*\n\nYou can resubscribe anytime using /subscribe",
          { parse_mode: "Markdown" }
        );
        return;
      }
    } catch (error) {
      console.error("Error handling command:", error);
      await bot.sendMessage(chatId, "❌ An error occurred. Please try again later.");
    }
  });

  // Handle errors
  bot.on("polling_error", (error) => {
    console.error("Telegram bot polling error:", error);
  });
}

// Function to send daily prices to all subscribers
// Function to send daily prices to all subscribers
export const sendDailyPricesToTelegram = async (metalPrices) => {
  if (!bot) {
    console.log("Telegram bot not initialized, skipping daily broadcast");
    return;
  }

  try {
    // Get all active subscribers
    const { data: subscribers, error } = await supabase
      .from("telegram_subscribers")
      .select("chat_id")
      .eq("active", true);

    if (error) throw error;

    if (!subscribers || subscribers.length === 0) {
      console.log("No Telegram subscribers found");
      return;
    }

    // Fetch yesterday's prices for comparison
    const { data: dates, error: dateError } = await supabase
      .from("metal_prices")
      .select("date")
      .order("date", { ascending: false })
      .limit(10);

    let yesterdayPrices = {};
    
    if (!dateError && dates && dates.length >= 2) {
      const uniqueDates = [...new Set(dates.map(d => d.date))];
      
      if (uniqueDates.length >= 2) {
        const yesterdayDate = uniqueDates[1];
        
        // Fetch yesterday's data
        const { data: yesterdayData } = await supabase
          .from("metal_prices")
          .select("*")
          .eq("date", yesterdayDate);
        
        if (yesterdayData) {
          const availableMetals = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'LEAD', 'NI', 'ZNC', 'ALU'];
          
          yesterdayData.forEach(row => {
            if (!availableMetals.includes(row.metal_name)) return;
            
            if (row.metal_name === "XAU") {
              if (row.carat === "22" && row.price_1g) {
                yesterdayPrices['XAU'] = row.price_1g;
              }
              return;
            }
            
            if (!yesterdayPrices[row.metal_name] && row.price_1g) {
              yesterdayPrices[row.metal_name] = row.price_1g;
            }
          });
        }
      }
    }

    // Format message with price changes
    const message = formatDailyPricesWithChanges(metalPrices, yesterdayPrices);
    
    // Send to each subscriber
    for (const subscriber of subscribers) {
      try {
        await bot.sendMessage(subscriber.chat_id, message, { parse_mode: "Markdown" });
        console.log(`✅ Sent daily prices to Telegram chat: ${subscriber.chat_id}`);
      } catch (error) {
        console.error(`Error sending to chat ${subscriber.chat_id}:`, error.message);
        
        // If user blocked bot, deactivate subscription
        if (error.message.includes("blocked") || error.message.includes("chat not found")) {
          await supabase
            .from("telegram_subscribers")
            .update({ active: false })
            .eq("chat_id", subscriber.chat_id);
        }
      }
    }

    console.log(`📱 Daily prices sent to ${subscribers.length} Telegram subscribers`);
  } catch (error) {
    console.error("Error sending daily Telegram prices:", error);
  }
};

// Helper function to format daily prices with changes, colors, and better layout
const formatDailyPricesWithChanges = (todayPrices, yesterdayPrices) => {
  if (!todayPrices || Object.keys(todayPrices).length === 0) {
    return "⚠️ No price data available at the moment.";
  }

  const metalNames = {
    XAU: "Gold (22K)",
    XAG: "Silver",
    XPT: "Platinum",
    XPD: "Palladium",
    XCU: "Copper",
    LEAD: "Lead",
    NI: "Nickel",
    ZNC: "Zinc",
    ALU: "Aluminium"
  };

  // Enhanced formatting with better structure
  let message = `💎 *DAILY MARKET UPDATE*\n`;
  message += `${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  Object.entries(todayPrices).forEach(([symbol, todayPrice]) => {
    const name = metalNames[symbol] || symbol;
    const formattedPrice = todayPrice ? `₹${todayPrice.toFixed(2)}/g` : "N/A";
    
    // Calculate change from yesterday
    let changeSymbol = "⚪";
    let changeText = "─ No data";
    
    if (yesterdayPrices[symbol] && todayPrice) {
      const yesterdayPrice = yesterdayPrices[symbol];
      const change = todayPrice - yesterdayPrice;
      const changePercent = ((change / yesterdayPrice) * 100).toFixed(2);
      
      if (change > 0) {
        changeSymbol = "📈"; // Increase arrow
        changeText = `+₹${change.toFixed(2)} (+${changePercent}%)`;
      } else if (change < 0) {
        changeSymbol = "📉"; // Decrease arrow
        changeText = `₹${change.toFixed(2)} (${changePercent}%)`;
      } else {
        changeSymbol = "━";
        changeText = "No change";
      }
    }
    
    message += `\n*${name}*\n`;
    message += `💰 ${formattedPrice}\n`;
    message += `${changeSymbol} ${changeText}\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `\n_Last updated: ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}_\n\n`;
  message += `📊 *See detailed charts & set price alerts on the app* →\n`;
  message += `[Visit Auric Ledger](https://auric-ledger.vercel.app)`;
  
  return message;
};

export default bot;
