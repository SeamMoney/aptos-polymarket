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
  isNew?: boolean;
  isTrending?: boolean;
  isMultiOutcome?: boolean;
  outcomes?: Outcome[];
  createdAt?: string;
  resolver?: string;
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
