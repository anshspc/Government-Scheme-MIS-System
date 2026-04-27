import React, { useState, useEffect } from 'react';
import { Map, ArrowUpward, ArrowDownward, Search, FilterList, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import api from '../services/api';
import { authService } from '../services/auth';

export default function DistrictAnalytics() {
  const user = authService.getCurrentUser();
  const [analytics, setAnalytics] = useState(null);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [districtList, setDistrictList] = useState([]);
  
  // Filtering & Pagination State
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(
    user?.role === 'State Admin' || user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.state || '' : ''
  );
  const [selectedDistrict, setSelectedDistrict] = useState(
    user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.district : ''
  );
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [villages, setVillages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchDistrictData = async () => {
    setLoading(true);
    try {
      // 1. Fetch performance stats
      const params = {};
      if (selectedState) params.state = selectedState;
      const aRes = await api.get('/api/analytics', { params });
      setAnalytics(aRes.data);
      
      if (aRes.data?.states) {
        setStates(aRes.data.states);
      }
      
      const distRankings = aRes.data?.district_rankings || [];
      const distNames = distRankings.map(d => d.district);
      setDistrictList(distNames);
      
      // If we don't have selected district set and have list, default to first one
      if (!selectedDistrict && distNames.length > 0) {
        setSelectedDistrict(distNames[0]);
      } else if (distNames.length > 0 && !distNames.includes(selectedDistrict)) {
        setSelectedDistrict(distNames[0]);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchBeneficiaryData = async () => {
    try {
      const params = {
        page,
        limit: 15,
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        block: selectedBlock || undefined,
        village: selectedVillage || undefined,
        search: searchTerm || undefined
      };
      const res = await api.get('/api/beneficiaries', { params });
      setBeneficiaries(res.data.results);
      setTotalCount(res.data.total);
      setTotalPages(Math.ceil(res.data.total / 15));
      
      // Build dynamic block filter list
      if (res.data.filters_data?.blocks) {
        setBlocks(res.data.filters_data.blocks);
      }
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistrictData();
  }, [selectedState]);

  useEffect(() => {
    setPage(1);
    fetchBeneficiaryData();
  }, [selectedState, selectedDistrict, selectedBlock, selectedVillage, searchTerm]);

  useEffect(() => {
    fetchBeneficiaryData();
  }, [page]);

  const rankings = analytics?.district_rankings || [];
  
  // Calculate top & bottom performers
  const topPerformers = rankings.slice(0, 3);
  const bottomPerformers = [...rankings].reverse().slice(0, 3);

  // Status mapping
  const getStatusBadge = (pct) => {
    if (pct > 100) return <span className="px-2.5 py-1 text-[9px] font-black rounded-full bg-rose-50 border border-rose-200 text-rose-600 uppercase">Overutilized</span>;
    if (pct < 70) return <span className="px-2.5 py-1 text-[9px] font-black rounded-full bg-amber-50 border border-amber-200 text-amber-600 uppercase">Underutilized</span>;
    return <span className="px-2.5 py-1 text-[9px] font-black rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 uppercase">Healthy</span>;
  };

  return (
    <div className="space-y-6">
      
      {/* Filter Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <FilterList className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analytics Scope</span>
        </div>
        
        <div className="flex items-center space-y-0 space-x-3 w-full sm:w-auto">
          {user?.role === 'Super Admin' ? (
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict(''); // Reset district selection
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
        </div>
      </div>
      
      {/* Top vs Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowUpward fontSize="large" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Top Performing Districts</span>
            <div className="space-y-2">
              {topPerformers.map((d, index) => (
                <div key={d.district} className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-50 pb-1.5">
                  <span className="font-bold text-slate-800">{index + 1}. {d.district}</span>
                  <span className="font-black text-emerald-600">{d.percentage.toFixed(2)}% utilization</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Underperforming */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ArrowDownward fontSize="large" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Lowest Performing Districts</span>
            <div className="space-y-2">
              {bottomPerformers.map((d, index) => (
                <div key={d.district} className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-50 pb-1.5">
                  <span className="font-bold text-slate-800">{index + 1}. {d.district}</span>
                  <span className="font-black text-rose-600">{d.percentage.toFixed(2)}% utilization</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* District Rankings Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm xl:col-span-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Map className="text-slate-400" />
              <span>All District Rankings</span>
            </h4>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">{rankings.length} Districts</span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold">
                  <th className="py-2.5">Rank</th>
                  <th className="py-2.5">District</th>
                  <th className="py-2.5 text-right">Util %</th>
                  <th className="py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rankings.map((r, index) => (
                  <tr
                    key={r.district}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedDistrict === r.district ? 'bg-orange-50/50 font-bold' : ''}`}
                    onClick={() => setSelectedDistrict(r.district)}
                  >
                    <td className="py-3 text-slate-500">{index + 1}</td>
                    <td className="py-3 text-slate-800 font-semibold">{r.district}</td>
                    <td className="py-3 text-right font-black text-slate-700">{r.percentage.toFixed(1)}%</td>
                    <td className="py-3 text-right">{getStatusBadge(r.percentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drill Down Beneficiaries list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm xl:col-span-2 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Beneficiary Register: {selectedDistrict}</h4>
              <p className="text-[10px] text-slate-400 font-medium">Drill through records using search and block filters</p>
            </div>
            
            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search name or Aadhaar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Block</span>
              <select
                value={selectedBlock}
                onChange={(e) => {
                  setSelectedBlock(e.target.value);
                  setSelectedVillage('');
                }}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Village</span>
              <input
                type="text"
                placeholder="e.g. Village 15"
                value={selectedVillage}
                onChange={(e) => setSelectedVillage(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold">
                  <th className="py-2.5">Aadhaar</th>
                  <th className="py-2.5">Beneficiary Name</th>
                  <th className="py-2.5">Block / Village</th>
                  <th className="py-2.5">Scheme</th>
                  <th className="py-2.5 text-right">Received</th>
                  <th className="py-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[11px]">
                {beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                      No matching beneficiary records found.
                    </td>
                  </tr>
                ) : (
                  beneficiaries.map((b) => (
                    <tr key={b.beneficiary_id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-mono text-slate-500">xxxx-xxxx-{b.aadhaar_number.slice(-4)}</td>
                      <td className="py-3 font-semibold text-slate-800">{b.name}</td>
                      <td className="py-3 text-slate-600">{b.block} / {b.village}</td>
                      <td className="py-3 text-slate-700 font-medium">
                        {b.scheme_id === 1 ? 'PM Kisan' : b.scheme_id === 2 ? 'PMAY' : b.scheme_id === 3 ? 'MGNREGA' : b.scheme_id === 4 ? 'Jal Jeevan' : 'Ayushman'}
                      </td>
                      <td className="py-3 text-right font-bold text-slate-700">₹{b.amount_received.toLocaleString()}</td>
                      <td className="py-3 text-right text-slate-400">{b.enrollment_date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
              <span>Showing Page {page} of {totalPages} ({totalCount} total records)</span>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <KeyboardArrowLeft fontSize="small" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <KeyboardArrowRight fontSize="small" />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
