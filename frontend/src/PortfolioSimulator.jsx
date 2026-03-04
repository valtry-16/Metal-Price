import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useAuth } from "./contexts/AuthContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const METALS = [
  { symbol: "XAU", name: "Gold", carats: ["24", "22", "18"] },
  { symbol: "XAG", name: "Silver" },
  { symbol: "XPT", name: "Platinum" },
  { symbol: "XPD", name: "Palladium" },
  { symbol: "XCU", name: "Copper" },
  { symbol: "LEAD", name: "Lead" },
  { symbol: "NI", name: "Nickel" },
  { symbol: "ZNC", name: "Zinc" },
  { symbol: "ALU", name: "Aluminium" },
];

const fmt = (n) =>
  n != null
    ? `\u20B9${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "N/A";

export default function PortfolioSimulator({ apiBase, onClose, embedded = false }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [balance, setBalance] = useState(1000000);
  const [holdings, setHoldings] = useState([]);
  const [history, setHistory] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [priceDate, setPriceDate] = useState(null);

  // Buy form
  const [buyMetal, setBuyMetal] = useState("XAU");
  const [buyCarat, setBuyCarat] = useState("22");
  const [buyWeight, setBuyWeight] = useState("");
  const [buying, setBuying] = useState(false);
  const [selling, setSelling] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [toppingUp, setToppingUp] = useState(false);

  // Active tab
  const [tab, setTab] = useState("holdings"); // holdings | history | performance

  // Portfolio value snapshots for chart (stored per session)
  const [snapshots, setSnapshots] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("auric-portfolio-snapshots") || "[]");
    } catch { return []; }
  });

  const selectedMetalInfo = METALS.find((m) => m.symbol === buyMetal);
  const isGold = buyMetal === "XAU";

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${apiBase}/api/portfolio?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.status === "success") {
        setBalance(data.balance);
        setHoldings(data.holdings || []);
        setHistory(data.history || []);
      } else {
        setError(data.message || "Failed to load portfolio");
      }
    } catch (err) {
      setError("Failed to connect to server");
    }
  }, [apiBase, userId]);

  // Fetch live prices
  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/portfolio/prices`);
      const data = await res.json();
      if (data.status === "success") {
        setLivePrices(data.prices || {});
        setPriceDate(data.date);
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    }
  }, [apiBase]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPortfolio(), fetchPrices()]);
      setLoading(false);
    };
    init();
  }, [fetchPortfolio, fetchPrices, userId]);

  // Auto-refresh prices every 60s
  useEffect(() => {
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Save snapshot whenever holdings or prices change
  useEffect(() => {
    if (holdings.length === 0 && snapshots.length === 0) return;
    const totalValue = holdings.reduce((sum, h) => {
      const key = h.carat ? `${h.metal_name}_${h.carat}K` : h.metal_name;
      const currentPrice = livePrices[key] || h.buy_price_per_gram;
      return sum + currentPrice * h.weight_grams;
    }, 0);

    const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const newSnap = [...snapshots, { time: now, value: parseFloat(totalValue.toFixed(2)) }].slice(-20);
    setSnapshots(newSnap);
    localStorage.setItem("auric-portfolio-snapshots", JSON.stringify(newSnap));
  }, [holdings.length, Object.keys(livePrices).length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current price for a holding
  const getCurrentPrice = (h) => {
    const key = h.carat ? `${h.metal_name}_${h.carat}K` : h.metal_name;
    return livePrices[key] || null;
  };

  // Buy handler
  const handleBuy = async () => {
    const weight = parseFloat(buyWeight);
    if (!weight || weight <= 0) { setError("Enter a valid weight"); return; }

    setBuying(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${apiBase}/api/portfolio/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          metalName: buyMetal,
          carat: isGold ? buyCarat : null,
          weightGrams: weight,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(data.message);
        setBalance(data.newBalance);
        setBuyWeight("");
        await fetchPortfolio();
      } else {
        setError(data.message || "Buy failed");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setBuying(false);
    }
  };

  // Sell handler
  const handleSell = async (holdingId) => {
    setSelling(holdingId);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${apiBase}/api/portfolio/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, holdingId }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(data.message);
        setBalance(data.newBalance);
        await fetchPortfolio();
      } else {
        setError(data.message || "Sell failed");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setSelling(null);
    }
  };

  // Top-up handler
  const handleTopUp = async () => {
    setToppingUp(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${apiBase}/api/portfolio/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(data.message);
        setBalance(data.newBalance);
      } else {
        setError(data.message || "Top-up failed");
      }
    } catch (err) {
      setError("Top-up failed");
    } finally {
      setToppingUp(false);
    }
  };

  // Reset handler
  const handleReset = async () => {
    if (!confirm("Reset your entire portfolio? All holdings will be deleted and balance restored to \u20B910,00,000.")) return;
    try {
      const res = await fetch(`${apiBase}/api/portfolio/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(data.message);
        setBalance(1000000);
        setHoldings([]);
        setHistory([]);
        setSnapshots([]);
        localStorage.removeItem("auric-portfolio-snapshots");
      }
    } catch (err) {
      setError("Reset failed");
    }
  };

  // Compute portfolio summary
  const totalInvested = holdings.reduce((s, h) => s + h.total_cost, 0);
  const totalCurrentValue = holdings.reduce((s, h) => {
    const cur = getCurrentPrice(h);
    return s + (cur ? cur * h.weight_grams : h.total_cost);
  }, 0);
  const totalPL = totalCurrentValue - totalInvested;
  const totalPLPercent = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : "0.00";

  // Estimate cost preview
  const estimatedCost = useMemo(() => {
    const weight = parseFloat(buyWeight);
    if (!weight || weight <= 0) return null;
    const key = isGold ? `XAU_${buyCarat}K` : buyMetal;
    const price = livePrices[key];
    if (!price) return null;
    return { pricePerGram: price, total: parseFloat((price * weight).toFixed(2)) };
  }, [buyWeight, buyMetal, buyCarat, isGold, livePrices]);

  // Chart data
  const chartData = {
    labels: snapshots.map((s) => s.time),
    datasets: [
      {
        label: "Portfolio Value (\u20B9)",
        data: snapshots.map((s) => s.value),
        borderColor: "#c59a3c",
        backgroundColor: "rgba(197, 154, 60, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#c59a3c",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => fmt(ctx.raw),
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5d6b7a", maxTicksLimit: 8 } },
      y: {
        grid: { color: "rgba(93,107,122,0.15)" },
        ticks: { color: "#5d6b7a", callback: (v) => `\u20B9${(v / 1000).toFixed(0)}K` },
      },
    },
  };

  // Auto-clear messages
  useEffect(() => {
    if (successMsg || error) {
      const t = setTimeout(() => { setSuccessMsg(""); setError(""); }, 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg, error]);

  const metalName = (h) => {
    const m = METALS.find((m) => m.symbol === h.metal_name);
    const base = m ? m.name : h.metal_name;
    return h.carat ? `${base} (${h.carat}K)` : base;
  };

  if (loading) {
    if (embedded) {
      return <div className="portfolio-embedded"><div className="portfolio-loading">Loading portfolio...</div></div>;
    }
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content portfolio-modal" onClick={(e) => e.stopPropagation()}>
          <div className="portfolio-loading">Loading portfolio...</div>
        </div>
      </div>
    );
  }

  const content = (
    <>
        <div className="modal-header">
          <h2>Portfolio Simulator</h2>
          {!embedded && <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>}
        </div>

        {/* Messages */}
        {error && <div className="portfolio-msg portfolio-error">{error}</div>}
        {successMsg && <div className="portfolio-msg portfolio-success">{successMsg}</div>}

        {/* Balance Card */}
        <div className="portfolio-balance-card">
          <div className="portfolio-balance-row">
            <div>
              <div className="portfolio-balance-label">Virtual Balance</div>
              <div className="portfolio-balance-amount">{fmt(balance)}</div>
            </div>
            <div className="portfolio-balance-right">
              <div className="portfolio-balance-label">Portfolio Value</div>
              <div className="portfolio-balance-amount">{fmt(totalCurrentValue)}</div>
            </div>
          </div>
          <div className="portfolio-summary-row">
            <span>Invested: {fmt(totalInvested)}</span>
            <span className={totalPL >= 0 ? "portfolio-profit" : "portfolio-loss"}>
              P&L: {totalPL >= 0 ? "+" : ""}{fmt(totalPL)} ({totalPLPercent}%)
            </span>
          </div>
          {balance < 1000000 && (
            <button
              onClick={handleTopUp}
              disabled={toppingUp}
              className="portfolio-topup-btn"
            >
              {toppingUp ? "Adding..." : "+ Top Up \u20B910,000"}
            </button>
          )}
        </div>

        {/* Buy Form */}
        <div className="portfolio-buy-form">
          <h3>Buy Metal</h3>
          <div className="portfolio-buy-inputs">
            <select aria-label="Select metal" value={buyMetal} onChange={(e) => setBuyMetal(e.target.value)} className="portfolio-select">
              {METALS.map((m) => (
                <option key={m.symbol} value={m.symbol}>{m.name}</option>
              ))}
            </select>
            {isGold && (
              <select aria-label="Select carat" value={buyCarat} onChange={(e) => setBuyCarat(e.target.value)} className="portfolio-select portfolio-select-sm">
                <option value="24">24K</option>
                <option value="22">22K</option>
                <option value="18">18K</option>
              </select>
            )}
            <input
              aria-label="Weight in grams"
              type="number"
              placeholder="Weight (grams)"
              value={buyWeight}
              onChange={(e) => setBuyWeight(e.target.value)}
              min="0.01"
              step="0.01"
              className="portfolio-input"
            />
            <button onClick={handleBuy} disabled={buying || !buyWeight} className="portfolio-buy-btn">
              {buying ? "Buying..." : "Buy"}
            </button>
          </div>
          {estimatedCost && (
            <div className="portfolio-estimate">
              Price: {fmt(estimatedCost.pricePerGram)}/g &mdash; Estimated cost: <strong>{fmt(estimatedCost.total)}</strong>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="portfolio-tabs">
          <button className={`portfolio-tab ${tab === "holdings" ? "active" : ""}`} onClick={() => setTab("holdings")}>
            Holdings ({holdings.length})
          </button>
          <button className={`portfolio-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            History ({history.length})
          </button>
          <button className={`portfolio-tab ${tab === "performance" ? "active" : ""}`} onClick={() => setTab("performance")}>
            Performance
          </button>
        </div>

        {/* Holdings Tab */}
        {tab === "holdings" && (
          <div className="portfolio-holdings">
            {holdings.length === 0 ? (
              <div className="portfolio-empty">No holdings yet. Buy some metals to start!</div>
            ) : (
              <div className="portfolio-table-wrap">
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>Metal</th>
                      <th>Weight</th>
                      <th>Buy Price</th>
                      <th>Current</th>
                      <th>P&L</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => {
                      const cur = getCurrentPrice(h);
                      const currentVal = cur ? cur * h.weight_grams : null;
                      const pl = currentVal ? currentVal - h.total_cost : null;
                      return (
                        <tr key={h.id}>
                          <td className="portfolio-td-metal">{metalName(h)}</td>
                          <td>{h.weight_grams}g</td>
                          <td>{fmt(h.total_cost)}</td>
                          <td>{currentVal ? fmt(currentVal) : "..."}</td>
                          <td className={pl != null ? (pl >= 0 ? "portfolio-profit" : "portfolio-loss") : ""}>
                            {pl != null ? `${pl >= 0 ? "+" : ""}${fmt(pl)}` : "..."}
                          </td>
                          <td>
                            <button
                              className="portfolio-sell-btn"
                              onClick={() => handleSell(h.id)}
                              disabled={selling === h.id}
                            >
                              {selling === h.id ? "..." : "Sell"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="portfolio-holdings">
            {history.length === 0 ? (
              <div className="portfolio-empty">No trade history yet.</div>
            ) : (
              <div className="portfolio-table-wrap">
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>Metal</th>
                      <th>Weight</th>
                      <th>Bought</th>
                      <th>Sold</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const pl = h.sell_total ? h.sell_total - h.total_cost : 0;
                      return (
                        <tr key={h.id}>
                          <td className="portfolio-td-metal">{metalName(h)}</td>
                          <td>{h.weight_grams}g</td>
                          <td>{fmt(h.total_cost)}</td>
                          <td>{fmt(h.sell_total)}</td>
                          <td className={pl >= 0 ? "portfolio-profit" : "portfolio-loss"}>
                            {pl >= 0 ? "+" : ""}{fmt(pl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {tab === "performance" && (
          <div className="portfolio-chart-section">
            {snapshots.length < 2 ? (
              <div className="portfolio-empty">Make some trades to see performance chart.</div>
            ) : (
              <div className="portfolio-chart-container">
                <Line data={chartData} options={chartOptions} />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="portfolio-footer">
          {priceDate && <span className="portfolio-price-date">Prices as of {priceDate}</span>}
          <button onClick={handleReset} className="portfolio-reset-btn">Reset Portfolio</button>
        </div>
    </>
  );

  if (embedded) {
    return <div className="portfolio-embedded">{content}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content portfolio-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
