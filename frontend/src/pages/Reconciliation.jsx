import React, { useState, useEffect } from 'react';
import { CompareArrows, Warning, DoneOutline, Refresh, FilterAlt } from '@mui/icons-material';
import api from '../services/api';
import { authService } from '../services/auth';

export default function Reconciliation() {
  const user = authService.getCurrentUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State and District filters
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(
    user?.role === 'State Admin' || user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.state || '' : ''
  );
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(
    user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.district || '' : ''
  );
  const [selectedFY, setSelectedFY] = useState('2024-25');

  const fetchReconciliation = async () => {
    setLoading(true);
    try {
      const params = {
        financial_year: selectedFY
      };
      if (selectedState) params.state = selectedState;
      if (selectedDistrict) params.district = selectedDistrict;
      const res = await api.get('/api/reconciliation', { params });
      setData(res.data);
      
      // Fetch available states and districts list dynamically
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
      console.error('Error fetching reconciliation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliation();
  }, [selectedState, selectedDistrict, selectedFY]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const { summary = [], total_allocated = 0, total_utilized = 0, mismatches_count = 0 } = data || {};
  const total_diff = total_allocated - total_utilized;

  return (
    <div className="space-y-6">
      
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <CompareArrows className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fund Reconciliation Scope</span>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
          >
            <option value="2024-25">FY 2024-25</option>
            <option value="2025-26">FY 2025-26</option>
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
              <div className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
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
            <div className="text-xs font-bold text-orange-500 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
              Locked District: {user.district}
            </div>
          )}

          <button
            onClick={fetchReconciliation}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors"
          >
            <Refresh fontSize="small" />
          </button>
        </div>
      </div>

      {/* Summary KPI Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Allocated</span>
          <h4 className="text-lg font-black text-slate-800 mt-1">₹{total_allocated.toLocaleString()}</h4>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Utilized</span>
          <h4 className="text-lg font-black text-slate-800 mt-1">₹{total_utilized.toLocaleString()}</h4>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Difference Gap</span>
          <h4 className={`text-lg font-black mt-1 ${total_diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            ₹{total_diff.toLocaleString()}
          </h4>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Integrity Mismatches</span>
          <h4 className={`text-lg font-black mt-1 flex items-center space-x-1.5 ${mismatches_count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {mismatches_count > 0 ? <Warning fontSize="small" /> : <DoneOutline fontSize="small" />}
            <span>{mismatches_count} Flagged</span>
          </h4>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 mb-4">Allocation vs Utilization Performance Matrix</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold">
                <th className="py-2.5">Scheme</th>
                <th className="py-2.5">District</th>
                <th className="py-2.5 text-right">Allocated (A)</th>
                <th className="py-2.5 text-right">Utilized (B)</th>
                <th className="py-2.5 text-right">Difference (A-B)</th>
                <th className="py-2.5 text-right">Burn Rate %</th>
                <th className="py-2.5 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px]">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No budget parameters registered for this scope.
                  </td>
                </tr>
              ) : (
                summary.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-800">{row.scheme_name}</td>
                    <td className="py-3 text-slate-600">{row.district}</td>
                    <td className="py-3 text-right font-medium text-slate-700">₹{row.allocated.toLocaleString()}</td>
                    <td className="py-3 text-right font-medium text-slate-700">₹{row.utilized.toLocaleString()}</td>
                    <td className={`py-3 text-right font-bold ${row.difference < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      ₹{row.difference.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-black text-slate-700">{row.utilization_percentage.toFixed(1)}%</td>
                    <td className="py-3 text-right">
                      {row.status === 'Overutilized' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-rose-50 border border-rose-200 text-rose-600 uppercase">Overspent</span>
                      )}
                      {row.status === 'Underutilized' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 border border-amber-200 text-amber-600 uppercase">Underspent</span>
                      )}
                      {row.status === 'Normal' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 uppercase">Balanced</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
