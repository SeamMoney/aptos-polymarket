// Real Polymarket price data - parsed from CSV
// Date range: Sep 30, 2025 - Jan 10, 2026

export interface RealPricePoint {
  timestamp: number;
  prices: Record<string, number>;
}

// Khamenei Iran Market - Real price data from Polymarket CSV export
// Market: "When will Khamenei die?" with date-based outcomes
// Date range: Nov 4, 2025 - Jan 11, 2026
export const KHAMENEI_PRICE_HISTORY: RealPricePoint[] = [
  { timestamp: 1762214410, prices: { "Jan 31": 0.345, "Mar 31": 0.18, "Jun 30": 0.15, "Dec 31": 0.12 } },
  { timestamp: 1762300808, prices: { "Jan 31": 0.35, "Mar 31": 0.18, "Jun 30": 0.15, "Dec 31": 0.12 } },
  { timestamp: 1762387206, prices: { "Jan 31": 0.355, "Mar 31": 0.18, "Jun 30": 0.15, "Dec 31": 0.12 } },
  { timestamp: 1762473609, prices: { "Jan 31": 0.35, "Mar 31": 0.18, "Jun 30": 0.15, "Dec 31": 0.12 } },
  { timestamp: 1762560008, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.12 } },
  { timestamp: 1762646422, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.13 } },
  { timestamp: 1762732807, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.13 } },
  { timestamp: 1762819211, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.13 } },
  { timestamp: 1762905611, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.13 } },
  { timestamp: 1762992009, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.13 } },
  { timestamp: 1763078409, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763164810, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763251208, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763337609, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763424008, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763510411, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763596808, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763683211, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763769609, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763856009, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1763942411, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1764028810, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1764115210, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1764201611, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1764288011, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764374413, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764460811, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764547211, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764633608, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764720012, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764806410, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764892810, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1764979211, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1765065623, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1765152022, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1765238420, prices: { "Jan 31": 0.33, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1765324810, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1765411210, prices: { "Jan 31": 0.325, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1765497610, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1765584011, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1765670411, prices: { "Jan 31": 0.32, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1765756811, prices: { "Jan 31": 0.315, "Mar 31": 0.19, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1765843209, prices: { "Jan 31": 0.305, "Mar 31": 0.20, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1765929607, prices: { "Jan 31": 0.305, "Mar 31": 0.20, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1766016020, prices: { "Jan 31": 0.305, "Mar 31": 0.20, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1766102411, prices: { "Jan 31": 0.31, "Mar 31": 0.20, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1766188810, prices: { "Jan 31": 0.31, "Mar 31": 0.20, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1766275210, prices: { "Jan 31": 0.32, "Mar 31": 0.20, "Jun 30": 0.16, "Dec 31": 0.14 } },
  { timestamp: 1766361610, prices: { "Jan 31": 0.325, "Mar 31": 0.20, "Jun 30": 0.15, "Dec 31": 0.14 } },
  { timestamp: 1766448011, prices: { "Jan 31": 0.34, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1766534411, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1766620821, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1766707209, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1766793612, prices: { "Jan 31": 0.335, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1766880012, prices: { "Jan 31": 0.34, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1766966428, prices: { "Jan 31": 0.34, "Mar 31": 0.19, "Jun 30": 0.15, "Dec 31": 0.13 } },
  { timestamp: 1767052815, prices: { "Jan 31": 0.36, "Mar 31": 0.18, "Jun 30": 0.14, "Dec 31": 0.12 } },
  { timestamp: 1767139211, prices: { "Jan 31": 0.39, "Mar 31": 0.17, "Jun 30": 0.13, "Dec 31": 0.11 } },
  { timestamp: 1767225611, prices: { "Jan 31": 0.375, "Mar 31": 0.17, "Jun 30": 0.14, "Dec 31": 0.12 } },
  { timestamp: 1767312011, prices: { "Jan 31": 0.365, "Mar 31": 0.18, "Jun 30": 0.14, "Dec 31": 0.12 } },
  { timestamp: 1767398411, prices: { "Jan 31": 0.355, "Mar 31": 0.18, "Jun 30": 0.14, "Dec 31": 0.12 } },
  { timestamp: 1767484812, prices: { "Jan 31": 0.385, "Mar 31": 0.17, "Jun 30": 0.13, "Dec 31": 0.11 } },
  { timestamp: 1767571213, prices: { "Jan 31": 0.45, "Mar 31": 0.15, "Jun 30": 0.12, "Dec 31": 0.10 } },
  { timestamp: 1767657615, prices: { "Jan 31": 0.44, "Mar 31": 0.15, "Jun 30": 0.12, "Dec 31": 0.10 } },
  { timestamp: 1767744012, prices: { "Jan 31": 0.49, "Mar 31": 0.14, "Jun 30": 0.11, "Dec 31": 0.09 } },
  { timestamp: 1767830428, prices: { "Jan 31": 0.475, "Mar 31": 0.14, "Jun 30": 0.11, "Dec 31": 0.09 } },
  { timestamp: 1767916813, prices: { "Jan 31": 0.575, "Mar 31": 0.12, "Jun 30": 0.09, "Dec 31": 0.07 } },
  { timestamp: 1768003213, prices: { "Jan 31": 0.605, "Mar 31": 0.11, "Jun 30": 0.08, "Dec 31": 0.06 } },
  { timestamp: 1768089612, prices: { "Jan 31": 0.615, "Mar 31": 0.11, "Jun 30": 0.08, "Dec 31": 0.06 } },
];

// Parse CSV and export data
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
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759467602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.071,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759503603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0705,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759539602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0725,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759575602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0715,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1759611602,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1759647602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.033,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1759683602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1759719602,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.032,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759755602,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759791603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759827602,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759863603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1759899602,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1759935603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.032,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1759971603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1760007602,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1760043603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1760079603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1760115603,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.031,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0205
    }
  },
  {
    "timestamp": 1760151604,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.045,
      "Ron DeSantis": 0.031,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1760187602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.069,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.031,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1760223602,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.032,
      "Tucker Carlson": 0.035,
      "Donald Trump Jr.": 0.02
    }
  },
  {
    "timestamp": 1760259603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0655,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1760295603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.034,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1760331603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.0315,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.0205
    }
  },
  {
    "timestamp": 1760367602,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.045,
      "Ron DeSantis": 0.031,
      "Tucker Carlson": 0.035,
      "Donald Trump Jr.": 0.021
    }
  },
  {
    "timestamp": 1760403603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0635,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1760439603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0635,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.021
    }
  },
  {
    "timestamp": 1760475603,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.0635,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1760511603,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.064,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1760547605,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0635,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1760583603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0625,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.0155
    }
  },
  {
    "timestamp": 1760619604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0635,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0145
    }
  },
  {
    "timestamp": 1760655604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.062,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1760691603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.062,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0275,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1760727603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0735,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.028,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1760763603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.075,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1760799603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.077,
      "Donald Trump": 0.0425,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.03,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1760835604,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.0725,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.027,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1760871603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.073,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.0325,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1760907605,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0725,
      "Donald Trump": 0.0455,
      "Ron DeSantis": 0.0275,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1760943603,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.0645,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1760979604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0635,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.0105
    }
  },
  {
    "timestamp": 1761015604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0705,
      "Donald Trump": 0.0445,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.038,
      "Donald Trump Jr.": 0.0155
    }
  },
  {
    "timestamp": 1761051603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.069,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.0275,
      "Tucker Carlson": 0.0365,
      "Donald Trump Jr.": 0.011
    }
  },
  {
    "timestamp": 1761087603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0365,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1761123603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.066,
      "Donald Trump": 0.0445,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0395,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1761159604,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.0265,
      "Tucker Carlson": 0.0365,
      "Donald Trump Jr.": 0.0265
    }
  },
  {
    "timestamp": 1761195603,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.041,
      "Ron DeSantis": 0.031,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1761231603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0375,
      "Ron DeSantis": 0.03,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0245
    }
  },
  {
    "timestamp": 1761267604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.0395,
      "Ron DeSantis": 0.03,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1761303604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0445,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.034,
      "Donald Trump Jr.": 0.021
    }
  },
  {
    "timestamp": 1761339605,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.068,
      "Donald Trump": 0.0535,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1761375604,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.052,
      "Ron DeSantis": 0.03,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1761411604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.029,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0135
    }
  },
  {
    "timestamp": 1761447603,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.0535,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.033,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1761483604,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.054,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.033,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1761519603,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.0545,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1761555604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.033,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1761591604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.0505,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1761627604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.0505,
      "Ron DeSantis": 0.025,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1761663604,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.067,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.025,
      "Tucker Carlson": 0.03,
      "Donald Trump Jr.": 0.011
    }
  },
  {
    "timestamp": 1761699605,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.025,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1761746404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.023,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1761782404,
    "prices": {
      "J.D. Vance": 0.575,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.053,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.0135
    }
  },
  {
    "timestamp": 1761818404,
    "prices": {
      "J.D. Vance": 0.575,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.049,
      "Ron DeSantis": 0.0265,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0145
    }
  },
  {
    "timestamp": 1761854404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0655,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0135
    }
  },
  {
    "timestamp": 1761890405,
    "prices": {
      "J.D. Vance": 0.59,
      "Marco Rubio": 0.0665,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1761926405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0675,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1761962404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.073,
      "Donald Trump": 0.0405,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1761998405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.073,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.031,
      "Tucker Carlson": 0.028,
      "Donald Trump Jr.": 0.0155
    }
  },
  {
    "timestamp": 1762034405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.072,
      "Donald Trump": 0.0395,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1762070404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.072,
      "Donald Trump": 0.0395,
      "Ron DeSantis": 0.03,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0135
    }
  },
  {
    "timestamp": 1762106405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0715,
      "Donald Trump": 0.0395,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0135
    }
  },
  {
    "timestamp": 1762142404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0805,
      "Donald Trump": 0.0385,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1762178404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0805,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.03,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.013
    }
  },
  {
    "timestamp": 1762214404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.083,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.0275,
      "Tucker Carlson": 0.026,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1762250404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.085,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.0255,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1762286404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.088,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.026,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1762322405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0785,
      "Donald Trump": 0.0535,
      "Ron DeSantis": 0.03,
      "Tucker Carlson": 0.0255,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1762358404,
    "prices": {
      "J.D. Vance": 0.59,
      "Marco Rubio": 0.086,
      "Donald Trump": 0.054,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.025,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1762394404,
    "prices": {
      "J.D. Vance": 0.59,
      "Marco Rubio": 0.0865,
      "Donald Trump": 0.054,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1762430404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.0865,
      "Donald Trump": 0.052,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1762466404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.087,
      "Donald Trump": 0.0535,
      "Ron DeSantis": 0.0275,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1762502404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.0505,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1762538407,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.082,
      "Donald Trump": 0.0495,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1762574405,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.081,
      "Donald Trump": 0.0495,
      "Ron DeSantis": 0.0265,
      "Tucker Carlson": 0.034,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1762610405,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.081,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.011
    }
  },
  {
    "timestamp": 1762646417,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0785,
      "Donald Trump": 0.0445,
      "Ron DeSantis": 0.0245,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0105
    }
  },
  {
    "timestamp": 1762682404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.078,
      "Donald Trump": 0.0345,
      "Ron DeSantis": 0.0215,
      "Tucker Carlson": 0.033,
      "Donald Trump Jr.": 0.0105
    }
  },
  {
    "timestamp": 1762718404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.0345,
      "Ron DeSantis": 0.0225,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0105
    }
  },
  {
    "timestamp": 1762754404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.078,
      "Donald Trump": 0.037,
      "Ron DeSantis": 0.0245,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0105
    }
  },
  {
    "timestamp": 1762790406,
    "prices": {
      "J.D. Vance": 0.59,
      "Marco Rubio": 0.0765,
      "Donald Trump": 0.0395,
      "Ron DeSantis": 0.0225,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0105
    }
  },
  {
    "timestamp": 1762826406,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.078,
      "Donald Trump": 0.04,
      "Ron DeSantis": 0.0235,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0095
    }
  },
  {
    "timestamp": 1762862419,
    "prices": {
      "J.D. Vance": 0.59,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.0395,
      "Ron DeSantis": 0.024,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.01
    }
  },
  {
    "timestamp": 1762898405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.078,
      "Donald Trump": 0.0375,
      "Ron DeSantis": 0.024,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1762934404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.0385,
      "Ron DeSantis": 0.024,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.011
    }
  },
  {
    "timestamp": 1762970404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.0795,
      "Donald Trump": 0.0415,
      "Ron DeSantis": 0.0235,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1763006404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.0795,
      "Donald Trump": 0.0365,
      "Ron DeSantis": 0.0205,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.011
    }
  },
  {
    "timestamp": 1763042404,
    "prices": {
      "J.D. Vance": 0.595,
      "Marco Rubio": 0.074,
      "Donald Trump": 0.036,
      "Ron DeSantis": 0.02,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1763078405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.074,
      "Donald Trump": 0.042,
      "Ron DeSantis": 0.02,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0125
    }
  },
  {
    "timestamp": 1763114404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0735,
      "Donald Trump": 0.0345,
      "Ron DeSantis": 0.0225,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1763150406,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.077,
      "Donald Trump": 0.0335,
      "Ron DeSantis": 0.022,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0115
    }
  },
  {
    "timestamp": 1763186405,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0695,
      "Donald Trump": 0.0325,
      "Ron DeSantis": 0.022,
      "Tucker Carlson": 0.033,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1763222404,
    "prices": {
      "J.D. Vance": 0.585,
      "Marco Rubio": 0.0685,
      "Donald Trump": 0.0325,
      "Ron DeSantis": 0.023,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1763258405,
    "prices": {
      "J.D. Vance": 0.575,
      "Marco Rubio": 0.0755,
      "Donald Trump": 0.0325,
      "Ron DeSantis": 0.0235,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.012
    }
  },
  {
    "timestamp": 1763294404,
    "prices": {
      "J.D. Vance": 0.575,
      "Marco Rubio": 0.076,
      "Donald Trump": 0.0325,
      "Ron DeSantis": 0.0225,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.014
    }
  },
  {
    "timestamp": 1763330404,
    "prices": {
      "J.D. Vance": 0.565,
      "Marco Rubio": 0.078,
      "Donald Trump": 0.0325,
      "Ron DeSantis": 0.0225,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1763366419,
    "prices": {
      "J.D. Vance": 0.565,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.0345,
      "Ron DeSantis": 0.023,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1763402405,
    "prices": {
      "J.D. Vance": 0.56,
      "Marco Rubio": 0.0765,
      "Donald Trump": 0.0355,
      "Ron DeSantis": 0.023,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1763438404,
    "prices": {
      "J.D. Vance": 0.56,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.034,
      "Ron DeSantis": 0.0265,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.024
    }
  },
  {
    "timestamp": 1763474404,
    "prices": {
      "J.D. Vance": 0.565,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.034,
      "Ron DeSantis": 0.0265,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1763510405,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0755,
      "Donald Trump": 0.0325,
      "Ron DeSantis": 0.025,
      "Tucker Carlson": 0.03,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1763546405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0795,
      "Donald Trump": 0.033,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.027,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1763582405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0755,
      "Donald Trump": 0.0305,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1763618404,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0755,
      "Donald Trump": 0.0305,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.016
    }
  },
  {
    "timestamp": 1763654405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0815,
      "Donald Trump": 0.0335,
      "Ron DeSantis": 0.0275,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1763690405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.081,
      "Donald Trump": 0.032,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.016
    }
  },
  {
    "timestamp": 1763726405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0815,
      "Donald Trump": 0.0345,
      "Ron DeSantis": 0.029,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.016
    }
  },
  {
    "timestamp": 1763762405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.081,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.017
    }
  },
  {
    "timestamp": 1763798405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.085,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.029,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0155
    }
  },
  {
    "timestamp": 1763834405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.083,
      "Donald Trump": 0.046,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.016
    }
  },
  {
    "timestamp": 1763870405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0835,
      "Donald Trump": 0.0495,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1763906405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.0295,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0145
    }
  },
  {
    "timestamp": 1763942408,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0815,
      "Donald Trump": 0.049,
      "Ron DeSantis": 0.028,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.015
    }
  },
  {
    "timestamp": 1763978404,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.082,
      "Donald Trump": 0.0445,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.0145
    }
  },
  {
    "timestamp": 1764014406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0835,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764050405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.079,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.014
    }
  },
  {
    "timestamp": 1764086405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.08,
      "Donald Trump": 0.0505,
      "Ron DeSantis": 0.029,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0145
    }
  },
  {
    "timestamp": 1764122405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0805,
      "Donald Trump": 0.0505,
      "Ron DeSantis": 0.029,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.014
    }
  },
  {
    "timestamp": 1764158419,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0805,
      "Donald Trump": 0.0505,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.016
    }
  },
  {
    "timestamp": 1764194405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0815,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764230405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.081,
      "Donald Trump": 0.054,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764266406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.052,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764302405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.025,
      "Tucker Carlson": 0.034,
      "Donald Trump Jr.": 0.016
    }
  },
  {
    "timestamp": 1764338406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0765,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764374406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0765,
      "Donald Trump": 0.0545,
      "Ron DeSantis": 0.0255,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.017
    }
  },
  {
    "timestamp": 1764410420,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.0555,
      "Ron DeSantis": 0.026,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764446406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.079,
      "Donald Trump": 0.055,
      "Ron DeSantis": 0.0265,
      "Tucker Carlson": 0.036,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1764482405,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0775,
      "Donald Trump": 0.0585,
      "Ron DeSantis": 0.027,
      "Tucker Carlson": 0.0355,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1764518418,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0785,
      "Donald Trump": 0.0565,
      "Ron DeSantis": 0.0285,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1764554405,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.077,
      "Donald Trump": 0.059,
      "Ron DeSantis": 0.0305,
      "Tucker Carlson": 0.034,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1764590415,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.0715,
      "Donald Trump": 0.061,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.035,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764626405,
    "prices": {
      "J.D. Vance": 0.555,
      "Marco Rubio": 0.077,
      "Donald Trump": 0.0605,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0165
    }
  },
  {
    "timestamp": 1764662405,
    "prices": {
      "J.D. Vance": 0.55,
      "Marco Rubio": 0.0765,
      "Donald Trump": 0.0615,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.035,
      "Donald Trump Jr.": 0.0205
    }
  },
  {
    "timestamp": 1764698406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0735,
      "Donald Trump": 0.0625,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.033,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1764734406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.076,
      "Donald Trump": 0.0645,
      "Ron DeSantis": 0.037,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1764770407,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0755,
      "Donald Trump": 0.064,
      "Ron DeSantis": 0.0375,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1764806406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0745,
      "Donald Trump": 0.0625,
      "Ron DeSantis": 0.0355,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1764842405,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.073,
      "Donald Trump": 0.061,
      "Ron DeSantis": 0.036,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1764878405,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.073,
      "Donald Trump": 0.06,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1764914406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.072,
      "Donald Trump": 0.055,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1764950406,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.075,
      "Donald Trump": 0.0545,
      "Ron DeSantis": 0.034,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1764986407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0735,
      "Donald Trump": 0.0525,
      "Ron DeSantis": 0.0345,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1765022408,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0755,
      "Donald Trump": 0.0515,
      "Ron DeSantis": 0.0385,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765058406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.084,
      "Donald Trump": 0.0515,
      "Ron DeSantis": 0.0385,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1765094405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.087,
      "Donald Trump": 0.0525,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765130405,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.0525,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1765166405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0885,
      "Donald Trump": 0.0525,
      "Ron DeSantis": 0.041,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1765202405,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0865,
      "Donald Trump": 0.0525,
      "Ron DeSantis": 0.042,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1765238417,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.053,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1765274406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.086,
      "Donald Trump": 0.052,
      "Ron DeSantis": 0.04,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765310407,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.05,
      "Ron DeSantis": 0.0405,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765346406,
    "prices": {
      "J.D. Vance": 0.545,
      "Marco Rubio": 0.086,
      "Donald Trump": 0.052,
      "Ron DeSantis": 0.041,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765382406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.086,
      "Donald Trump": 0.0515,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1765418418,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765454406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0435,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765490406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0435,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765526405,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.0535,
      "Ron DeSantis": 0.042,
      "Tucker Carlson": 0.0345,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1765562407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0425,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1765598407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.041,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1765634407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.042,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765670406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.042,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765706407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765742406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.035,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765778405,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.0515,
      "Ron DeSantis": 0.04,
      "Tucker Carlson": 0.035,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765814406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.049,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0335,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765850405,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.083,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.032,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1765886417,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.0455,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0325,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1765922406,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.0815,
      "Donald Trump": 0.0455,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1765958418,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.0815,
      "Donald Trump": 0.0455,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1765994406,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.0835,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0175
    }
  },
  {
    "timestamp": 1766030406,
    "prices": {
      "J.D. Vance": 0.515,
      "Marco Rubio": 0.082,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.041,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1766066421,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.0825,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.04,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1766102408,
    "prices": {
      "J.D. Vance": 0.525,
      "Marco Rubio": 0.083,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1766138407,
    "prices": {
      "J.D. Vance": 0.53,
      "Marco Rubio": 0.0835,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.0185
    }
  },
  {
    "timestamp": 1766174406,
    "prices": {
      "J.D. Vance": 0.53,
      "Marco Rubio": 0.084,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.0405,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766210406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.085,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.0415,
      "Tucker Carlson": 0.031,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766246408,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0835,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.0405,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766282406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0845,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766318406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.085,
      "Donald Trump": 0.0455,
      "Ron DeSantis": 0.04,
      "Tucker Carlson": 0.0315,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766354406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.0445,
      "Ron DeSantis": 0.035,
      "Tucker Carlson": 0.0305,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766390419,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.085,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.037,
      "Tucker Carlson": 0.03,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766426406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0855,
      "Donald Trump": 0.0435,
      "Ron DeSantis": 0.0385,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.019
    }
  },
  {
    "timestamp": 1766462419,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0865,
      "Donald Trump": 0.044,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.03,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766498406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.088,
      "Donald Trump": 0.043,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0295,
      "Donald Trump Jr.": 0.0195
    }
  },
  {
    "timestamp": 1766534407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.089,
      "Donald Trump": 0.052,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.018
    }
  },
  {
    "timestamp": 1766570407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.051,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.023
    }
  },
  {
    "timestamp": 1766606407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.087,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0205
    }
  },
  {
    "timestamp": 1766642407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.088,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.0385,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.023
    }
  },
  {
    "timestamp": 1766678406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0885,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.0235
    }
  },
  {
    "timestamp": 1766714406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0885,
      "Donald Trump": 0.0485,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1766750406,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.087,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.027,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1766786407,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0875,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1766822408,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.087,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0215
    }
  },
  {
    "timestamp": 1766858408,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.086,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.0385,
      "Tucker Carlson": 0.0275,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1766898007,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.086,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1766934007,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.088,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.021
    }
  },
  {
    "timestamp": 1766973608,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.0885,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.027,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1767009608,
    "prices": {
      "J.D. Vance": 0.54,
      "Marco Rubio": 0.087,
      "Donald Trump": 0.0475,
      "Ron DeSantis": 0.0425,
      "Tucker Carlson": 0.0265,
      "Donald Trump Jr.": 0.022
    }
  },
  {
    "timestamp": 1767045606,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0865,
      "Donald Trump": 0.047,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.029,
      "Donald Trump Jr.": 0.0225
    }
  },
  {
    "timestamp": 1767081607,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.089,
      "Donald Trump": 0.0465,
      "Ron DeSantis": 0.039,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.024
    }
  },
  {
    "timestamp": 1767117612,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0885,
      "Donald Trump": 0.049,
      "Ron DeSantis": 0.0395,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.024
    }
  },
  {
    "timestamp": 1767153609,
    "prices": {
      "J.D. Vance": 0.535,
      "Marco Rubio": 0.0895,
      "Donald Trump": 0.048,
      "Ron DeSantis": 0.0425,
      "Tucker Carlson": 0.0285,
      "Donald Trump Jr.": 0.0235
    }
  }
];

