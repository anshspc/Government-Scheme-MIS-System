import React, { useState, useEffect } from 'react';
import { BarChart as BarIcon, Star, Assessment, AssignmentTurnedIn, ArrowForward } from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import api from '../services/api';
import { authService } from '../services/auth';

export default function SchemeAnalytics() {
  const user = authService.getCurrentUser();
  const [analytics, setAnalytics] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [selectedSchemeName, setSelectedSchemeName] = useState('PM Kisan');
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState([]);
  const [districtCoverage, setDistrictCoverage] = useState([]);

  // State and District filters
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(
    user?.role === 'State Admin' || user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.state || '' : ''
  );
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(
    user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.district || '' : ''
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cascading filters
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

      // 1. Fetch main analytics data
      const aParams = {};
      if (selectedState) aParams.state = selectedState;
      if (selectedDistrict) aParams.district = selectedDistrict;
      const res = await api.get('/api/analytics', { params: aParams });
      setAnalytics(res.data);
      
      // 2. Fetch schemes names
      const sRes = await api.get('/api/schemes');
      setSchemes(sRes.data);
      if (sRes.data.length > 0 && !selectedSchemeName) {
        setSelectedSchemeName(sRes.data[0].scheme_name);
      }

      // 3. Fetch scheme forecast (to extract historical trend points for the selected scheme)
      const schemeObj = sRes.data.find(s => s.scheme_name === selectedSchemeName);
      if (schemeObj) {
        const fParams = { scheme_id: schemeObj.id };
        if (selectedState) fParams.state = selectedState;
        if (selectedDistrict) fParams.district = selectedDistrict;
        const fRes = await api.get('/api/forecast', { params: fParams });
        // filter down to historical values (actual is not null)
        const hist = (fRes.data?.beneficiaries || []).filter(item => item.actual !== null);
        setHistoricalData(hist);
        
        // Fetch real district coverage breakdown from backend
        const covParams = { scheme_id: schemeObj.id };
        if (selectedState) covParams.state = selectedState;
        if (selectedDistrict) covParams.district = selectedDistrict;
        const covRes = await api.get('/api/analytics/scheme-coverage', { params: covParams });
        setDistrictCoverage(covRes.data.slice(0, 10));
      }

    } catch (err) {
      console.error('Error fetching scheme stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSchemeName, selectedState, selectedDistrict]);

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Find scheme details
  const activeSchemeData = (analytics?.scheme_performance || []).find(s => s.scheme_name === selectedSchemeName) || {
    allocated: 0,
    utilized: 0,
    percentage: 0
  };

  // Real district coverage is loaded dynamically from the API and stored in state

  return (
    <div className="space-y-6">
      
      {/* Scheme Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <BarIcon className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Welfare Scheme Coverage Analysis</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedSchemeName}
            onChange={(e) => setSelectedSchemeName(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
          >
            {schemes.map((s) => (
              <option key={s.id} value={s.scheme_name}>{s.scheme_name}</option>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scheme Status</span>
            <h4 className="text-lg font-black text-slate-800 tracking-tight mt-1.5 flex items-center space-x-1.5">
              <Star className="text-orange-500" fontSize="small" />
              <span>Active</span>
            </h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Budget</span>
          <h4 className="text-lg font-black text-slate-800 tracking-tight mt-1.5">
            ₹{(activeSchemeData.allocated / 10_000_000).toFixed(2)} Cr
          </h4>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Utilized Budget</span>
          <h4 className="text-lg font-black text-emerald-600 tracking-tight mt-1.5">
            ₹{(activeSchemeData.utilized / 10_000_000).toFixed(2)} Cr
          </h4>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Utilization Percentage</span>
          <h4 className="text-lg font-black text-orange-500 tracking-tight mt-1.5">
            {activeSchemeData.percentage.toFixed(2)}%
          </h4>
        </div>

      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Growth Trend chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <Assessment className="text-slate-400" />
            <span>Monthly Enrollment Trend</span>
          </h4>
          <div className="h-72">
            {historicalData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No historical enrollment data found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip
                    formatter={(val) => [val.toLocaleString(), "Enrollments"]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                  />
                  <Line type="monotone" dataKey="actual" name="Beneficiaries" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* District Coverage bar chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <AssignmentTurnedIn className="text-slate-400" />
            <span>District Coverage Breakdown (Top 10 Districts)</span>
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtCoverage} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="district" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 10_000_000).toFixed(1)} Cr`}
                />
                <Tooltip
                  formatter={(val) => [`₹${val.toLocaleString()}`, "Disbursed"]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="allocated" name="Allocated" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
