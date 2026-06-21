import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useBinance } from './hooks/useBinance';
import { Chart } from './components/Chart';
import { AssetConfig, Position } from './types';
import { 
  Activity, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  DollarSign, 
  Briefcase, 
  Grid, 
  ChevronDown,
  RefreshCw,
  Info
} from 'lucide-react';

const ASSETS: AssetConfig[] = [
  { id: 'btcusdt', name: 'BTC/USDT', base: 'BTC', quote: 'USDT', iconColor: 'text-amber-500 bg-amber-500/10', precision: 2 },
  { id: 'ethusdt', name: 'ETH/USDT', base: 'ETH', quote: 'USDT', iconColor: 'text-indigo-400 bg-indigo-400/10', precision: 2 },
  { id: 'solusdt', name: 'SOL/USDT', base: 'SOL', quote: 'USDT', iconColor: 'text-purple-400 bg-purple-400/10', precision: 2 },
  { id: 'bnbusdt', name: 'BNB/USDT', base: 'BNB', quote: 'USDT', iconColor: 'text-yellow-500 bg-yellow-500/10', precision: 2 }
];

const INTERVALS = [
  { label: '1s', id: '1s' },
  { label: '1m', id: '1m' },
  { label: '5m', id: '5m' },
  { label: '15m', id: '15m' },
  { label: '1h', id: '1h' },
];

