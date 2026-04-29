import React, { useState, useEffect } from 'react';
import { Description, CloudDownload, CalendarMonth, DateRange, Today, FilterList } from '@mui/icons-material';
import api from '../services/api';
import { authService } from '../services/auth';

export default function Reports() {
  const user = authService.getCurrentUser();
  const [downloading, setDownloading] = useState(null);
  
  // State and District filters
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(
    user?.role === 'State Admin' || user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.state || '' : ''
  );
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(
    user?.role === 'District Officer' || user?.role === 'Block Officer' ? user.district || '' : ''
  );

  useEffect(() => {
    const fetchFilters = async () => {
      try {
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
        console.error('Error fetching filters:', err);
      }
    };
    fetchFilters();
  }, [selectedState]);

  const handleDownload = async (reportType, format) => {
    const key = `${reportType}-${format}`;
    setDownloading(key);
    try {
      const params = { report_type: reportType, format };
      if (selectedState) params.state = selectedState;
      if (selectedDistrict) params.district = selectedDistrict;
      const response = await api.get('/api/reports', {
        params,
        responseType: 'blob' // Essential for receiving binary files
      });
      
      // Create local file pointer and trigger native save dialog
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const locSuffix = [selectedState, selectedDistrict].filter(Boolean).join('_');
      const filename = `gov_scheme_${reportType}_report${locSuffix ? '_' + locSuffix : ''}.${format}`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to generate report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const reportCards = [
    {
      type: 'daily',
      title: 'Daily Action Summary',
      description: 'Provides quick oversight of daily transactional uploads, validation warning triggers, and system database sync alerts.',
      icon: <Today className="text-orange-500 text-3xl" />,
    },
    {
      type: 'weekly',
      title: 'Weekly Performance Digest',
      description: 'Covers scheme enrollment trends over the past 7 days, district-wise budget burn rates, and reconciliation mismatch reports.',
      icon: <DateRange className="text-blue-500 text-3xl" />,
    },
    {
      type: 'monthly',
      title: 'Monthly Audited Performance Report',
      description: 'Full comprehensive review containing executive KPIs, district ranking performance matrices, error validation details, and advanced regression forecasts.',
      icon: <CalendarMonth className="text-emerald-500 text-3xl" />,
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 max-w-6xl">
        <div className="flex items-center space-x-2">
          <FilterList className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Report Generation Scope</span>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
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
        </div>
      </div>
      
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-5 text-xs flex items-start space-x-3 max-w-4xl">
        <Description className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">MIS Reporting Guidelines</span>
          All report downloads are tracked and logged in the system audit registry. PDF formats are optimized for printing and executive presentations, while Excel (.xlsx) sheets contain raw datasets and formula cells for custom calculations.
        </div>
      </div>

      {/* Reports Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl">
        {reportCards.map((card) => (
          <div key={card.type} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-96">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  {card.icon}
                </div>
                <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{card.type}</span>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 tracking-tight">{card.title}</h4>
                <p className="text-xs text-slate-400 leading-normal">{card.description}</p>
              </div>
            </div>

            {/* Downloader Trigger block */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleDownload(card.type, 'pdf')}
                disabled={downloading !== null}
                className="w-full bg-slate-900 hover:bg-orange-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-40"
              >
                <CloudDownload fontSize="inherit" />
                <span>{downloading === `${card.type}-pdf` ? 'GENERATING PDF...' : 'DOWNLOAD PDF REPORT'}</span>
              </button>

              <button
                onClick={() => handleDownload(card.type, 'xlsx')}
                disabled={downloading !== null}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-40"
              >
                <CloudDownload fontSize="inherit" />
                <span>{downloading === `${card.type}-xlsx` ? 'COMPILING EXCEL...' : 'DOWNLOAD EXCEL DATA'}</span>
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
