import { useEffect, useState, useMemo, useCallback } from "react";
import "./JewelleryCalculator.css";

const GOLD_PURITIES = [
  { label: "24K (99.9%)", value: "24", multiplier: 1.0 },
  { label: "22K (91.6%)", value: "22", multiplier: 0.916 },
  { label: "18K (75.0%)", value: "18", multiplier: 0.75 },
  { label: "14K (58.3%)", value: "14", multiplier: 0.583 },
];

const METALS = [
  { symbol: "XAU", name: "Gold", hasPurity: true },
  { symbol: "XAG", name: "Silver", hasPurity: false },
  { symbol: "XPT", name: "Platinum", hasPurity: false },
  { symbol: "XPD", name: "Palladium", hasPurity: false },
];

const WEIGHT_UNITS = [
  { label: "Grams", value: "g", toGrams: 1 },
  { label: "Tola (11.664g)", value: "tola", toGrams: 11.664 },
  { label: "Ounce (31.1g)", value: "oz", toGrams: 31.1035 },
  { label: "Sovereign (8g)", value: "sovereign", toGrams: 8 },
];

const fmt = (n) =>
  n != null
    ? `\u20B9${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "N/A";

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function JewelleryCalculator({ apiBase, onClose, embedded = false }) {
  const [metal, setMetal] = useState("XAU");
  const [purity, setPurity] = useState("22");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("g");
  const [makingCharge, setMakingCharge] = useState("8");
  const [makingType, setMakingType] = useState("percent"); // percent | flat
  const [gstPercent, setGstPercent] = useState("3");
  const [wastagePercent, setWastagePercent] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [pieces, setPieces] = useState("1");

  // Date mode: "live" or "historical"
  const [dateMode, setDateMode] = useState("live");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);

  // Price states
  const [livePrices, setLivePrices] = useState({});
  const [liveDate, setLiveDate] = useState(null);
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [historicalDate, setHistoricalDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);

  const selectedMetal = METALS.find((m) => m.symbol === metal);
  const isGold = metal === "XAU";

  // Fetch live prices
  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/portfolio/prices`);
      const data = await res.json();
      if (data.status === "success") {
        setLivePrices(data.prices || {});
        setLiveDate(data.date);
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Fetch available dates
  const fetchAvailableDates = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/available-dates`);
      const data = await res.json();
      if (data.status === "success") {
        setAvailableDates(data.dates || []);
      }
    } catch (err) {
      console.error("Failed to fetch dates:", err);
    }
  }, [apiBase]);

  // Fetch historical prices
  const fetchHistoricalPrices = useCallback(async (date) => {
    if (!date) return;
    setHistLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/prices-on-date?date=${date}`);
      const data = await res.json();
      if (data.status === "success") {
        setHistoricalPrices(data.prices || {});
        setHistoricalDate(data.date);
      }
    } catch (err) {
      console.error("Failed to fetch historical prices:", err);
    } finally {
      setHistLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchPrices(); fetchAvailableDates(); }, [fetchPrices, fetchAvailableDates]);

  useEffect(() => {
    if (dateMode === "historical" && selectedDate) {
      fetchHistoricalPrices(selectedDate);
    }
  }, [dateMode, selectedDate, fetchHistoricalPrices]);

  // Active prices based on mode
  const activePrices = dateMode === "historical" ? historicalPrices : livePrices;
  const activeDate = dateMode === "historical" ? historicalDate : liveDate;
  const isLoadingPrice = dateMode === "historical" ? histLoading : loading;

  // Price per gram
  const pricePerGram = useMemo(() => {
    if (isGold) {
      const price24K = activePrices["XAU_24K"];
      if (!price24K) return null;
      const purInfo = GOLD_PURITIES.find((p) => p.value === purity);
      return price24K * (purInfo?.multiplier || 1);
    }
    return activePrices[metal] || null;
  }, [metal, purity, isGold, activePrices]);

  // Weight in grams
  const weightInGrams = useMemo(() => {
    const w = parseFloat(weight);
    if (!w || w <= 0) return 0;
    const unit = WEIGHT_UNITS.find((u) => u.value === weightUnit);
    return w * (unit?.toGrams || 1);
  }, [weight, weightUnit]);

  // Calculate breakdown
  const calculation = useMemo(() => {
    const p = parseInt(pieces) || 1;
    if (!weightInGrams || !pricePerGram) return null;

    const totalWeight = weightInGrams * p;
    const metalValue = pricePerGram * totalWeight;

    // Wastage
    const wastage = parseFloat(wastagePercent) || 0;
    const wastageAmt = metalValue * (wastage / 100);

    // Making charge
    const making = parseFloat(makingCharge) || 0;
    const makingChargeAmt = makingType === "percent"
      ? (metalValue + wastageAmt) * (making / 100)
      : making * totalWeight; // flat per gram

    // Subtotal before GST
    const subtotal = metalValue + wastageAmt + makingChargeAmt;

    // GST
    const gst = parseFloat(gstPercent) || 0;
    const gstAmt = subtotal * (gst / 100);

    // Discount
    const disc = parseFloat(discount) || 0;
    const finalPrice = subtotal + gstAmt - disc;

    return {
      totalWeight: parseFloat(totalWeight.toFixed(3)),
      metalValue: parseFloat(metalValue.toFixed(2)),
      wastageAmt: parseFloat(wastageAmt.toFixed(2)),
      makingChargeAmt: parseFloat(makingChargeAmt.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmt: parseFloat(gstAmt.toFixed(2)),
      discount: disc,
      finalPrice: parseFloat(Math.max(0, finalPrice).toFixed(2)),
      pricePerPiece: p > 1 ? parseFloat((Math.max(0, finalPrice) / p).toFixed(2)) : null,
    };
  }, [weightInGrams, pricePerGram, makingCharge, makingType, gstPercent, wastagePercent, discount, pieces]);

  // Live vs historical comparison
  const comparison = useMemo(() => {
    if (dateMode !== "historical" || !calculation) return null;
    const livePPG = isGold
      ? (livePrices["XAU_24K"] || 0) * (GOLD_PURITIES.find(p => p.value === purity)?.multiplier || 1)
      : (livePrices[metal] || 0);
    if (!livePPG) return null;

    const p = parseInt(pieces) || 1;
    const totalWeight = weightInGrams * p;
    const liveMetalValue = livePPG * totalWeight;
    const diff = liveMetalValue - calculation.metalValue;
    const pctChange = calculation.metalValue ? ((diff / calculation.metalValue) * 100) : 0;

    return {
      livePrice: livePPG,
      livePriceDate: liveDate,
      diff: parseFloat(diff.toFixed(2)),
      pctChange: parseFloat(pctChange.toFixed(2)),
    };
  }, [dateMode, calculation, livePrices, liveDate, isGold, purity, metal, pieces, weightInGrams]);

  const handleReset = () => {
    setWeight("");
    setWeightUnit("g");
    setMakingCharge("8");
    setMakingType("percent");
    setGstPercent("3");
    setWastagePercent("0");
    setDiscount("0");
    setPieces("1");
  };

  const content = (
    <div className="al-calc">
      <div className="al-calc__header">
        <div className="al-calc__title-row">
          <svg className="al-calc__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <div>
            <h2 className="al-calc__title">Jewellery Price Calculator</h2>
            <p className="al-calc__subtitle">Advanced pricing with live &amp; historical rates</p>
          </div>
        </div>
        {!embedded && <button className="al-calc__close" aria-label="Close" onClick={onClose}>&times;</button>}
      </div>

      {/* Date Mode Toggle */}
      <div className="al-calc__mode-toggle">
        <button
          className={`al-calc__mode-btn${dateMode === "live" ? " al-calc__mode-btn--active" : ""}`}
          onClick={() => setDateMode("live")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42"/></svg>
          Live Prices
        </button>
        <button
          className={`al-calc__mode-btn${dateMode === "historical" ? " al-calc__mode-btn--active" : ""}`}
          onClick={() => setDateMode("historical")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Historical Prices
        </button>
      </div>

      {/* Date Picker (historical mode) */}
      {dateMode === "historical" && (
        <div className="al-calc__date-picker">
          <label htmlFor="calc-date">Select Date</label>
          <div className="al-calc__date-row">
            <input
              id="calc-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min={availableDates.length ? availableDates[availableDates.length - 1] : undefined}
              className="al-calc__input"
            />
            {histLoading && <span className="al-calc__date-loading">Loading...</span>}
            {historicalDate && !histLoading && selectedDate && (
              <span className="al-calc__date-resolved">
                Using prices from {fmtDate(historicalDate)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metal & Purity */}
      <div className="al-calc__section">
        <h3 className="al-calc__section-title">Metal Selection</h3>
        <div className="al-calc__grid">
          <div className="al-calc__field">
            <label htmlFor="calc-metal">Metal</label>
            <select id="calc-metal" value={metal} onChange={(e) => setMetal(e.target.value)} className="al-calc__select">
              {METALS.map((m) => (
                <option key={m.symbol} value={m.symbol}>{m.name}</option>
              ))}
            </select>
          </div>
          {isGold && (
            <div className="al-calc__field">
              <label htmlFor="calc-purity">Purity</label>
              <select id="calc-purity" value={purity} onChange={(e) => setPurity(e.target.value)} className="al-calc__select">
                {GOLD_PURITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Weight & Quantity */}
      <div className="al-calc__section">
        <h3 className="al-calc__section-title">Weight &amp; Quantity</h3>
        <div className="al-calc__grid al-calc__grid--3">
          <div className="al-calc__field">
            <label htmlFor="calc-weight">Weight</label>
            <input
              id="calc-weight"
              type="number"
              placeholder="e.g. 10"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min="0.01"
              step="0.01"
              className="al-calc__input"
            />
          </div>
          <div className="al-calc__field">
            <label htmlFor="calc-unit">Unit</label>
            <select id="calc-unit" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} className="al-calc__select">
              {WEIGHT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <div className="al-calc__field">
            <label htmlFor="calc-pieces">Pieces</label>
            <input
              id="calc-pieces"
              type="number"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              min="1"
              step="1"
              className="al-calc__input"
            />
          </div>
        </div>
        {weightUnit !== "g" && weightInGrams > 0 && (
          <p className="al-calc__conversion">= {weightInGrams.toFixed(3)} grams per piece</p>
        )}
      </div>

      {/* Charges */}
      <div className="al-calc__section">
        <h3 className="al-calc__section-title">Charges &amp; Taxes</h3>
        <div className="al-calc__grid">
          <div className="al-calc__field">
            <label htmlFor="calc-making">Making Charges</label>
            <div className="al-calc__input-group">
              <input
                id="calc-making"
                type="number"
                value={makingCharge}
                onChange={(e) => setMakingCharge(e.target.value)}
                min="0"
                step="0.5"
                className="al-calc__input"
              />
              <select value={makingType} onChange={(e) => setMakingType(e.target.value)} className="al-calc__select al-calc__select--sm">
                <option value="percent">%</option>
                <option value="flat">₹/g</option>
              </select>
            </div>
          </div>
          <div className="al-calc__field">
            <label htmlFor="calc-wastage">Wastage (%)</label>
            <input
              id="calc-wastage"
              type="number"
              value={wastagePercent}
              onChange={(e) => setWastagePercent(e.target.value)}
              min="0"
              step="0.5"
              className="al-calc__input"
            />
          </div>
          <div className="al-calc__field">
            <label htmlFor="calc-gst">GST (%)</label>
            <input
              id="calc-gst"
              type="number"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
              min="0"
              step="0.5"
              className="al-calc__input"
            />
          </div>
          <div className="al-calc__field">
            <label htmlFor="calc-discount">Discount (₹)</label>
            <input
              id="calc-discount"
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              min="0"
              step="100"
              className="al-calc__input"
            />
          </div>
        </div>
      </div>

      {/* Live Price Info */}
      <div className="al-calc__price-info">
        {isLoadingPrice ? (
          <span className="al-calc__price-loading">Loading prices...</span>
        ) : pricePerGram ? (
          <div className="al-calc__price-row">
            <span className="al-calc__price-label">
              {dateMode === "historical" ? "Historical" : "Live"} {selectedMetal?.name}{isGold ? ` ${purity}K` : ""} rate
            </span>
            <span className="al-calc__price-value">{fmt(pricePerGram)}/g</span>
            {activeDate && <span className="al-calc__price-date">{fmtDate(activeDate)}</span>}
          </div>
        ) : (
          <span className="al-calc__price-na">Price not available for selected metal{dateMode === "historical" ? " on this date" : ""}</span>
        )}
      </div>

      {/* Result Card */}
      {calculation && (
        <div className="al-calc__result">
          <div className="al-calc__result-header">
            <h3>Price Breakdown</h3>
            <button className="al-calc__reset-btn" onClick={handleReset} title="Reset">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
              Reset
            </button>
          </div>
          <div className="al-calc__breakdown">
            {parseInt(pieces) > 1 && (
              <div className="al-calc__line al-calc__line--meta">
                <span>Total Weight ({pieces} &times; {weight}{weightUnit})</span>
                <span>{calculation.totalWeight}g</span>
              </div>
            )}
            <div className="al-calc__line">
              <span>Metal Value ({calculation.totalWeight}g &times; {fmt(pricePerGram)}/g)</span>
              <span>{fmt(calculation.metalValue)}</span>
            </div>
            {calculation.wastageAmt > 0 && (
              <div className="al-calc__line">
                <span>Wastage ({wastagePercent}%)</span>
                <span>{fmt(calculation.wastageAmt)}</span>
              </div>
            )}
            <div className="al-calc__line">
              <span>Making Charges ({makingCharge}{makingType === "percent" ? "%" : " ₹/g"})</span>
              <span>{fmt(calculation.makingChargeAmt)}</span>
            </div>
            <div className="al-calc__line al-calc__line--sub">
              <span>Subtotal</span>
              <span>{fmt(calculation.subtotal)}</span>
            </div>
            <div className="al-calc__line">
              <span>GST ({gstPercent}%)</span>
              <span>{fmt(calculation.gstAmt)}</span>
            </div>
            {calculation.discount > 0 && (
              <div className="al-calc__line al-calc__line--discount">
                <span>Discount</span>
                <span>&minus;{fmt(calculation.discount)}</span>
              </div>
            )}
            <div className="al-calc__divider" />
            <div className="al-calc__line al-calc__line--total">
              <span>Final Price</span>
              <span>{fmt(calculation.finalPrice)}</span>
            </div>
            {calculation.pricePerPiece && (
              <div className="al-calc__line al-calc__line--per-piece">
                <span>Per Piece ({pieces} pieces)</span>
                <span>{fmt(calculation.pricePerPiece)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical Comparison */}
      {comparison && calculation && (
        <div className={`al-calc__comparison${comparison.diff >= 0 ? " al-calc__comparison--up" : " al-calc__comparison--down"}`}>
          <h4>Price Comparison</h4>
          <div className="al-calc__comp-grid">
            <div className="al-calc__comp-item">
              <span className="al-calc__comp-label">{fmtDate(historicalDate)} rate</span>
              <span className="al-calc__comp-value">{fmt(pricePerGram)}/g</span>
            </div>
            <div className="al-calc__comp-item">
              <span className="al-calc__comp-label">Today&apos;s rate ({fmtDate(comparison.livePriceDate)})</span>
              <span className="al-calc__comp-value">{fmt(comparison.livePrice)}/g</span>
            </div>
            <div className="al-calc__comp-item al-calc__comp-item--highlight">
              <span className="al-calc__comp-label">Difference</span>
              <span className={`al-calc__comp-diff${comparison.diff >= 0 ? " al-calc__comp-diff--up" : " al-calc__comp-diff--down"}`}>
                {comparison.diff >= 0 ? "+" : ""}{fmt(comparison.diff)} ({comparison.diff >= 0 ? "+" : ""}{comparison.pctChange}%)
              </span>
            </div>
          </div>
          <p className="al-calc__comp-note">
            {comparison.diff >= 0
              ? `Metal value has increased by ${comparison.pctChange}% since ${fmtDate(historicalDate)}`
              : `Metal value has decreased by ${Math.abs(comparison.pctChange)}% since ${fmtDate(historicalDate)}`
            }
          </p>
        </div>
      )}

      {/* Info note */}
      <div className="al-calc__note">
        <strong>Note:</strong> Prices are fetched from our database and may differ from shop prices. Making charges, wastage, and discounts vary by jeweller.
      </div>
    </div>
  );

  if (embedded) {
    return <div className="al-calc__embedded">{content}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content jewellery-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
