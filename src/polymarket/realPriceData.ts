// Real Polymarket price data - parsed from CSV export
// Interpolated to hourly granularity for smooth charts

export interface RealPricePoint {
  timestamp: number;
  prices: Record<string, number>;
}

// Raw daily data from real Polymarket CSV export
const DAILY_DATA: { timestamp: number; price: number }[] = [
  { timestamp: 1762214410, price: 0.345 },  // 11-04-2025
  { timestamp: 1762300808, price: 0.35 },   // 11-05-2025
  { timestamp: 1762387206, price: 0.355 },  // 11-06-2025
  { timestamp: 1762473609, price: 0.35 },   // 11-07-2025
  { timestamp: 1762560008, price: 0.325 },  // 11-08-2025
  { timestamp: 1762646422, price: 0.32 },   // 11-09-2025
  { timestamp: 1762732807, price: 0.32 },   // 11-10-2025
  { timestamp: 1762819211, price: 0.32 },   // 11-11-2025
  { timestamp: 1762905611, price: 0.32 },   // 11-12-2025
  { timestamp: 1762992009, price: 0.32 },   // 11-13-2025
  { timestamp: 1763078409, price: 0.33 },   // 11-14-2025
  { timestamp: 1763164810, price: 0.33 },   // 11-15-2025
  { timestamp: 1763251208, price: 0.33 },   // 11-16-2025
  { timestamp: 1763337609, price: 0.33 },   // 11-17-2025
  { timestamp: 1763424008, price: 0.325 },  // 11-18-2025
  { timestamp: 1763510411, price: 0.325 },  // 11-19-2025
  { timestamp: 1763596808, price: 0.33 },   // 11-20-2025
  { timestamp: 1763683211, price: 0.325 },  // 11-21-2025
  { timestamp: 1763769609, price: 0.33 },   // 11-22-2025
  { timestamp: 1763856009, price: 0.335 },  // 11-23-2025
  { timestamp: 1763942411, price: 0.335 },  // 11-24-2025
  { timestamp: 1764028810, price: 0.335 },  // 11-25-2025
  { timestamp: 1764115210, price: 0.325 },  // 11-26-2025
  { timestamp: 1764201611, price: 0.325 },  // 11-27-2025
  { timestamp: 1764288011, price: 0.32 },   // 11-28-2025
  { timestamp: 1764374413, price: 0.325 },  // 11-29-2025
  { timestamp: 1764460811, price: 0.325 },  // 11-30-2025
  { timestamp: 1764547211, price: 0.325 },  // 12-01-2025
  { timestamp: 1764633608, price: 0.325 },  // 12-02-2025
  { timestamp: 1764720012, price: 0.325 },  // 12-03-2025
  { timestamp: 1764806410, price: 0.325 },  // 12-04-2025
  { timestamp: 1764892810, price: 0.325 },  // 12-05-2025
  { timestamp: 1764979211, price: 0.325 },  // 12-06-2025
  { timestamp: 1765065623, price: 0.325 },  // 12-07-2025
  { timestamp: 1765152022, price: 0.325 },  // 12-08-2025
  { timestamp: 1765238420, price: 0.33 },   // 12-09-2025
  { timestamp: 1765324810, price: 0.325 },  // 12-10-2025
  { timestamp: 1765411210, price: 0.325 },  // 12-11-2025
  { timestamp: 1765497610, price: 0.32 },   // 12-12-2025
  { timestamp: 1765584011, price: 0.32 },   // 12-13-2025
  { timestamp: 1765670411, price: 0.32 },   // 12-14-2025
  { timestamp: 1765756811, price: 0.315 },  // 12-15-2025
  { timestamp: 1765843209, price: 0.305 },  // 12-16-2025
  { timestamp: 1765929607, price: 0.305 },  // 12-17-2025
  { timestamp: 1766016020, price: 0.305 },  // 12-18-2025
  { timestamp: 1766102411, price: 0.31 },   // 12-19-2025
  { timestamp: 1766188810, price: 0.31 },   // 12-20-2025
  { timestamp: 1766275210, price: 0.32 },   // 12-21-2025
  { timestamp: 1766361610, price: 0.325 },  // 12-22-2025
  { timestamp: 1766448011, price: 0.34 },   // 12-23-2025
  { timestamp: 1766534411, price: 0.335 },  // 12-24-2025
  { timestamp: 1766620821, price: 0.335 },  // 12-25-2025
  { timestamp: 1766707209, price: 0.335 },  // 12-26-2025
  { timestamp: 1766793612, price: 0.335 },  // 12-27-2025
  { timestamp: 1766880012, price: 0.34 },   // 12-28-2025
  { timestamp: 1766966428, price: 0.34 },   // 12-29-2025
  { timestamp: 1767052815, price: 0.36 },   // 12-30-2025
  { timestamp: 1767139211, price: 0.39 },   // 12-31-2025
  { timestamp: 1767225611, price: 0.375 },  // 01-01-2026
  { timestamp: 1767312011, price: 0.365 },  // 01-02-2026
  { timestamp: 1767398411, price: 0.355 },  // 01-03-2026
  { timestamp: 1767484812, price: 0.385 },  // 01-04-2026
  { timestamp: 1767571213, price: 0.45 },   // 01-05-2026
  { timestamp: 1767657615, price: 0.44 },   // 01-06-2026
  { timestamp: 1767744012, price: 0.49 },   // 01-07-2026
  { timestamp: 1767830428, price: 0.475 },  // 01-08-2026
  { timestamp: 1767916813, price: 0.575 },  // 01-09-2026
  { timestamp: 1768003213, price: 0.605 },  // 01-10-2026
  { timestamp: 1768089612, price: 0.59 },   // 01-11-2026
  { timestamp: 1768176014, price: 0.60 },   // 01-12-2026
  { timestamp: 1768262414, price: 0.575 },  // 01-13-2026
  { timestamp: 1768348813, price: 0.615 },  // 01-14-2026
  { timestamp: 1768435215, price: 0.635 },  // 01-15-2026
  { timestamp: 1768521617, price: 0.485 },  // 01-16-2026
  { timestamp: 1768608015, price: 0.49 },   // 01-17-2026
  { timestamp: 1768694419, price: 0.495 },  // 01-18-2026
  { timestamp: 1768780813, price: 0.485 },  // 01-19-2026
  { timestamp: 1768867214, price: 0.51 },   // 01-20-2026
  { timestamp: 1768953615, price: 0.505 },  // 01-21-2026
  { timestamp: 1769040019, price: 0.485 },  // 01-22-2026
  { timestamp: 1769126431, price: 0.495 },  // 01-23-2026
  { timestamp: 1769155751, price: 0.495 },  // 01-23-2026 08:09
];

