import { type AnalystData } from "../utils/supabase";

interface AnalystDataSectionProps {
  analystData: Record<string, AnalystData>;
}

export function AnalystDataSection({ analystData }: AnalystDataSectionProps) {
  return (
    <div className="space-y-6">
      {Object.entries(analystData).map(([ticker, data]) => (
        <div key={ticker} className="bg-[var(--card)] border border-[var(--layer1-blue)]/30 rounded-xl p-6">
          {/* Ticker Header */}
          <div className="flex items-baseline gap-3 mb-6">
            <h3 className="text-2xl text-[var(--layer1-blue)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {ticker}
            </h3>
            <div className="text-sm text-white/60">
              Current: <span className="text-white">${data.currentPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Recommendation Breakdown */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                Analyst Recommendations
              </h4>
              
              <div className="space-y-2 mb-4">
                {[
                  { label: 'Strong Buy', value: data.recommendation.strongBuy, color: 'bg-green-500' },
                  { label: 'Buy', value: data.recommendation.buy, color: 'bg-green-400' },
                  { label: 'Hold', value: data.recommendation.hold, color: 'bg-yellow-500' },
                  { label: 'Sell', value: data.recommendation.sell, color: 'bg-red-400' },
                  { label: 'Strong Sell', value: data.recommendation.strongSell, color: 'bg-red-500' },
                ].map((rec) => {
                  const total = Object.values(data.recommendation).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (rec.value / total) * 100 : 0;
                  
                  return (
                    <div key={rec.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/70">{rec.label}</span>
                        <span className="text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                          {rec.value}
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${rec.color} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Price Targets & Metrics */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                Price Target
              </h4>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-white/70">Mean Target</span>
                  <span className="text-[var(--layer1-blue)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${data.priceTarget.mean.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Range</span>
                  <span className="text-white/70" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${data.priceTarget.low.toFixed(2)} - ${data.priceTarget.high.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Upside Potential</span>
                  <span 
                    className={`font-medium ${data.targetGap >= 0 ? 'text-green-400' : 'text-red-400'}`}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {data.targetGap >= 0 ? '+' : ''}{data.targetGap.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Metrics */}
              {data.metric && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-white/50 mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                    Key Metrics
                  </h4>
                  <div className="space-y-2 text-sm">
                    {data.metric.peRatio && (
                      <div className="flex justify-between">
                        <span className="text-white/70">P/E Ratio</span>
                        <span className="text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                          {data.metric.peRatio.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {data.metric.revenueGrowthTTM && (
                      <div className="flex justify-between">
                        <span className="text-white/70">Revenue Growth (TTM)</span>
                        <span className="text-green-400" style={{ fontFamily: 'var(--font-mono)' }}>
                          {data.metric.revenueGrowthTTM >= 0 ? '+' : ''}{data.metric.revenueGrowthTTM.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
