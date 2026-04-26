import React from 'react';

export default function KPICard({ title, value, subtext, icon, trend, status = "info" }) {
  // Map status to border highlights
  const statusColors = {
    info: "border-slate-200 bg-white",
    success: "border-emerald-200 bg-white hover:border-emerald-300",
    warning: "border-amber-200 bg-white hover:border-amber-300",
    danger: "border-rose-200 bg-slate-50 hover:border-rose-300"
  };

  const trendColors = {
    up: "text-emerald-500",
    down: "text-rose-500",
    neutral: "text-slate-400"
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.startsWith('+') || trend.toLowerCase().includes('healthy')) return trendColors.up;
    if (trend.startsWith('-') || trend.toLowerCase().includes('alert') || trend.toLowerCase().includes('error')) return trendColors.down;
    return trendColors.neutral;
  };

  return (
    <div className={`p-6 rounded-2xl shadow-sm border flex items-center justify-between transition-all duration-200 hover:shadow-md ${statusColors[status]}`}>
      <div className="space-y-1.5 truncate">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{title}</span>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
        {subtext && (
          <p className="text-[10px] text-slate-500 font-semibold truncate">
            {trend && (
              <span className={`font-black mr-1.5 ${getTrendColor()}`}>
                {trend}
              </span>
            )}
            {subtext}
          </p>
        )}
      </div>
      <div className="p-3 bg-slate-100 text-slate-700 rounded-xl flex-shrink-0">
        {icon}
      </div>
    </div>
  );
}
