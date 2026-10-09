// Universal Tenant Configuration Object
const TENANT_CONFIG = {
  shopName: "Aerus Home Wellness",          // Universal: Dynamic per subscriber (Tenant #001)
  techName: "William",
  taxRate: 0.06,                            // Dynamic tax engine (MD 6%)
  currency: "USD",
  categories: ["Vacuum", "Water Systems", "Air Purification", "Supplies"],
  suppliers: ["FOAS", "Desco", "Amazon Direct", "OEM Wholesale"],
  stages: [
    "1. 🚗 Field Pickups / Vehicle",
    "2. 📥 Counter Intake / Showroom",
    "3. 🛠️ Tech Workbench (Active Queue)",
    "4. 🛒 Parts Staging / Ordered",
    "5. 🔩 Parts In Shop — Ready for Bench",
    "6. 🔧 Ready Wall / Completed",
    "7. 📦 Archive — Paid & Delivered"
  ]
};