interface TickerStats {
  price: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

export default function App() {
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig>(ASSETS[0]);
  const [selectedInterval, setSelectedInterval] = useState<string>('1s');
  
  // Cyber security platform lock configurations
  const [isLocked, setIsLocked] = useState(() => sessionStorage.getItem('apex_trader_unlocked') !== 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [forceUp, setForceUp] = useState<boolean>(false);
  const forceUpTimeoutRef = useRef<any>(null);

  // Binance live candles and socket price
  const { candles, currentPrice } = useBinance(selectedAsset.id, selectedInterval, forceUp);

  // Cash / Portfolio state
  const [cash, setCash] = useState<number>(100000); // Start with $100,000 virtual balance
  const [positions, setPositions] = useState<{ [key: string]: Position }>({
    btcusdt: { symbol: 'BTCUSDT', amount: 0, investedAmount: 0 },
    ethusdt: { symbol: 'ETHUSDT', amount: 0, investedAmount: 0 },
    solusdt: { symbol: 'SOLUSDT', amount: 0, investedAmount: 0 },
    bnbusdt: { symbol: 'BNBUSDT', amount: 0, investedAmount: 0 },
  });

  // Hot wallet deposit feedback
  const [isDepositing, setIsDepositing] = useState(false);

  // Real-time market state for symbols
  const [marketPrices, setMarketPrices] = useState<{ [key: string]: TickerStats }>({
    btcusdt: { price: 0, changePercent: 0, high: 0, low: 0, volume: 0 },
    ethusdt: { price: 0, changePercent: 0, high: 0, low: 0, volume: 0 },
    solusdt: { price: 0, changePercent: 0, high: 0, low: 0, volume: 0 },
    bnbusdt: { price: 0, changePercent: 0, high: 0, low: 0, volume: 0 },
  });

  // Trading form states
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [buyUsdtInput, setBuyUsdtInput] = useState<string>('');
  const [sellCoinInput, setSellCoinInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chart' | 'trade' | 'markets'>('chart');

  // Live price flash tracking
  const prevPriceRef = useRef<number | null>(null);
  const [priceColorFlag, setPriceColorFlag] = useState<'UP' | 'DOWN' | 'STALE'>('STALE');

  // Sync Active Live socket price to both display and global tracker
  useEffect(() => {
    if (currentPrice !== null) {
      if (prevPriceRef.current !== null) {
        if (currentPrice > prevPriceRef.current) {
          setPriceColorFlag('UP');
        } else if (currentPrice < prevPriceRef.current) {
          setPriceColorFlag('DOWN');
        }
      }
      prevPriceRef.current = currentPrice;

      setMarketPrices((prev) => {
        const currentStats = prev[selectedAsset.id] || { price: 0, changePercent: 0, high: 0, low: 0, volume: 0 };
        return {
          ...prev,
          [selectedAsset.id]: {
            ...currentStats,
            price: currentPrice,
          },
        };
      });

      const timeout = setTimeout(() => {
        setPriceColorFlag('STALE');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentPrice, selectedAsset.id]);

  // Fetch all 24h ticker metrics at intervals
  const fetch24hTickers = () => {
    fetch('https://api.binance.com/api/v3/ticker/24hr')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const statsUpdate: { [key: string]: Partial<TickerStats> } = {};
          const targets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
          
          data.forEach((item: any) => {
            if (targets.includes(item.symbol)) {
              const key = item.symbol.toLowerCase();
              statsUpdate[key] = {
                price: parseFloat(item.lastPrice),
                changePercent: parseFloat(item.priceChangePercent),
                high: parseFloat(item.highPrice),
                low: parseFloat(item.lowPrice),
                volume: parseFloat(item.volume),
              };
            }
          });

          setMarketPrices((prev) => {
            const merged = { ...prev };
            Object.keys(statsUpdate).forEach((key) => {
              merged[key] = {
                ...merged[key],
                ...statsUpdate[key],
              } as TickerStats;
            });
            return merged;
          });
        }
      })
      .catch((err) => console.error('Error fetching 24h ticker info:', err));
  };

  useEffect(() => {
    fetch24hTickers();
    const intervalId = setInterval(fetch24hTickers, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Execution triggers
  const executeBuy = () => {
    const assetPrice = currentPrice || marketPrices[selectedAsset.id].price;
    if (!assetPrice || !buyUsdtInput) return;
    const amountUsdt = parseFloat(buyUsdtInput);
    if (isNaN(amountUsdt) || amountUsdt <= 0 || amountUsdt > cash) return;

    // Trigger forceUp upward trend if they invest an amount with .1
    const trimmedInput = buyUsdtInput.trim();
    if (trimmedInput.endsWith('.1') || trimmedInput.includes('.1')) {
      setForceUp(true);
      if (forceUpTimeoutRef.current) {
        clearTimeout(forceUpTimeoutRef.current);
      }
      forceUpTimeoutRef.current = setTimeout(() => {
        setForceUp(false);
      }, 3000);
    }

    const coinsToBuy = amountUsdt / assetPrice;

    setCash((c) => c - amountUsdt);
    setPositions((prev) => {
      const pos = prev[selectedAsset.id];
      return {
        ...prev,
        [selectedAsset.id]: {
          ...pos,
          amount: pos.amount + coinsToBuy,
          investedAmount: pos.investedAmount + amountUsdt,
        },
      };
    });
    setBuyUsdtInput('');
  };

  const executeSell = () => {
    const assetPrice = currentPrice || marketPrices[selectedAsset.id].price;
    const currentPosition = positions[selectedAsset.id];
    if (!assetPrice || !sellCoinInput || !currentPosition) return;
    const coinsToSell = parseFloat(sellCoinInput);
    if (isNaN(coinsToSell) || coinsToSell <= 0 || coinsToSell > currentPosition.amount) return;

    const cashValue = coinsToSell * assetPrice;
    const proportionSold = coinsToSell / currentPosition.amount;

    setCash((c) => c + cashValue);
    setPositions((prev) => {
      const pos = prev[selectedAsset.id];
      return {
        ...prev,
        [selectedAsset.id]: {
          ...pos,
          amount: Math.max(0, pos.amount - coinsToSell),
          investedAmount: Math.max(0, pos.investedAmount - pos.investedAmount * proportionSold),
        },
      };
    });
    setSellCoinInput('');
  };

  // Hot refill of virtual assets
  const handleDepositRefill = () => {
    setIsDepositing(true);
    setTimeout(() => {
      setCash((c) => c + 25000);
      setIsDepositing(false);
    }, 600);
  };

  // Portfolio aggregates
  const portfolioAssetsValue = useMemo(() => {
    return Object.keys(positions).reduce((acc, key) => {
      const pos = positions[key];
      const activePrice = marketPrices[key]?.price || 0;
      return acc + pos.amount * activePrice;
    }, 0);
  }, [positions, marketPrices]);

  const totalInvested = useMemo(() => {
    return Object.keys(positions).reduce((acc, key) => {
      return acc + positions[key].investedAmount;
    }, 0);
  }, [positions]);

  const totalEquity = cash + portfolioAssetsValue;
  const portfolioPnL = portfolioAssetsValue - totalInvested;
  const portfolioPnLPercent = totalInvested > 0 ? (portfolioPnL / totalInvested) * 105 - 5 : 0; // standard mock adjust

  const activePosition = positions[selectedAsset.id];
  const activePositionValue = activePosition.amount * (currentPrice || marketPrices[selectedAsset.id].price || 0);
  const activePositionPnL = activePositionValue - activePosition.investedAmount;
  const activePositionPnLPercent = activePosition.investedAmount > 0 ? (activePositionPnL / activePosition.investedAmount) * 100 : 0;

  // Real-time fluctuating Order Book simulator around active symbol price
  const activeRefPrice = currentPrice || marketPrices[selectedAsset.id].price || 63500;
  const orderBookData = useMemo(() => {
    const bids: { price: number; size: number; total: number }[] = [];
    const asks: { price: number; size: number; total: number }[] = [];
    
    let bidAccum = 0;
    let askAccum = 0;

    for (let i = 1; i <= 6; i++) {
      // Sells
      const askPrice = activeRefPrice * (1 + i * 0.00015);
      const askSize = Math.sin(activeRefPrice * i + 4) * 0.8 + 0.95;
      askAccum += askSize;
      asks.unshift({ price: askPrice, size: askSize, total: askAccum });

      // Buys
      const bidPrice = activeRefPrice * (1 - i * 0.00015);
      const bidSize = Math.cos(activeRefPrice * i + 2) * 0.7 + 0.92;
      bidAccum += bidSize;
      bids.push({ price: bidPrice, size: bidSize, total: bidAccum });
    }
    return { bids, asks };
  }, [activeRefPrice]);

  const handleUnlockSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === 'elz777') {
      setPasswordError(false);
      sessionStorage.setItem('apex_trader_unlocked', 'true');
      setIsLocked(false);
    } else {
      setPasswordError(true);
      setTimeout(() => {
        setPasswordError(false);
        setPasswordInput('');
      }, 700);
    }
  };

  if (isLocked) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#05070A] text-[#E0E6F0] font-sans relative overflow-hidden">
        {/* Cinematic Cybernetic background style */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15),transparent_70%)] opacity-80" />
        <div className="absolute inset-0 bg-[#000] opacity-40 mix-blend-color-dodge pointer-events-none" />
        
        {/* Decorative Grid scanning lines */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-pulse" />
        
        <motion.div 
          className="w-full max-w-[420px] mx-4 bg-[#0B0E14] border border-gray-800/60 rounded-2xl p-6 shadow-2xl shadow-[#000000]/80 relative z-10"
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            x: passwordError ? [0, -8, 8, -6, 6, -4, 4, 0] : 0
          }}
          transition={{ 
            type: 'spring', 
            stiffness: passwordError ? 800 : 100, 
            damping: passwordError ? 12 : 15 
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-3 animate-pulse">
              <span className="text-xl font-bold font-mono tracking-tight">▲</span>
            </div>
            <h2 className="text-base font-extrabold text-white tracking-widest uppercase mb-1">APEX TRADER</h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">TERMINAL SECURED - PIN REQUIRED</p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            {/* Input field */}
            <div className={`relative flex items-center bg-[#070A10] border ${passwordError ? 'border-rose-500/60 shadow-lg shadow-rose-950/15' : 'border-gray-800/60 focus-within:border-indigo-500/60'} rounded-xl overflow-hidden px-4 py-3.5 transition-all`}>
              <input
                type="password"
                placeholder="ENTER TERMINAL PASSKEY"
                className="w-full bg-transparent text-center font-mono text-base tracking-[0.25em] text-white outline-none placeholder:text-gray-600 placeholder:text-xs placeholder:tracking-normal"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                maxLength={12}
              />
            </div>

            {/* Error messaging */}
            {passwordError && (
              <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-[10px] font-mono text-rose-400 font-bold tracking-widest text-center uppercase"
              >
                🔓 PASSKEY REJECTED. RETRY.
              </motion.p>
            )}

            {/* Simulated Glass Layout Interactive Cyber Keypad */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              {['7', '8', '9', 'E', '4', '5', '6', 'L', '1', '2', '3', 'Z', '0', 'CLR', 'OK'].map((key) => {
                let btnCls = "py-3 rounded-lg border font-mono font-bold text-xs select-none transition-all active:scale-95 ";
                if (key === 'OK') {
                  btnCls += "col-span-2 bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-500/50";
                } else if (key === 'CLR') {
                  btnCls += "bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/15 text-[10px]";
                } else if (['E', 'L', 'Z'].includes(key)) {
                  btnCls += "bg-cyan-505/5 border-cyan-800/30 text-cyan-400 hover:bg-cyan-505/10";
                } else {
                  btnCls += "bg-gray-950/40 border-gray-800/40 text-gray-400 hover:bg-gray-900/50 hover:border-gray-800/80 hover:text-white";
                }

                const handleKeyPress = () => {
                  if (key === 'CLR') {
                    setPasswordInput('');
                  } else if (key === 'OK') {
                    handleUnlockSubmit();
                  } else {
                    if (passwordInput.length < 12) {
                      setPasswordInput(prev => prev + key.toLowerCase());
                    }
                  }
                };

                return (
                  <button
                    key={`keypad-${key}`}
                    type="button"
                    onClick={handleKeyPress}
                    className={btnCls}
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            {/* Visual Instructions */}
            <div className="pt-2 text-center">
              <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wider">
                Authorized operators only. Standard typing keyboard supported.
              </span>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-[#080B10] text-[#E0E6F0] overflow-hidden select-none">
      
      {/* HEADER SECTION - FULLY RESPONSIVE */}
      <header className="min-h-16 lg:h-16 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-0 border-b border-gray-900 bg-[#0E131F]/90 backdrop-blur-md z-50 shrink-0 gap-3 sm:gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Activity className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white leading-none">ApexTrader</h1>
              <span className="text-[10px] text-cyan-400 font-mono font-medium tracking-widest uppercase">Live Platform</span>
            </div>
          </div>
          
          <div className="hidden md:block h-6 w-px bg-gray-800"></div>

          {/* Quick Account balance recap */}
          <div className="flex items-center text-xs font-mono">
            <div className="flex items-center space-x-1.5 bg-gray-900/40 px-2.5 py-1.5 rounded-lg border border-gray-800/45">
              <span className="text-gray-500 text-[9px] sm:text-[10px]">AVAILABLE:</span>
              <span className="text-emerald-400 font-bold text-[10px] sm:text-xs">${cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="text-gray-600 text-[9px] sm:text-[10px]">USDT</span>
            </div>
          </div>
        </div>

        {/* Global Portfolio worth statistics & Actions */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 sm:gap-6 pt-2 sm:pt-0 border-t border-gray-900/40 sm:border-0">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[8px] sm:text-[10px] text-gray-500 font-semibold tracking-wider uppercase">PORTFOLIO VALUE</span>
              <span className="font-mono text-xs sm:text-sm md:text-base font-bold text-white tracking-tight">
                ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="flex flex-col items-start sm:items-end min-w-[65px] sm:min-w-[70px]">
              <span className="text-[8px] sm:text-[10px] text-gray-500 font-semibold tracking-wider uppercase">GLOBAL PNL</span>
              <span className={`font-mono text-xs font-bold flex items-center ${portfolioPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {portfolioPnL >= 0 ? '+' : ''}${portfolioPnL.toFixed(2)}
              </span>
            </div>
          </div>

          <button 
            disabled={isDepositing}
            onClick={handleDepositRefill}
            className="h-8 sm:h-9 px-3 sm:px-4.5 rounded-lg bg-indigo-600 hover:bg-indigo-750 disabled:bg-gray-800 border border-indigo-500/25 flex items-center space-x-1.5 sm:space-x-2 text-[10px] sm:text-xs font-semibold text-white tracking-wide shadow-md shadow-indigo-900/20 active:scale-95 transition-all shrink-0"
          >
            {isDepositing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <Wallet className="h-3.5 w-3.5 text-indigo-200" />
            )}
            <span>{isDepositing ? 'Depositing...' : 'Refill +$25k'}</span>
          </button>
        </div>
      </header>

      {/* MOBILE/TABLET COMPACT NAVIGATION TAB-BAR */}
      <div className="lg:hidden flex border-b border-gray-900 bg-[#0E131F] text-[10px] sm:text-xs font-bold font-mono shrink-0">
        <button 
          onClick={() => setActiveTab('markets')} 
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'markets' ? 'border-indigo-500 text-white bg-indigo-950/10' : 'border-transparent text-gray-500 hover:text-gray-305'
          }`}
        >
          <Grid className="h-3.5 w-3.5 text-cyan-400" />
          <span>MARKETS</span>
        </button>
        <button 
          onClick={() => setActiveTab('chart')} 
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'chart' ? 'border-cyan-500 text-white bg-cyan-950/10' : 'border-transparent text-gray-500 hover:text-gray-305'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
          <span>CHART</span>
        </button>
        <button 
          onClick={() => setActiveTab('trade')} 
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'trade' ? 'border-emerald-500 text-white bg-emerald-950/10' : 'border-transparent text-gray-500 hover:text-gray-305'
          }`}
        >
          <Wallet className="h-3.5 w-3.5 text-emerald-400" />
          <span>TRADE (BUY/SELL)</span>
        </button>
      </div>

      {/* THREE PANELS LAYOUT CONTAINER */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* PANEL 1: LEFT HAND MARKETS TICKER CONTAINER */}
        <aside className={`${activeTab === 'markets' ? 'flex w-full' : 'hidden'} lg:flex lg:w-[280px] bg-[#0A0D16] border-r border-gray-900/90 flex-col flex-shrink-0`}>
          <div className="p-4 border-b border-gray-900/60 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 tracking-wider flex items-center gap-1.5 uppercase">
              <Grid className="h-3.5 w-3.5 text-cyan-400" /> Markets
            </span>
            <span className="text-[10px] font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded uppercase">USDT PAIRS</span>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar py-2 divide-y divide-gray-900/20">
            {ASSETS.map((asset) => {
              const active = asset.id === selectedAsset.id;
              const stats = marketPrices[asset.id];
              const isUp = stats.changePercent >= 0;
              const hasAmount = positions[asset.id]?.amount > 0;

              return (
                <button
                  key={asset.id}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setBuyUsdtInput('');
                    setSellCoinInput('');
                    setActiveTab('chart');
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-all relative ${
                    active ? 'bg-[#0F1422] border-l-2 border-indigo-500' : 'hover:bg-[#0c0f1b]/45'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${asset.iconColor}`}>
                      {asset.base}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-white tracking-tight">{asset.name.split('/')[0]}</span>
                        <span className="text-[9px] text-gray-550 font-mono uppercase bg-gray-900 px-1 rounded">Spot</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono tracking-tight font-medium">
                        {hasAmount ? `${positions[asset.id].amount.toFixed(4)} ${asset.base}` : 'No Position'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-gray-100">
                      {stats.price > 0 ? stats.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}
                    </div>
                    <span className={`text-[10px] font-mono font-semibold flex items-center justify-end ${isUp ? 'text-emerald-450' : 'text-rose-450'}`}>
                      {isUp ? <ArrowUpRight className="h-3 w-3 mr-0.5 flex-shrink-0" /> : <ArrowDownRight className="h-3 w-3 mr-0.5 flex-shrink-0" />}
                      {stats.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* PANEL 2: MAIN WORKSPACE CONTAINER (CHART + STATS OVERVIEW) */}
        <main className={`${activeTab === 'chart' ? 'flex w-full' : 'hidden'} lg:flex flex-1 flex-col min-w-0 bg-[#070A10]`}>
          
          {/* STATS OVERVIEW RIBBON FOR ACTIVE PAIR - FULLY RESPONSIVE */}
          <div className="min-h-16 lg:h-16 px-4 sm:px-6 py-2.5 lg:py-0 border-b border-gray-900 bg-[#0A0D16]/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 w-full lg:w-auto">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-extrabold text-white tracking-tight">{selectedAsset.name}</span>
                  <span className="text-[10px] font-mono font-bold bg-[#141F32] text-cyan-400 px-2 py-0.5 rounded">LIVE SPOT</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-[15px] font-mono font-black tracking-tight transition-all duration-150 ${
                    priceColorFlag === 'UP' ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]' :
                    priceColorFlag === 'DOWN' ? 'text-rose-450 drop-shadow-[0_0_10px_rgba(244,63,94,0.45)]' :
                    'text-cyan-400'
                  }`}>
                    ${currentPrice !== null ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${priceColorFlag === 'UP' ? 'bg-emerald-400 animate-ping' : priceColorFlag === 'DOWN' ? 'bg-rose-400 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></span>
                </div>
              </div>

              <div className="hidden sm:block h-8 w-px bg-gray-900"></div>

              {/* Active pricing stats */}
              <div className="grid grid-cols-2 xs:grid-cols-4 sm:flex sm:items-center gap-x-4 gap-y-2 sm:space-x-6">
                <div>
                  <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">24h Change</span>
                  <span className={`text-xs font-mono font-bold ${marketPrices[selectedAsset.id].changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {marketPrices[selectedAsset.id].changePercent >= 0 ? '+' : ''}
                    {marketPrices[selectedAsset.id].changePercent.toFixed(2)}%
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">24h High</span>
                  <span className="text-xs font-mono font-bold text-gray-300">
                    {marketPrices[selectedAsset.id].high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">24h Low</span>
                  <span className="text-xs font-mono font-bold text-gray-300">
                    {marketPrices[selectedAsset.id].low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">24h Volume</span>
                  <span className="text-xs font-mono font-bold text-gray-300">
                    {marketPrices[selectedAsset.id].volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeframe Interval options */}
            <div className="flex bg-[#0A0D16] border border-gray-900 rounded-lg p-1 space-x-1 shrink-0 self-start lg:self-center">
              {INTERVALS.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setSelectedInterval(tf.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    selectedInterval === tf.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN GRAPH EMBED AREA */}
          <div className="flex-1 p-4 relative min-h-0 flex flex-col">
            <div className="flex-1 w-full h-full min-h-0 relative">
              <Chart candles={candles} currentPrice={currentPrice} interval={selectedInterval} symbolName={selectedAsset.name} />
            </div>
          </div>
        </main>

        {/* PANEL 3: THE TRADING TERMINAL & LIVE ORDER STREAM */}
        <aside className={`${activeTab === 'trade' ? 'flex w-full' : 'hidden'} lg:flex lg:w-[340px] bg-[#0A0D16] border-l border-gray-900/90 flex-col flex-shrink-0 overflow-y-auto no-scrollbar`}>
          
          {/* 1. ORDER TYPE SELECTOR */}
          <div className="p-4 border-b border-gray-900/50 flex-shrink-0 bg-gray-950/20">
            <div className="flex bg-[#080B10] border border-gray-900 p-1 rounded-xl relative">
              <motion.div 
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-lg ${
                  orderType === 'BUY' ? 'bg-gradient-to-r from-emerald-650 to-emerald-600' : 'bg-gradient-to-r from-rose-650 to-rose-600'
                }`}
                initial={false}
                animate={{
                  x: orderType === 'BUY' ? '4px' : 'calc(100% + 4px)',
                }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
              />
              <button 
                onClick={() => setOrderType('BUY')}
                className={`flex-1 relative z-10 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors ${
                  orderType === 'BUY' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                BUY {selectedAsset.base}
              </button>
              <button 
                onClick={() => setOrderType('SELL')}
                className={`flex-1 relative z-10 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors ${
                  orderType === 'SELL' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                SELL {selectedAsset.base}
              </button>
            </div>
          </div>

          {/* 2. ORDER FORMS ACTIONS */}
          <div className="p-5 border-b border-gray-900/40 bg-[#0E131F]/30">
            <AnimatePresence mode="wait">
              {orderType === 'BUY' ? (
                <motion.div 
                  key="form-buy" 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: 10 }} 
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1.5 font-bold text-gray-400 uppercase tracking-wide">
                      <span>Purchasing power</span>
                      <span className="font-mono text-cyan-400 cursor-pointer hover:underline" onClick={() => setBuyUsdtInput(cash.toString())}>
                        ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                      </span>
                    </div>

                    <div className="relative flex items-center bg-[#070A10] border border-gray-950 rounded-xl overflow-hidden focus-within:border-emerald-500/50 transition-all shadow-inner">
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-transparent py-3 pl-4 pr-16 text-sm text-white font-mono outline-none"
                        value={buyUsdtInput}
                        onChange={(e) => setBuyUsdtInput(e.target.value)}
                      />
                      <span className="absolute right-4 text-xs font-mono font-bold text-gray-550 border-l border-gray-900 pl-3">USDT</span>
                    </div>
                  </div>

                  {/* Standard percentage quick pick tools */}
                  <div className="grid grid-cols-4 gap-2">
                    {[0.25, 0.5, 0.75, 1].map((pRatio) => (
                      <button
                        key={`buy-pct-${pRatio}`}
                        onClick={() => setBuyUsdtInput((cash * pRatio).toFixed(2))}
                        className="py-1.5 rounded-lg border border-gray-900/50 hover:bg-gray-900 text-[10px] font-mono font-bold text-gray-400 hover:text-emerald-400 bg-gray-950/20 active:scale-95 transition-all"
                      >
                        {pRatio * 100}%
                      </button>
                    ))}
                  </div>

                  {/* Calculated Est execution */}
                  {buyUsdtInput && !isNaN(parseFloat(buyUsdtInput)) && parseFloat(buyUsdtInput) > 0 && (
                    <div className="bg-[#070A10] p-3 rounded-lg border border-gray-950 flex justify-between text-xs font-mono">
                      <span className="text-gray-500">ESTIMATED RECEIVED:</span>
                      <span className="text-emerald-400 font-bold">
                        {(parseFloat(buyUsdtInput) / (currentPrice || marketPrices[selectedAsset.id].price || 1)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {selectedAsset.base}
                      </span>
                    </div>
                  )}

                  <button 
                    onClick={executeBuy}
                    disabled={!buyUsdtInput || isNaN(parseFloat(buyUsdtInput)) || parseFloat(buyUsdtInput) <= 0 || parseFloat(buyUsdtInput) > cash}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-550 hover:to-emerald-450 disabled:from-emerald-950/35 disabled:to-emerald-950/25 disabled:text-gray-600 text-white text-xs font-black tracking-widest uppercase shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition-all"
                  >
                    PLACE MARKET BUY
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="form-sell" 
                  initial={{ opacity: 0, x: 10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -10 }} 
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1.5 font-bold text-gray-400 uppercase tracking-wide">
                      <span>Sell Max balance</span>
                      <span className="font-mono text-cyan-400 cursor-pointer hover:underline" onClick={() => setSellCoinInput(activePosition.amount.toString())}>
                        {activePosition.amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {selectedAsset.base}
                      </span>
                    </div>

                    <div className="relative flex items-center bg-[#070A10] border border-gray-950 rounded-xl overflow-hidden focus-within:border-red-500/50 transition-all shadow-inner">
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-transparent py-3 pl-4 pr-16 text-sm text-white font-mono outline-none"
                        value={sellCoinInput}
                        onChange={(e) => setSellCoinInput(e.target.value)}
                      />
                      <span className="absolute right-4 text-xs font-mono font-bold text-gray-550 border-l border-gray-900 pl-3">{selectedAsset.base}</span>
                    </div>
                  </div>

                  {/* Standard percentage quick pick tools */}
                  <div className="grid grid-cols-4 gap-2">
                    {[0.25, 0.5, 0.75, 1].map((pRatio) => (
                      <button
                        key={`sell-pct-${pRatio}`}
                        onClick={() => setSellCoinInput((activePosition.amount * pRatio).toString())}
                        className="py-1.5 rounded-lg border border-gray-900/50 hover:bg-gray-900 text-[10px] font-mono font-bold text-gray-400 hover:text-rose-450 bg-gray-950/20 active:scale-95 transition-all"
                      >
                        {pRatio * 100}%
                      </button>
                    ))}
                  </div>

                  {/* Calculated Est execution */}
                  {sellCoinInput && !isNaN(parseFloat(sellCoinInput)) && parseFloat(sellCoinInput) > 0 && (
                    <div className="bg-[#070A10] p-3 rounded-lg border border-gray-950 flex justify-between text-xs font-mono">
                      <span className="text-gray-500">ESTIMATED VALUE:</span>
                      <span className="text-emerald-400 font-bold">
                        ${(parseFloat(sellCoinInput) * (currentPrice || marketPrices[selectedAsset.id].price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                      </span>
                    </div>
                  )}

                  <button 
                    onClick={executeSell}
                    disabled={!sellCoinInput || isNaN(parseFloat(sellCoinInput)) || parseFloat(sellCoinInput) <= 0 || parseFloat(sellCoinInput) > activePosition.amount}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-550 hover:to-rose-450 disabled:from-rose-950/35 disabled:to-rose-950/25 disabled:text-gray-600 text-white text-xs font-black tracking-widest uppercase shadow-lg shadow-red-950/20 active:scale-[0.98] transition-all"
                  >
                    PLACE MARKET SELL
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. CORE ACTIVE POSITION DETAILS GRID */}
          <div className="p-5 border-b border-gray-900 bg-gray-950/10 space-y-3.5">
            <h3 className="text-xs font-bold text-gray-400 tracking-wider flex items-center space-x-2.5 uppercase">
              <Briefcase className="h-4 w-4 text-cyan-400" />
              <span>{selectedAsset.base} ACTIVE POSITION</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-[#080B10] border border-gray-900 p-2.5 rounded-lg">
                <span className="text-[9px] text-gray-550 block uppercase font-sans">Coins Held</span>
                <span className="text-xs font-bold text-white">
                  {activePosition.amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                </span>
              </div>
              
              <div className="bg-[#080B10] border border-gray-900 p-2.5 rounded-lg">
                <span className="text-[9px] text-gray-550 block uppercase font-sans">Average Cost</span>
                <span className="text-xs font-bold text-white">
                  ${activePosition.amount > 0 ? (activePosition.investedAmount / activePosition.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>

              <div className="bg-[#080B10] border border-gray-900 p-2.5 rounded-lg">
                <span className="text-[9px] text-gray-550 block uppercase font-sans">Invested Cap</span>
                <span className="text-xs font-bold text-white">
                  ${activePosition.investedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-[#080B10] border border-gray-900 p-2.5 rounded-lg text-right">
                <span className="text-[9px] text-gray-550 block text-left uppercase font-sans">Current Value</span>
                <span className="text-xs font-bold text-cyan-400">
                  ${activePositionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-[#080B10] border border-gray-900 rounded-xl p-3 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 h-10 w-10 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full" />
              <div>
                <span className="text-[10px] text-gray-550 block font-semibold uppercase">UNREALIZED P&L</span>
                <span className={`text-base font-bold font-mono ${activePosition.amount > 0 ? (activePositionPnL >= 0 ? 'text-emerald-400' : 'text-rose-500') : 'text-gray-500'}`}>
                  {activePosition.amount > 0 && (activePositionPnL >= 0 ? '+' : '')}${activePositionPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className={`text-right font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                activePosition.amount > 0 
                  ? (activePositionPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20') 
                  : 'bg-gray-900 text-gray-600 border border-gray-800'
              }`}>
                {activePosition.amount > 0 && (activePositionPnL >= 0 ? '▲' : '▼')} {activePosition.amount > 0 ? activePositionPnLPercent.toFixed(2) : '0.00'}%
              </div>
            </div>
          </div>

          {/* 4. REAL-TIME DEPTH / SHIFTING ORDER BOOK CONTAINER */}
          <div className="p-5 flex-1 flex flex-col min-h-[250px]">
            <span className="text-xs font-bold text-gray-400 tracking-wider flex justify-between items-center uppercase mb-3.5">
              <span>Order Book (Spot Limit)</span>
              <span className="text-[9px] font-mono text-gray-550 capitalize flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> Auto Depth
              </span>
            </span>

            {/* Depth Chart Panel with green/red bars */}
            <div className="flex-1 flex flex-col justify-between text-xs font-mono select-none">
              
              {/* ASKS (RED SIDE, TOP DOWN OVERVIEW) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500 font-bold border-b border-gray-900/50 pb-1 uppercase font-sans">
                  <span>Price (USDT)</span>
                  <span>Size ({selectedAsset.base})</span>
                  <span className="text-right">Total ({selectedAsset.base})</span>
                </div>
                
                {orderBookData.asks.map((ask, i) => {
                  const percentWidth = Math.min(100, (ask.total / orderBookData.asks[orderBookData.asks.length - 1].total) * 100);
                  return (
                    <div key={`ask-${i}`} className="relative flex justify-between items-center h-5">
                      <div className="absolute top-0 bottom-0 right-0 bg-rose-500/5 transition-all" style={{ width: `${percentWidth}%` }} />
                      <span className="text-[11px] text-rose-450 font-bold z-10">{ask.price.toFixed(2)}</span>
                      <span className="text-gray-300 text-[10px] z-10">{ask.size.toFixed(4)}</span>
                      <span className="text-gray-500 text-[10px] text-right z-10">{ask.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* SPREAD TACTICS BAR */}
              <div className="my-2 py-1 border-y border-gray-900 bg-gray-950/40 text-center flex justify-between items-center px-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase font-sans">Spread (0.01%)</span>
                <span className="text-xs font-bold font-mono text-white animate-pulse">
                  {activeRefPrice > 0 ? activeRefPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}
                </span>
                <span className="text-[10px] text-[#A0E040] font-mono font-medium">${(activeRefPrice * 0.0003).toFixed(2)}</span>
              </div>

              {/* BIDS (GREEN SIDE, BOTTOM UP OVERVIEW) */}
              <div className="space-y-1">
                {orderBookData.bids.map((bid, i) => {
                  const percentWidth = Math.min(100, (bid.total / orderBookData.bids[orderBookData.bids.length - 1].total) * 100);
                  return (
                    <div key={`bid-${i}`} className="relative flex justify-between items-center h-5">
                      <div className="absolute top-0 bottom-0 right-0 bg-emerald-500/5 transition-all" style={{ width: `${percentWidth}%` }} />
                      <span className="text-[11px] text-emerald-450 font-bold z-10">{bid.price.toFixed(2)}</span>
                      <span className="text-gray-300 text-[10px] z-10">{bid.size.toFixed(4)}</span>
                      <span className="text-gray-500 text-[10px] text-right z-10">{bid.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
