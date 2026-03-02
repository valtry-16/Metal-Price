// Always use production backend URL
export const PROD_API_URL =
  import.meta.env.VITE_API_BASE_URL || "https://metal-price.onrender.com";

export const IS_DEV = import.meta.env?.DEV === true;

export const goldCarats = [
  { label: "18 Carat", value: "18", purity: 0.75 },
  { label: "22 Carat (Primary)", value: "22", purity: 0.916, highlight: true },
  { label: "24 Carat", value: "24", purity: 1 },
];

export const metalLabelMap = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
  XCU: "Copper",
  NI: "Nickel",
  ZNC: "Zinc",
  ALU: "Aluminium",
  LEAD: "Lead",
};

export const metalThemes = {
  XAU: { primary: "#B8860B", secondary: "#FFD700", light: "rgba(184,134,11,0.12)", name: "Gold" },
  XAG: { primary: "#6B7280", secondary: "#A0AEC0", light: "rgba(107,114,128,0.12)", name: "Silver" },
  XPT: { primary: "#5B5B5B", secondary: "#8B8B8B", light: "rgba(91,91,91,0.12)", name: "Platinum" },
  XPD: { primary: "#7B8B7A", secondary: "#A8B8A7", light: "rgba(123,139,122,0.12)", name: "Palladium" },
  XCU: { primary: "#B87333", secondary: "#E89B6B", light: "rgba(184,115,51,0.12)", name: "Copper" },
  NI:  { primary: "#8C92AC", secondary: "#B8BFD8", light: "rgba(140,146,172,0.12)", name: "Nickel" },
  ZNC: { primary: "#6C7A89", secondary: "#95A5A6", light: "rgba(108,122,137,0.12)", name: "Zinc" },
  ALU: { primary: "#848482", secondary: "#B5B5B3", light: "rgba(132,132,130,0.12)", name: "Aluminium" },
  LEAD:{ primary: "#5F6A6A", secondary: "#85929E", light: "rgba(95,106,106,0.12)", name: "Lead" },
};

export const METAL_ORDER = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];
