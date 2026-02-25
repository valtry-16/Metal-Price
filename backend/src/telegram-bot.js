import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import dayjs from "dayjs";

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
    return await bot.sendMessage(chatId, "<b>Fetching Data</b>\n\nPlease wait while we retrieve the latest prices...", { parse_mode: "HTML" });
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

  const timestamp = new Date().toLocaleString("en-IN", { 
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  });

  let message = "<b>Current Metal Prices</b>\nReal-time market rates\n\n━━━\n\n";
  
  Object.entries(metalPrices).forEach(([symbol, price]) => {
    const name = metalNames[symbol] || symbol;
    const formattedPrice = price ? `₹${price.toFixed(2)}/g` : "N/A";
    message += `<b>${name}</b>\n• ${formattedPrice}\n\n`;
  });

  message += `━━━\n\n<b>Last Updated</b>\n${timestamp}`;
  
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
      caption: `<b>${days}-Day Price Chart</b>\n${metalName}: ₹${latestPrice.toFixed(2)}/g`,
      parse_mode: "HTML"
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
      caption: `<b>${monthName} ${year} Price Chart</b>\n${metalName}: ₹${latestPrice.toFixed(2)}/g\n${uniqueData.length} days analyzed`,
      parse_mode: "HTML"
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
        const periodMessage = `<b>Select Time Period</b>\n${getMetalName(metalSymbol)}\n\n━━━\n\n<b>Available Options</b>\n\n• ${metalSymbol} 7 - Last 7 days\n• ${metalSymbol} 30 - Last 30 days\n• ${metalSymbol} 2026-01 - Specific month\n\n━━━\n\n<b>Example</b>\nSend "${metalSymbol} 7" for 7-day chart`;
        await bot.sendMessage(chatId, periodMessage, { parse_mode: "HTML" });
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
        const welcomeMessage = `<b>Auric Ledger Bot</b>\nPremium Metal Price Tracker\n\n━━━\n\n<b>Available Commands</b>\n\n• /prices - Current market rates\n• /yesterday - Yesterday's prices\n• /chart - Price history charts\n• /download - PDF reports\n• /subscribe - Daily updates (9 AM IST)\n• /unsubscribe - Stop updates\n\n━━━\n\n<b>Quick Actions</b>\n\nSend metal code + period:\n• XAU 7 - Gold 7-day chart\n• XAU 30 - Gold 30-day chart\n• XAU 2026-01 - Monthly view\n\n━━━\n\n<b>Supported Metals</b>\nXAU, XAG, XPT, XPD, XCU, LEAD, NI, ZNC, ALU\n\n━━━\n\n<b>Get Started</b>\nTry /prices to see current rates`;
        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" });
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
          await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
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
          // Calculate yesterday's date explicitly
          const today = dayjs().format("YYYY-MM-DD");
          const yesterdayDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");

          // Fetch all prices for yesterday's date
          const { data, error } = await supabase
            .from("metal_prices")
            .select("*")
            .eq("date", yesterdayDate);

          if (error) throw error;

          // If no data for yesterday, try to get the most recent date before today
          let finalData = data;
          let finalDate = yesterdayDate;
          
          if (!data || data.length === 0) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("metal_prices")
              .select("*")
              .lt("date", today)
              .order("date", { ascending: false })
              .limit(50);

            if (fallbackError) throw fallbackError;
            
            if (!fallbackData || fallbackData.length === 0) {
              await bot.sendMessage(chatId, "⚠️ No historical data available yet.");
              if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
              return;
            }
            
            // Get the most recent date from fallback
            finalDate = fallbackData[0].date;
            finalData = fallbackData.filter(row => row.date === finalDate);
          }

          // Fetch all prices for yesterday (use finalData)
          
          if (!finalData || finalData.length === 0) {
            await bot.sendMessage(chatId, "⚠️ Yesterday's data not available.");
            if (indicatorMsg) await deleteMessage(chatId, indicatorMsg.message_id);
            return;
          }

          // Process prices (similar to current prices)
          const availableMetals = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];
          const metalPrices = {};

          finalData.forEach(row => {
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

          let message = `<b>Yesterday's Prices</b>\n${finalDate}\n\n━━━\n\n`;
          
          Object.entries(metalPrices).forEach(([symbol, price]) => {
            const name = metalNames[symbol] || symbol;
            const formattedPrice = price ? `₹${price.toFixed(2)}/g` : "N/A";
            message += `<b>${name}</b>\n• ${formattedPrice}\n\n`;
          });

          message += `━━━\n\n<b>Compare</b>\nUse /prices to see today's rates`;

          await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
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
        const selectMessage = `<b>Price Charts</b>\nSelect metal & time period\n\n━━━\n\n<b>Available Metals</b>\n\n• XAU - Gold (22K)\n• XAG - Silver\n• XPT - Platinum\n• XPD - Palladium\n• XCU - Copper\n• LEAD - Lead\n• NI - Nickel\n• ZNC - Zinc\n• ALU - Aluminium\n\n━━━\n\n<b>How to Use</b>\n\n• XAU 7 - Gold 7-day chart\n• XAU 30 - Gold 30-day chart\n• XAU 2026-01 - Monthly view\n\n━━━\n\n<b>Example</b>\nSend "XAU 7" for Gold 7-day chart`;\n        \n        await bot.sendMessage(chatId, selectMessage, { parse_mode: "HTML" });
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
          "<b>Subscription Confirmed</b>\n\nYou'll receive daily price updates at 9:00 AM IST",
          { parse_mode: "HTML" }
        );
        return;
      }

      // /download command - guide users to download PDF reports
      if (command === '/download') {
        const downloadMessage = `<b>PDF Price Reports</b>\nDetailed market analysis\n\n━━━\n\n<b>Available Downloads</b>\n\n• Weekly Reports - 7 days history\n• Monthly Reports - Full month data\n• Trend Analysis - Charts & stats\n\n━━━\n\n<b>How to Download</b>\n\n• Visit <a href="https://auric-ledger.vercel.app">Auric Ledger</a>\n• Select a metal from dropdown\n• Click Download PDF button\n\n━━━\n\n<b>Available Metals</b>\n\nGold • Silver • Platinum • Palladium\nCopper • Lead • Nickel • Zinc • Aluminium\n\n━━━\n\n<b>Report Contents</b>\n\n• Price summaries\n• 7-day trend analysis\n• Detailed price tables`;\n        \n        await bot.sendMessage(chatId, downloadMessage, { parse_mode: "HTML" });
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
          "<b>Unsubscribed</b>\n\nYou can resubscribe anytime using /subscribe",
          { parse_mode: "HTML" }
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
        await bot.sendMessage(subscriber.chat_id, message, { parse_mode: "HTML" });
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
    return "<b>Market Update</b>\n\nNo price data available at the moment.";
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

  const dateStr = new Date().toLocaleDateString("en-IN", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
  const timeStr = new Date().toLocaleTimeString("en-IN", { 
    timeZone: "Asia/Kolkata", 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  // Enhanced formatting with better structure
  let message = `<b>Daily Market Update</b>\n${dateStr}\n\n━━━\n\n`;
  
  Object.entries(todayPrices).forEach(([symbol, todayPrice]) => {
    const name = metalNames[symbol] || symbol;
    const formattedPrice = todayPrice ? `₹${todayPrice.toFixed(2)}/g` : "N/A";
    
    // Calculate change from yesterday
    let changeText = "• No comparison data";
    
    if (yesterdayPrices[symbol] && todayPrice) {
      const yesterdayPrice = yesterdayPrices[symbol];
      const change = todayPrice - yesterdayPrice;
      const changePercent = ((change / yesterdayPrice) * 100).toFixed(2);
      
      if (change > 0) {
        changeText = `• ↑ +₹${change.toFixed(2)} (+${changePercent}%)`;
      } else if (change < 0) {
        changeText = `• ↓ ₹${change.toFixed(2)} (${changePercent}%)`;
      } else {
        changeText = "• Unchanged";
      }
    }
    
    message += `<b>${name}</b>\n• ${formattedPrice}\n${changeText}\n\n`;
  });

  message += `━━━\n\n<b>Last Updated</b>\n${timeStr} IST\n\n━━━\n\n<b>View Details</b>\n<a href="https://auric-ledger.vercel.app">Auric Ledger</a> - Charts & Alerts`;
  
  return message;
};

export default bot;
