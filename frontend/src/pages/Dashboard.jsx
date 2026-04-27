import React, { useState, useEffect } from 'react';
import {
  People,
  AccountBalanceWallet,
  TrendingUp,
  Percent,
  ErrorOutline,
  Refresh,
  FilterList
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import api from '../services/api';
import { authService } from '../services/auth';
import KPICard from '../components/KPICard';

export default function Dashboard() {
  const user = authService.getCurrentUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State & District filters
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(
    user?.role === 'State Admin' || user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.state || '' : ''
  );
  
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(
    user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.district : ''
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch main analytics
      const params = {};
      if (selectedState) params.state = selectedState;
      if (selectedDistrict) params.district = selectedDistrict;
      const res = await api.get('/api/analytics', { params });
      setData(res.data);
      if (res.data?.states) {
        setStates(res.data.states);
      }
      
      // 2. Fetch districts list for dropdown filter (cascaded by state)
      const bParams = { limit: 1 };
      if (selectedState) bParams.state = selectedState;
      const bRes = await api.get('/api/beneficiaries', { params: bParams });
      if (bRes.data?.filters_data?.districts) {
        setDistricts(bRes.data.filters_data.districts);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to fetch dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedState, selectedDistrict]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Pre-configured colors for charts
  const CHART_COLORS = ['#1e3a8a', '#f97316', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const RADIAN = Math.PI / 180;
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-black">
        {percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
      </text>
    );
  };

  const { kpis, district_rankings = [], scheme_performance = [], monthly_trends = [] } = data || {};

  return (
    <div className="space-y-6">
      
      {/* Filter Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <FilterList className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dashboard Scope</span>
        </div>
        
        <div className="flex items-center space-y-0 space-x-3 w-full sm:w-auto">
          {/* State Selector */}
          {user?.role === 'Super Admin' ? (
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict(''); // Reset district on state change
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
            >
              <option value="">All States (National)</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            user?.state && (
              <div className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl">
                Locked State: {user.state}
              </div>
            )
          )}

          {/* District Selector */}
          {user?.role !== 'District Officer' && user?.role !== 'Block Officer' ? (
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <div className="text-xs font-bold text-orange-500 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl">
              Locked District: {user.district}
            </div>
          )}
          
          <button
            onClick={fetchDashboardData}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors"
          >
            <Refresh fontSize="small" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <KPICard
          title="Total Beneficiaries"
          value={kpis?.total_beneficiaries?.toLocaleString() || '0'}
          subtext="active registrations"
          icon={<People className="text-blue-600" />}
          trend="+1.2%"
          status="info"
        />
        <KPICard
          title="Total Allocated Funds"
          value={`₹${(kpis?.total_allocated / 10_000_000)?.toFixed(1)} Cr` || '0.0'}
          subtext="budget allocated"
          icon={<AccountBalanceWallet className="text-amber-600" />}
          status="warning"
        />
        <KPICard
          title="Total Funds Utilized"
          value={`₹${(kpis?.total_utilized / 10_000_000)?.toFixed(1)} Cr` || '0.0'}
          subtext="funds disbursed"
          icon={<TrendingUp className="text-emerald-600" />}
          status="success"
        />
        <KPICard
          title="Budget Utilization"
          value={`${kpis?.utilization_percentage?.toFixed(2)}%` || '0%'}
          subtext="utilization efficiency"
          icon={<Percent className="text-purple-600" />}
          trend={kpis?.utilization_percentage > 90 ? 'High' : 'Normal'}
          status={kpis?.utilization_percentage > 100 ? 'danger' : 'info'}
        />
        <KPICard
          title="Pending Cases"
          value={kpis?.pending_cases?.toString() || '0'}
          subtext="integrity alerts"
          icon={<ErrorOutline className="text-rose-600" />}
          trend={kpis?.pending_cases > 50 ? 'Audit needed' : 'Healthy'}
          status={kpis?.pending_cases > 100 ? 'danger' : 'warning'}
        />
      </div>

      {/* Charts Block 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Fund Utilization Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Fund Utilization Trend</h4>
          <div className="h-80">
            {monthly_trends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No monthly transactional data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly_trends} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 10_000_000).toFixed(1)} Cr`}
                  />
                  <Tooltip
                    formatter={(val) => [`₹${val.toLocaleString()}`, "Utilized"]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                  />
                  <Area type="monotone" dataKey="utilized" stroke="#1e3a8a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorUtil)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Scheme-wise Comparison */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Scheme-wise Allocation vs Utilization</h4>
          <div className="h-80">
            {scheme_performance.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No scheme metrics registered.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scheme_performance} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="scheme_name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 10_000_000).toFixed(0)} Cr`}
                  />
                  <Tooltip
                    formatter={(val) => [`₹${val.toLocaleString()}`, "Amount"]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="allocated" name="Allocated" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="utilized" name="Utilized" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Charts Block 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 3: District Rankings (Top 6) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4">District-wise Budget Utilization (%)</h4>
          <div className="h-80">
            {district_rankings.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No geography rankings mapped.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={district_rankings.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 120]} />
                  <YAxis dataKey="district" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={80} />
                  <Tooltip
                    formatter={(val) => [`${val.toFixed(2)}%`, "Utilization"]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                  />
                  <Bar dataKey="percentage" name="Utilization Rate" fill="#10b981" radius={[0, 6, 6, 0]}>
                    {district_rankings.slice(0, 10).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.percentage > 100 ? '#ef4444' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Beneficiary Share distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Scheme Beneficiary Distribution</h4>
          <div className="h-80 flex flex-col justify-between">
            <div className="h-64">
              {scheme_performance.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No distribution details found.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scheme_performance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="utilized"
                      nameKey="scheme_name"
                    >
                      {scheme_performance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`₹${val.toLocaleString()}`, "Utilization Share"]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Pie Legends */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] font-bold text-slate-500">
              {scheme_performance.map((entry, index) => (
                <div key={entry.scheme_name} className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></span>
                  <span>{entry.scheme_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
