// Oracle types: 0=Admin, 1=Pyth, 2=Switchboard, 3=Optimistic
export type OracleType = 'admin' | 'pyth' | 'switchboard' | 'optimistic';

export interface OracleInfo {
  type: OracleType;
  hasConfig: boolean;
  oracleResolved: boolean;
  resolutionPrice: number | null;
}

export interface Market {
  id: string;
  question: string;
  image: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  liquidity: string;
  category: Category;
  endDate: string;
  endTime?: number;
  resolved?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
  isMultiOutcome?: boolean;
  outcomes?: Outcome[];
  createdAt?: string;
  resolver?: string;
  oracleInfo?: OracleInfo;
}

export interface Outcome {
  id: string;
  name: string;
  image?: string;
  price: number;
  volume: string;
  color: string;
}

export type Category =
  | "All"
  | "Breaking"
  | "New"
  | "Politics"
  | "Sports"
  | "Crypto"
  | "Finance"
  | "Business"
  | "Science"
  | "Culture"
  | "World";

export interface Trade {
  type: "yes" | "no";
  price: number;
  amount: number;
  timestamp: Date;
}

export interface OrderBookEntry {
  price: number;
  shares: number;
  total: number;
}

export interface OrderBook {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  lastPrice: number;
  spread: number;
}
