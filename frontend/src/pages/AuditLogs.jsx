import React, { useState, useEffect } from 'react';
import { History, Shield, Refresh, CheckCircleOutline } from '@mui/icons-material';
import api from '../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/audit-logs?limit=50');
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <History className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security and Operational Logs</span>
        </div>
        
        <button
          onClick={fetchLogs}
          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors"
        >
          <Refresh fontSize="small" />
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
          <Shield className="text-orange-500" fontSize="small" />
          <span>System Operation Trail</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold">
                <th className="py-2.5">ID</th>
                <th className="py-2.5">Timestamp</th>
                <th className="py-2.5">User ID</th>
                <th className="py-2.5">Action Executed</th>
                <th className="py-2.5">Details</th>
                <th className="py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No operations logged.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-mono text-slate-400">#{log.id}</td>
                    <td className="py-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-3 font-mono text-slate-600">User ID: {log.user_id || 'System'}</td>
                    <td className="py-3 font-bold text-slate-800">{log.action}</td>
                    <td className="py-3 text-slate-600 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center space-x-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircleOutline className="text-[10px]" />
                        <span className="text-[9px] font-bold uppercase">Success</span>
                      </span>
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
