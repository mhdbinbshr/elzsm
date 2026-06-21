import { useState, useEffect, useRef } from 'react';
import { Candle } from '../types';

export function useBinance(symbol = 'btcusdt', interval = '1s', forceUp = false) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Maintain climbing trend offset
  const upOffsetRef = useRef<number>(0);
  const prevForceUpRef = useRef<boolean>(false);
  const forceUpRef = useRef<boolean>(forceUp);
  const tickMomentumRef = useRef<number>(0);

  // Monitor forceUp change to reset or persist
  useEffect(() => {
    forceUpRef.current = forceUp;
    if (forceUp && !prevForceUpRef.current) {
      // Natural initial momentum injection when buy order is placed
      // We can add an instant tiny organic shift of +0.04% to make it immediately in the green,
      // then let the momentum-based climber elegantly push it higher tick by tick!
      setCurrentPrice((current) => {
        if (!current) return current;
        const initialShift = current * 0.0004;
        upOffsetRef.current = Math.max(upOffsetRef.current, initialShift);

        setCandles((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          const last = copy[lastIdx];

          const closeVal = last.close + initialShift;
          const highVal = Math.max(last.high, closeVal);
          const lowVal = Math.min(last.low, closeVal);

          copy[lastIdx] = {
            ...last,
            close: closeVal,
            high: highVal,
            low: lowVal,
          };
          return copy;
        });

        return current + initialShift;
      });
    }
    prevForceUpRef.current = forceUp;
  }, [forceUp]);

  useEffect(() => {
    let ws: WebSocket;
    let isMounted = true;

    // Fetch initial historical candles
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=100`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const hist: Candle[] = data.map((d: any) => ({
          time: d[0],
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          vol: parseFloat(d[5]),
        }));
        
        setCandles(hist);
        if (hist.length > 0) {
          setCurrentPrice(hist[hist.length - 1].close);
        }

        // Connect WebSocket for live updates
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`);
        ws.onmessage = (event) => {
          if (!isMounted) return;
          const msg = JSON.parse(event.data);
          if (msg.e === 'kline') {
            const k = msg.k;
            
            let openVal = parseFloat(k.o);
            let highVal = parseFloat(k.h);
            let lowVal = parseFloat(k.l);
            let closeVal = parseFloat(k.c);
            const volVal = parseFloat(k.v);

            const isForcing = forceUpRef.current;

            if (isForcing) {
              // Create continuous upward drift of price
              const driftStep = openVal * (0.0006 + Math.random() * 0.0008);
              upOffsetRef.current += driftStep;
            } else {
              // Smooth decay back to zero over time so there's no sharp drop
              upOffsetRef.current *= 0.94;
            }

            // Apply shifted offset to match a realistic candle structure
            if (upOffsetRef.current > 0.01) {
              openVal = openVal + upOffsetRef.current;
              if (isForcing) {
                // Ensure Close is strictly higher than Open to guarantee green candlestick
                const tickDrift = openVal * (0.0003 + Math.random() * 0.0005);
                closeVal = openVal + tickDrift;
                highVal = closeVal + (Math.random() * tickDrift * 0.3);
                lowVal = openVal - (Math.random() * tickDrift * 0.15);
              } else {
                closeVal = closeVal + upOffsetRef.current;
                highVal = highVal + upOffsetRef.current;
                lowVal = lowVal + upOffsetRef.current;
              }
            }

            const newCandle: Candle = {
              time: k.t,
              open: openVal,
              high: highVal,
              low: lowVal,
              close: closeVal,
              vol: volVal,
            };
            
            setCurrentPrice(newCandle.close);
            
            setCandles(prev => {
              if (prev.length === 0) return [newCandle];
              const last = prev[prev.length - 1];
              
              if (last.time === newCandle.time) {
                // Update current candle
                const copy = [...prev];
                copy[copy.length - 1] = newCandle;
                return copy;
              } else {
                // Add new candle, keep array length fixed (100)
                return [...prev.slice(1), newCandle];
              }
            });
          }
        };

        // Real-time micro-tick sub-second simulation loop (280ms ticks for perfect high realism)
        const tickInterval = setInterval(() => {
          if (!isMounted) return;

          setCandles(prev => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const last = { ...copy[copy.length - 1] };

            const isForcing = forceUpRef.current;
            let tickNoise = 0;

            if (isForcing) {
              // Accelerate the upward momentum smoothly during forceUp.
              // Generates consistent, beautifully climbing green ticks (approx +0.05% to +0.09% per tick)
              // to make the buy position highly profitable throughout the 3s duration.
              const climbFactor = 0.0005 + Math.random() * 0.0005;
              tickNoise = last.close * climbFactor;
              upOffsetRef.current += tickNoise;
            } else {
              // Smooth rolling random walk with momentum and minor mean reversion.
              // Keeps the ticker moving beautifully and realistically in wave-like trends.
              const randomShift = (Math.random() - 0.5) * 0.00018;
              tickMomentumRef.current = (tickMomentumRef.current * 0.82) + randomShift;
              
              // Prevent wild, unrealistic breakaway runaway speeds during idle mode
              tickMomentumRef.current = Math.max(-0.0004, Math.min(0.0004, tickMomentumRef.current));
              
              tickNoise = last.close * tickMomentumRef.current;
              
              // Smooth decay back to original price line
              if (upOffsetRef.current > 0.01) {
                upOffsetRef.current *= 0.94;
              }
            }

            last.close = last.close + tickNoise;
            if (last.close > last.high) last.high = last.close;
            if (last.close < last.low) last.low = last.close;

            copy[copy.length - 1] = last;
            setCurrentPrice(last.close);
            return copy;
          });
        }, 280);

        // Keep local reference to clear in useEffect
        (ws as any)._tickInterval = tickInterval;
      })
      .catch(err => console.error("Error fetching binance data", err));

    return () => {
      isMounted = false;
      if (ws) {
        ws.close();
        if ((ws as any)._tickInterval) {
          clearInterval((ws as any)._tickInterval);
        }
      }
    };
  }, [symbol, interval]);

  return { candles, currentPrice };
}
