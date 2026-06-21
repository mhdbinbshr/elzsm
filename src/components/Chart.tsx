import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Candle } from '../types';

function useResizeObserver(ref: React.RefObject<HTMLElement | null>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    // Immediately capture bounding size to avoid delay or blink
    const rect = ref.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      setDimensions({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height,
      });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return dimensions;
}

interface ChartProps {
  candles: Candle[];
  currentPrice: number | null;
  interval?: string;
  symbolName?: string;
}

export const Chart = ({ candles, currentPrice, interval = '1s', symbolName }: ChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(containerRef);

  const RIGHT_AXIS_WIDTH = 75;
  const BOTTOM_AXIS_HEIGHT = 22;

  const chartWidth = Math.max(0, width - RIGHT_AXIS_WIDTH);
  const chartHeight = Math.max(0, height - BOTTOM_AXIS_HEIGHT);

  // States for interactive crosshair
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [countdown, setCountdown] = useState('00:00');

  // Real-time candle countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (interval === '1s') {
        const ms = 1000 - (now % 1000);
        setCountdown(`00:00.${Math.floor(ms / 100)}`);
      } else if (interval === '1m') {
        const sec = 60 - Math.floor((now / 1000) % 65);
        const displaySec = Math.max(0, Math.min(59, sec));
        setCountdown(`00:${displaySec < 10 ? '0' : ''}${displaySec}`);
      } else if (interval === '5m') {
        const totalSec = 300 - Math.floor((now / 1000) % 300);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        setCountdown(`0${min}:${sec < 10 ? '0' : ''}${sec}`);
      } else if (interval === '15m') {
        const totalSec = 900 - Math.floor((now / 1000) % 900);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        setCountdown(`${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`);
      } else if (interval === '1h') {
        const totalSec = 3600 - Math.floor((now / 1000) % 3600);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        setCountdown(`${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`);
      }
    };

    const cInterval = setInterval(updateCountdown, 150);
    updateCountdown();
    return () => clearInterval(cInterval);
  }, [interval]);

  // Calculate Moving Averages (MA)
  const { ma7, ma25, ma99 } = useMemo(() => {
    const list = candles || [];
    const computeMA = (period: number) => {
      return list.map((_, i) => {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
          sum += list[j].close;
          count++;
        }
        return count > 0 ? sum / count : null;
      });
    };
    return {
      ma7: computeMA(7),
      ma25: computeMA(25),
      ma99: computeMA(99),
    };
  }, [candles]);

  const numCandles = Math.min(90, (candles || []).length || 1);
  const candleSpace = chartWidth / numCandles;
  const bodyW = Math.max(2.5, candleSpace * 0.74);

  const renderCandles = useMemo(() => (candles || []).slice(-numCandles), [candles, numCandles]);
  const startIndex = Math.max(0, (candles || []).length - numCandles);

  const { minPrice, maxPrice, yMin, yMax, yRange } = useMemo(() => {
    if (!renderCandles.length) return { minPrice: 0, maxPrice: 0, yMin: 0, yMax: 0, yRange: 0 };
    const minP = Math.min(...renderCandles.map((c) => c.low));
    const maxP = Math.max(...renderCandles.map((c) => c.high));
    const padding = (maxP - minP) * 0.08 || 0.1;
    const yMin = minP - padding;
    const yMax = maxP + padding;
    return { minPrice: minP, maxPrice: maxP, yMin, yMax, yRange: Math.max(0.0001, yMax - yMin) };
  }, [renderCandles]);

  const maxVolume = useMemo(() => {
    if (!renderCandles.length) return 1;
    const vols = renderCandles.map((c) => c.vol);
    return Math.max(...vols, 1);
  }, [renderCandles]);

  if (!candles || candles.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center font-mono text-xs text-gray-400 bg-[#0B0E14] border border-gray-800/40 rounded-xl">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
          <span>Connecting to Binance Stream...</span>
        </div>
      </div>
    );
  }

  const getY = (price: number) => chartHeight - ((price - yMin) / yRange) * chartHeight;

  const renderMa7 = ma7.slice(startIndex);
  const renderMa25 = ma25.slice(startIndex);
  const renderMa99 = ma99.slice(startIndex);

  // Mouse Handlers
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= chartWidth && y >= 0 && y <= chartHeight) {
      const idx = Math.floor(x / candleSpace);
      if (idx >= 0 && idx < renderCandles.length) {
        setHoverIndex(idx);
        setMouseY(y);
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    } else {
      setIsHovering(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setHoverIndex(null);
    setMouseY(null);
  };

  // Determine active displayed candle (either hovered or the latest one)
  const activeIndex = isHovering && hoverIndex !== null ? hoverIndex : renderCandles.length - 1;
  const activeCandle = renderCandles[activeIndex] || null;
  const prevActiveCandle = activeIndex > 0 ? renderCandles[activeIndex - 1] : null;

  const activeMa7 = renderMa7[activeIndex];
  const activeMa25 = renderMa25[activeIndex];
  const activeMa99 = renderMa99[activeIndex];

  // Colors: High fidelity TradingView style
  const UP_COLOR = '#26a69a'; // Beautiful Emerald
  const DOWN_COLOR = '#ef5350'; // Vibrant Coral/Red

  // Path generator for Line studies (Moving Averages)
  const getPathD = (maArray: (number | null)[]) => {
    let d = '';
    let isFirst = true;
    maArray.forEach((val, i) => {
      if (val === null || isNaN(val)) return;
      const x = i * candleSpace + candleSpace / 2;
      const y = getY(val);
      if (isFirst) {
        d += `M ${x} ${y}`;
        isFirst = false;
      } else {
        d += ` L ${x} ${y}`;
      }
    });
    return d;
  };

  const ma7Path = getPathD(renderMa7);
  const ma25Path = getPathD(renderMa25);
  const ma99Path = getPathD(renderMa99);

  // Hover price
  const hoverPrice = mouseY !== null ? yMax - (mouseY / chartHeight) * yRange : null;

  // Render format
  const formatTime = (time: number) => {
    const d = new Date(time);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const formatDate = (time: number) => {
    const d = new Date(time);
    return d.toLocaleDateString([], { month: 'short', day: '2-digit' });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair bg-[#0B0E14] border border-gray-800/40 rounded-xl p-3 overflow-hidden select-none">
      
      {/* 1. HUD Overlay at top-left corner */}
      {activeCandle && (
        <div className="absolute top-4 left-4 z-40 flex flex-wrap items-center gap-x-4 gap-y-1 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800/50 text-xs font-mono">
          <div className="flex items-center space-x-1.5 mr-1">
            <span className="text-gray-400 font-semibold">{interval.toUpperCase()}</span>
            <span className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
              {activeCandle.close >= activeCandle.open ? '▲' : '▼'}
            </span>
          </div>
          
          <div className="flex space-x-1">
            <span className="text-gray-500">O:</span>
            <span className="text-gray-200">{activeCandle.open.toFixed(2)}</span>
          </div>
          <div className="flex space-x-1">
            <span className="text-gray-500">H:</span>
            <span className="text-gray-200">{activeCandle.high.toFixed(2)}</span>
          </div>
          <div className="flex space-x-1">
            <span className="text-gray-500">L:</span>
            <span className="text-gray-200">{activeCandle.low.toFixed(2)}</span>
          </div>
          <div className="flex space-x-1">
            <span className="text-gray-500">C:</span>
            <span className={`${activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'} font-semibold`}>
              {activeCandle.close.toFixed(2)}
            </span>
          </div>
          <div className="flex space-x-1">
            <span className="text-gray-500">Change:</span>
            <span className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
              {(((activeCandle.close - activeCandle.open) / activeCandle.open) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex space-x-1">
            <span className="text-gray-500">V:</span>
            <span className="text-gray-200">{activeCandle.vol.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
          </div>
        </div>
      )}

      {/* Indicator legend overlays (MA details) */}
      <div className="absolute top-14 left-4 z-40 flex items-center space-x-4 text-[10px] font-mono select-none bg-black/20 backdrop-blur-[2px] px-2 py-0.5 rounded">
        {activeMa7 !== null && (
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="text-gray-400">MA7:</span>
            <span className="text-amber-300 font-medium">{activeMa7?.toFixed(2)}</span>
          </div>
        )}
        {activeMa25 !== null && (
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            <span className="text-gray-400">MA25:</span>
            <span className="text-indigo-300 font-medium">{activeMa25?.toFixed(2)}</span>
          </div>
        )}
        {activeMa99 !== null && (
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-gray-400">MA99:</span>
            <span className="text-cyan-300 font-medium">{activeMa99?.toFixed(2)}</span>
          </div>
        )}
      </div>

      {width > 0 && height > 0 && (
        <svg 
          width={width} 
          height={height} 
          className="absolute inset-0 block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Faint TradingView-style Watermark */}
          {symbolName && (
            <g opacity="0.04" pointerEvents="none" className="select-none">
              <text
                x={chartWidth / 2}
                y={chartHeight / 2}
                fill="#cbd5e1"
                fontSize={Math.min(chartWidth * 0.11, 80)}
                fontWeight="900"
                fontFamily="sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
                className="tracking-tighter"
              >
                {symbolName.toUpperCase()}
              </text>
              <text
                x={chartWidth / 2}
                y={chartHeight / 2 + 35}
                fill="#cbd5e1"
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
                className="tracking-[0.25em]"
              >
                {interval.toUpperCase()} LIVE STREAM
              </text>
            </g>
          )}

          {/* Subtle Vertical Grids */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => {
            const x = chartWidth * ratio;
            return (
              <line key={`vgrid-${idx}`} x1={x} y1={0} x2={x} y2={chartHeight} stroke="#181d28" strokeDasharray="1 4" strokeWidth={1} />
            );
          })}

          {/* Horizontal Grid lines */}
          {[0.12, 0.32, 0.52, 0.72, 0.92].map((ratio) => {
            const y = chartHeight * ratio;
            const price = yMax - yRange * ratio;
            return (
              <g key={`hgrid-${ratio}`}>
                <line x1={0} y1={y} x2={chartWidth} y2={y} stroke="#181d28" strokeDasharray="1 4" strokeWidth={1} />
                {/* Right Price Scale Labels */}
                <text x={chartWidth + 8} y={y + 4} fill="#515d70" fontSize="10" className="font-mono font-medium">
                  {price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Volume bars drawn at the bottom */}
          {renderCandles.map((c, i) => {
            const x = i * candleSpace + candleSpace / 2;
            const isUp = c.close >= c.open;
            const color = isUp ? UP_COLOR : DOWN_COLOR;
            const vHeight = (c.vol / maxVolume) * chartHeight * 0.16; // volume pane max height 16%
            const yTop = chartHeight - vHeight;

            return (
              <rect
                key={`vol-${c.time}`}
                x={x - bodyW / 2}
                y={yTop}
                width={bodyW}
                height={Math.max(1, vHeight)}
                fill={color}
                fillOpacity={0.15}
              />
            );
          })}

          {/* Render Technical Moving Average Overlay lines */}
          {ma99Path && <path d={ma99Path} fill="none" stroke="#22d3ee" strokeWidth={1.2} strokeOpacity={0.65} />}
          {ma25Path && <path d={ma25Path} fill="none" stroke="#818cf8" strokeWidth={1.2} strokeOpacity={0.75} />}
          {ma7Path && <path d={ma7Path} fill="none" stroke="#fbbf24" strokeWidth={1.2} strokeOpacity={0.85} />}

          {/* Candle Data (Wicks & Bodies) */}
          {renderCandles.map((c, i) => {
            const x = i * candleSpace + candleSpace / 2;
            const isUp = c.close >= c.open;
            const color = isUp ? UP_COLOR : DOWN_COLOR;

            const yTop = getY(Math.max(c.open, c.close));
            const yBottom = getY(Math.min(c.open, c.close));
            const h = Math.max(1, yBottom - yTop);

            const isHoveredCandle = isHovering && hoverIndex === i;

            return (
              <g key={`candle-${c.time}`}>
                {/* Wick */}
                <line 
                  x1={x} 
                  y1={getY(c.high)} 
                  x2={x} 
                  y2={getY(c.low)} 
                  stroke={color} 
                  strokeWidth={1.2} 
                />
                {/* Body with precise TradingView style filled/hollow looks */}
                <rect 
                  x={x - bodyW / 2} 
                  y={yTop} 
                  width={bodyW} 
                  height={h} 
                  fill={color} 
                  stroke={color}
                  strokeWidth={0.5}
                  strokeOpacity={0.9}
                  className="transition-all"
                  style={{ filter: isHoveredCandle ? 'brightness(1.2) drop-shadow(0 0 2px rgba(255,255,255,0.08))' : 'none' }}
                />
              </g>
            );
          })}

          {/* Current Real-time Price Tracking horizontal overlay */}
          {currentPrice && (
            <g>
              {(() => {
                const lastCandle = renderCandles[renderCandles.length - 1];
                const currentIsUp = lastCandle ? currentPrice >= lastCandle.open : true;
                const themePriceColor = currentIsUp ? UP_COLOR : DOWN_COLOR;
                const lastCandleX = (renderCandles.length - 1) * candleSpace + candleSpace / 2;
                const priceY = getY(currentPrice);

                return (
                  <g>
                    {/* Horizontal Dashed Price Level Line */}
                    <line 
                      x1={0} 
                      y1={priceY} 
                      x2={chartWidth} 
                      y2={priceY} 
                      stroke={themePriceColor} 
                      strokeDasharray="3 3" 
                      strokeWidth={1.2} 
                      strokeOpacity={0.8}
                    />

                    {/* Concentric Pulsing Beacons at latest candle intersection */}
                    {lastCandleX && !isNaN(lastCandleX) && (
                      <g>
                        {/* Outer Glow Halo */}
                        <circle 
                          cx={lastCandleX} 
                          cy={priceY} 
                          r={4} 
                          fill={themePriceColor} 
                          opacity={0.4}
                        >
                          <animate 
                            attributeName="r" 
                            values="4;14;4" 
                            dur="1.2s" 
                            repeatCount="indefinite" 
                          />
                          <animate 
                            attributeName="opacity" 
                            values="0.7;0;0.7" 
                            dur="1.2s" 
                            repeatCount="indefinite" 
                          />
                        </circle>
                        {/* Core solid beacon */}
                        <circle 
                          cx={lastCandleX} 
                          cy={priceY} 
                          r={3.5} 
                          fill="white" 
                          stroke={themePriceColor}
                          strokeWidth={1.5}
                        />
                      </g>
                    )}

                    {/* Price Axis Badge with Countdown Indicator */}
                    <g transform={`translate(${chartWidth + 3}, ${priceY - 9})`}>
                      <rect 
                        x={0} 
                        y={0} 
                        width={RIGHT_AXIS_WIDTH - 6} 
                        height={18} 
                        fill={themePriceColor} 
                        rx="2.5" 
                      />
                      <text 
                        x={(RIGHT_AXIS_WIDTH - 6) / 2} 
                        y={12} 
                        fill="white" 
                        fontSize="9.5" 
                        textAnchor="middle" 
                        className="font-mono font-bold tracking-tight"
                      >
                        {currentPrice.toFixed(2)}
                      </text>
                    </g>

                    {/* Dynamic Countdown Tag hanging elegantly directly below the price label */}
                    <g transform={`translate(${chartWidth + 3}, ${priceY + 11})`}>
                      <rect
                        x={0}
                        y={0}
                        width={RIGHT_AXIS_WIDTH - 5}
                        height={13}
                        fill="#0B0E14"
                        stroke={themePriceColor}
                        strokeWidth="0.5"
                        strokeOpacity="0.4"
                        rx="1.5"
                      />
                      <text
                        x={(RIGHT_AXIS_WIDTH - 5) / 2}
                        y={9}
                        fill="#94a3b8"
                        fontSize="7.5"
                        textAnchor="middle"
                        className="font-mono font-bold uppercase tracking-wider scale-[0.95]"
                      >
                        {countdown}
                      </text>
                    </g>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Interactive Crosshairs & Crosshair Labels */}
          {isHovering && hoverIndex !== null && mouseY !== null && hoverPrice !== null && (
            <g>
              {/* Vertical Dashed Line */}
              <line 
                x1={hoverIndex * candleSpace + candleSpace / 2} 
                y1={0} 
                x2={hoverIndex * candleSpace + candleSpace / 2} 
                y2={chartHeight} 
                stroke="#cbd5e1" 
                strokeDasharray="3 3" 
                strokeWidth={1} 
                strokeOpacity={0.4} 
              />
              
              {/* Horizontal Dashed Line */}
              <line 
                x1={0} 
                y1={mouseY} 
                x2={chartWidth} 
                y2={mouseY} 
                stroke="#cbd5e1" 
                strokeDasharray="3 3" 
                strokeWidth={1} 
                strokeOpacity={0.4} 
              />

              {/* Crosshair Intersecting Point */}
              <circle 
                cx={hoverIndex * candleSpace + candleSpace / 2} 
                cy={mouseY} 
                r={4} 
                fill="white" 
                stroke="#3b82f6" 
                strokeWidth={2} 
              />

              {/* Price Label on Right Axis */}
              <g>
                <rect 
                  x={chartWidth} 
                  y={mouseY - 9} 
                  width={RIGHT_AXIS_WIDTH} 
                  height={18} 
                  fill="#334155" 
                  rx="2" 
                />
                <text 
                  x={chartWidth + RIGHT_AXIS_WIDTH / 2} 
                  y={mouseY + 4} 
                  fill="#f8fafc" 
                  fontSize="10" 
                  textAnchor="middle" 
                  className="font-mono font-semibold"
                >
                  {hoverPrice.toFixed(2)}
                </text>
              </g>

              {/* Time Label on Bottom Axis */}
              <g>
                <rect 
                  x={Math.max(0, Math.min(chartWidth - 80, hoverIndex * candleSpace + candleSpace / 2 - 40))} 
                  y={chartHeight + 1} 
                  width={80} 
                  height={18} 
                  fill="#334155" 
                  rx="2" 
                />
                <text 
                  x={Math.max(40, Math.min(chartWidth - 40, hoverIndex * candleSpace + candleSpace / 2))} 
                  y={chartHeight + 13} 
                  fill="#f8fafc" 
                  fontSize="9" 
                  textAnchor="middle" 
                  className="font-mono"
                >
                  {formatTime(renderCandles[hoverIndex].time)}
                </text>
              </g>
            </g>
          )}

          {/* Normal Date labels along the Bottom Axis */}
          {!isHovering && renderCandles.map((c, idx) => {
            // Show dates on intervals of 15 candles
            if (idx % 18 === 0 && idx > 0 && idx < renderCandles.length - 10) {
              const x = idx * candleSpace + candleSpace / 2;
              return (
                <text 
                  key={`time-label-${c.time}`}
                  x={x} 
                  y={chartHeight + 14} 
                  fill="#515d70" 
                  fontSize="9" 
                  textAnchor="middle" 
                  className="font-mono"
                >
                  {formatTime(c.time)}
                </text>
              );
            }
            return null;
          })}
        </svg>
      )}
    </div>
  );
};

