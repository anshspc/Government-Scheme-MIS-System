import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Notifications, HelpOutline, Warning, CalendarToday } from '@mui/icons-material';
import api from '../services/api';
import { authService } from '../services/auth';

export default function Navbar() {
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Derive page titles
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Executive MIS Dashboard';
      case '/districts':
        return 'District Analytics & Rankings';
      case '/schemes':
        return 'Scheme Coverage & Performance';
      case '/reconciliation':
        return 'Fund Reconciliation Engine';
      case '/import':
        return 'ETL Data Ingestion System';
      case '/forecasts':
        return 'Advanced Forecasting & Regression';
      case '/reports':
        return 'Automated MIS Reports';
      case '/audit-logs':
        return 'System Audit Logs';
      default:
        return 'Government Scheme Portal';
    }
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!authService.isAuthenticated()) return;
      try {
        const response = await api.get('/api/notifications?limit=8');
        setNotifications(response.data);
      } catch (err) {
        console.error('Error fetching alerts:', err);
      }
    };

    fetchNotifications();
    
    // Poll alerts every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 fixed top-0 right-0 left-64 z-10 shadow-sm">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">{getPageTitle()}</h2>
        <p className="text-[10px] text-slate-500 font-medium">National Welfare Scheme Oversight Platform</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center space-x-6">
        {/* Date Display */}
        <div className="hidden lg:flex items-center space-x-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <CalendarToday fontSize="inherit" className="text-orange-500" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>

        {/* Notifications Icon and Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 text-slate-600 hover:text-orange-500 hover:bg-slate-100 rounded-full transition-all duration-200 relative"
          >
            <Notifications className="text-xl" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4.5 h-4.5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-black border border-white animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Alert Dropdown list */}
          {showDropdown && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden transform origin-top-right transition-all">
              <div className="bg-slate-900 px-4 py-3 text-white flex justify-between items-center">
                <span className="text-xs font-black tracking-wide uppercase">Integrity Failures ({notifications.length})</span>
                <span className="text-[10px] text-orange-400 font-bold">REAL-TIME</span>
              </div>
              
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active validation errors or utilization warnings found.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.error_id} className="p-3.5 hover:bg-red-50/50 flex space-x-2.5 transition-colors">
                      <Warning className="text-red-500 text-lg flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">{n.error_type}</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">{n.description}</p>
                        <span className="text-[9px] text-slate-400 mt-1 block">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="bg-slate-50 text-center py-2 border-t border-slate-100">
                <a href="/audit-logs" className="text-[10px] font-bold text-orange-500 hover:text-orange-600 hover:underline">
                  VIEW FULL SYSTEM AUDIT
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Documentation Helper */}
        <button className="p-2 text-slate-600 hover:text-orange-500 hover:bg-slate-100 rounded-full transition-all duration-200 hidden md:block">
          <HelpOutline className="text-xl" />
        </button>
      </div>
    </header>
  );
}