// Use daily data directly - clean like Polymarket
export const KHAMENEI_PRICE_HISTORY: RealPricePoint[] = DAILY_DATA.map(d => ({
  timestamp: d.timestamp,
  prices: { "Mar 31": d.price }
}));

console.log(`[PriceData] Loaded ${KHAMENEI_PRICE_HISTORY.length} daily data points`);

// Parse CSV and export data for Republican nominee market
export const REAL_PRICE_HISTORY: RealPricePoint[] = [
  {
    "timestamp": 1759215602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.07,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.037,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1759251604,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.071,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.0365,
      "Donald Trump Jr.": 0.021
    }
  },
  {
    "timestamp": 1759287602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.039,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1759323602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1759359603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1759395602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759431602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759467603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759503602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759539603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759575605,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759611606,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759647602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759683602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759719603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759755602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759791602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759827602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759863603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759899602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759935602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759971602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1760007602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1760043602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1760079602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1760115602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1760151602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1760187602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.0375,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1760223602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.0355,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1760259602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.0355,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.02
    }
  }
];

// Latest prices (January 2026)
export const LATEST_REAL_PRICES: Record<string, number> = {
  "J.D. Vance": 0.55,
  "Marco Rubio": 0.068,
  "Donald Trump": 0.043,
  "Ron DeSantis": 0.0355,
  "Tucker Carlson": 0.038,
  "Donald Trump Jr.": 0.02,
  // Khamenei - from real CSV data
  "Mar 31": 0.495,  // Latest from CSV: 49.5%
};
