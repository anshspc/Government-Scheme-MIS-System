import React, { useState, useEffect } from 'react';
import { Timeline, BarChart as BarIcon, Percent, TrendingUp, Info } from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import api from '../services/api';
import { authService } from '../services/auth';

export default function Forecasts() {
  const user = authService.getCurrentUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schemes, setSchemes] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState('');
  
  // State and District filters
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(
    user?.role === 'State Admin' || user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.state || '' : ''
  );
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(
    user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.district : ''
  );

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedScheme) params.scheme_id = selectedScheme;
      if (selectedState) params.state = selectedState;
      if (selectedDistrict) params.district = selectedDistrict;
      
      const res = await api.get('/api/forecast', { params });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching forecasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpers = async () => {
    try {
      const sRes = await api.get('/api/schemes');
      setSchemes(sRes.data);
      if (sRes.data.length > 0 && !selectedScheme) {
        setSelectedScheme(sRes.data[0].id);
      }
      
      const bParams = { limit: 1 };
      if (selectedState) bParams.state = selectedState;
      const bRes = await api.get('/api/beneficiaries', { params: bParams });
      if (bRes.data?.filters_data) {
        if (bRes.data.filters_data.states) {
          setStates(bRes.data.filters_data.states);
        }
        if (bRes.data.filters_data.districts) {
          setDistricts(bRes.data.filters_data.districts);
        }
      }
    } catch (err) {
      console.error('Error fetching helpers:', err);
    }
  };

  useEffect(() => {
    fetchHelpers();
  }, [selectedState]);

  useEffect(() => {
    if (selectedScheme) {
      fetchForecast();
    }
  }, [selectedScheme, selectedState, selectedDistrict]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const { beneficiaries = [], utilization = [], model_metrics = {} } = data || {};

  return (
    <div className="space-y-6">
      
      {/* Scope Settings */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Timeline className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Advanced Forecasting Engine</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedScheme}
            onChange={(e) => setSelectedScheme(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
          >
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.scheme_name}</option>
            ))}
          </select>

          {user?.role === 'Super Admin' ? (
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict(''); // Reset district
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
        </div>
      </div>

      {/* Model accuracy cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Beneficiary model Fit (R²)</span>
            <h4 className="text-lg font-black text-slate-800 tracking-tight">{(model_metrics?.beneficiary_r2 * 100)?.toFixed(1)}%</h4>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Percent fontSize="small" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">utilization model Fit (R²)</span>
            <h4 className="text-lg font-black text-slate-800 tracking-tight">{(model_metrics?.utilization_r2 * 100)?.toFixed(1)}%</h4>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Percent fontSize="small" />
          </div>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm flex items-start space-x-3 text-amber-800 text-[11px] leading-relaxed">
          <Info fontSize="small" className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Statistical Method details</span>
            Predictions are generated dynamically using Scikit-Learn Ordinary Least Squares Linear Regression and an iterative Moving Average (rolling window of 3 months).
          </div>
        </div>
      </div>

      {/* Forecast Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Beneficiary Growth forecast */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 mb-4">12-Month Beneficiary Enrollment Forecast</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={beneficiaries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip
                  formatter={(val) => [val ? Math.round(val).toLocaleString() : 'N/A', "Enrollments"]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="actual" name="Historical Enrollments" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="forecast_linear" name="Linear Trend Projection" stroke="#f97316" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="forecast_ma" name="Moving Avg Forecast" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fund utilization forecast */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 mb-4">12-Month Budget Utilization Forecast</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={utilization} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 10_000_000).toFixed(1)} Cr`}
                />
                <Tooltip
                  formatter={(val) => [`₹${val.toLocaleString()}`, "Amount"]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="actual" name="Historical Expenditure" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="forecast_linear" name="Linear Expenditure Projection" stroke="#f97316" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="forecast_ma" name="Moving Avg Expenditure" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