// Latest real Polymarket prices (updated Jan 10, 2026)
// Used for chart display - real prices from Polymarket for visual accuracy
export const LATEST_REAL_PRICES: Record<string, number> = {
  // GOP 2028 Nominee Market
  "J.D. Vance": 0.54,
  "Marco Rubio": 0.097,
  "Donald Trump": 0.049,
  "Ron DeSantis": 0.041,
  "Tucker Carlson": 0.029,
  "Donald Trump Jr.": 0.025,
  "Ted Cruz": 0.024,
  "Marjorie Taylor Greene": 0.021,
  "Nikki Haley": 0.014,
  "Other": 0.17,

  // Khamenei Iran Market - When will Khamenei die?
  "Jan 31": 0.615,  // Major spike in early Jan 2026
  "Mar 31": 0.11,
  "Jun 30": 0.08,
  "Dec 31": 0.06,

  // Fed Chair Market - Who will Trump nominate?
  "Kevin Warsh": 0.42,
  "Kevin Hassett": 0.28,
  "Jerome Powell": 0.08,
  "Scott Bessent": 0.07,

  // WLFI Banking Charter Market
  "Yes": 0.35,
  "No": 0.65,

  // Trump Greenland Purchase Market
  "Greenland Yes": 0.12,
  "Greenland No": 0.88,

  // China Taiwan Invasion 2026
  "Taiwan Yes": 0.08,
  "Taiwan No": 0.92,

  // Russia-Ukraine Ceasefire 2026
  "Ceasefire Yes": 0.45,
  "Ceasefire No": 0.55,

  // Fed Rate Cut January 2026
  "Rate Cut Yes": 0.05,
  "Rate Cut No": 0.95,

  // BTC Price Markets
  "BTC 150K Yes": 0.32,
  "BTC 150K No": 0.68,
};
