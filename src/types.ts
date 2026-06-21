export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

export interface Position {
  symbol: string;
  amount: number;
  investedAmount: number;
}

export interface AssetConfig {
  id: string;      // e.g. "btcusdt"
  name: string;    // e.g. "BTC/USDT"
  base: string;    // e.g. "BTC"
  quote: string;   // e.g. "USDT"
  iconColor: string;
  precision: number;
}
