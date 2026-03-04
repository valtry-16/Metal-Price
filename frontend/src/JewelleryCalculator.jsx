import { useEffect, useState, useMemo, useCallback } from "react";

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

const fmt = (n) =>
  n != null
    ? `\u20B9${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "N/A";

export default function JewelleryCalculator({ apiBase, onClose, embedded = false }) {
  const [metal, setMetal] = useState("XAU");
  const [purity, setPurity] = useState("22");
  const [weight, setWeight] = useState("");
  const [makingCharge, setMakingCharge] = useState("8");
  const [gstPercent, setGstPercent] = useState("3");

  const [livePrices, setLivePrices] = useState({});
  const [priceDate, setPriceDate] = useState(null);
  const [loading, setLoading] = useState(true);

  const selectedMetal = METALS.find((m) => m.symbol === metal);
  const isGold = metal === "XAU";

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
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Get price per gram for selected metal/purity
  const pricePerGram = useMemo(() => {
    if (isGold) {
      // For gold, use 24K price and apply purity multiplier
      const price24K = livePrices["XAU_24K"];
      if (!price24K) return null;
      const purInfo = GOLD_PURITIES.find((p) => p.value === purity);
      return price24K * (purInfo?.multiplier || 1);
    }
    return livePrices[metal] || null;
  }, [metal, purity, isGold, livePrices]);

  // Calculate breakdown
  const calculation = useMemo(() => {
    const w = parseFloat(weight);
    const making = parseFloat(makingCharge);
    const gst = parseFloat(gstPercent);

    if (!w || w <= 0 || !pricePerGram) return null;

    const metalValue = pricePerGram * w;
    const makingChargeAmt = metalValue * ((making || 0) / 100);
    const gstAmt = (metalValue + makingChargeAmt) * ((gst || 0) / 100);
    const finalPrice = metalValue + makingChargeAmt + gstAmt;

    return {
      metalValue: parseFloat(metalValue.toFixed(2)),
      makingChargeAmt: parseFloat(makingChargeAmt.toFixed(2)),
      gstAmt: parseFloat(gstAmt.toFixed(2)),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
    };
  }, [weight, makingCharge, gstPercent, pricePerGram]);

  const content = (
    <>
        <div className="modal-header">
          <h2>Jewellery Calculator</h2>
          {!embedded && <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>}
        </div>

        <p className="jewellery-desc">
          Calculate jewellery price using live metal rates with making charges and GST.
        </p>

        {/* Inputs */}
        <div className="jewellery-form">
          <div className="jewellery-row">
            <label htmlFor="calc-metal">Metal</label>
            <select id="calc-metal" value={metal} onChange={(e) => setMetal(e.target.value)} className="jewellery-select">
              {METALS.map((m) => (
                <option key={m.symbol} value={m.symbol}>{m.name}</option>
              ))}
            </select>
          </div>

          {isGold && (
            <div className="jewellery-row">
              <label htmlFor="calc-purity">Purity</label>
              <select id="calc-purity" value={purity} onChange={(e) => setPurity(e.target.value)} className="jewellery-select">
                {GOLD_PURITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="jewellery-row">
            <label htmlFor="calc-weight">Weight (grams)</label>
            <input
              id="calc-weight"
              type="number"
              placeholder="e.g. 10"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min="0.01"
              step="0.01"
              className="jewellery-input"
            />
          </div>

          <div className="jewellery-row">
            <label htmlFor="calc-making">Making Charges (%)</label>
            <input
              id="calc-making"
              type="number"
              placeholder="e.g. 8"
              value={makingCharge}
              onChange={(e) => setMakingCharge(e.target.value)}
              min="0"
              step="0.5"
              className="jewellery-input"
            />
          </div>

          <div className="jewellery-row">
            <label htmlFor="calc-gst">GST (%)</label>
            <input
              id="calc-gst"
              type="number"
              placeholder="e.g. 3"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
              min="0"
              step="0.5"
              className="jewellery-input"
            />
          </div>
        </div>

        {/* Live Price Info */}
        <div className="jewellery-price-info">
          {loading ? (
            <span>Loading live prices...</span>
          ) : pricePerGram ? (
            <span>
              Live {selectedMetal?.name}{isGold ? ` ${purity}K` : ""} rate: <strong>{fmt(pricePerGram)}/g</strong>
              {priceDate && <span className="jewellery-date"> (as of {priceDate})</span>}
            </span>
          ) : (
            <span>Price not available for selected metal</span>
          )}
        </div>

        {/* Result Card */}
        {calculation && (
          <div className="jewellery-result">
            <h3>Price Breakdown</h3>
            <div className="jewellery-breakdown">
              <div className="jewellery-line">
                <span>Metal Value ({weight}g × {fmt(pricePerGram)}/g)</span>
                <span>{fmt(calculation.metalValue)}</span>
              </div>
              <div className="jewellery-line">
                <span>Making Charges ({makingCharge || 0}%)</span>
                <span>{fmt(calculation.makingChargeAmt)}</span>
              </div>
              <div className="jewellery-line">
                <span>GST ({gstPercent || 0}%)</span>
                <span>{fmt(calculation.gstAmt)}</span>
              </div>
              <div className="jewellery-divider" />
              <div className="jewellery-line jewellery-total">
                <span>Final Price</span>
                <span>{fmt(calculation.finalPrice)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="jewellery-note">
          <strong>Note:</strong> This is an estimate based on live metal prices. Actual jewellery prices may vary based on design, brand, and local market conditions.
        </div>
    </>
  );

  if (embedded) {
    return <div className="jewellery-embedded">{content}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content jewellery-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
