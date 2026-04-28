import React, { useState } from 'react';
import { CloudUpload, LibraryBooks, PlaylistPlay, CheckCircle, Warning, Error } from '@mui/icons-material';
import api from '../services/api';

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess(false);
    setLogs([]);
    setStats(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess(true);
      setLogs(res.data.logs || []);
      setStats(res.data.stats || null);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.detail?.message || 'Error occurred during ETL processing.');
      setLogs(err.response?.data?.detail?.logs || []);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = 
      "Aadhar,Full Name,Sex,Age,Dist Name,Block,Village,Scheme,Benefit,Date\n" +
      "500099990001,Rajesh Patel,Male,34,District 1,Block 1,Village 1,PM Kisan,2000,2024-05-12\n" +
      "500099990002,Sunita Sharma,Female,17,District 2,Block 6,Village 26,PMAY,120000,22/04/2025\n" + // Underage (rejected)
      "500000000001,Amit Verma,Male,45,District 1,Block 1,Village 1,PM-Kisan,2000,2024-06-01\n"; // Duplicate (rejected)
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "gov_scheme_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload module Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 space-y-4">
          <h4 className="text-sm font-bold text-slate-800">Source Spreadsheet Ingestion</h4>
          <p className="text-[11px] text-slate-400">Accepts standard structured spreadsheets for automatic parsing</p>

          <form onSubmit={handleUpload} className="space-y-4">
            
            {/* Drag & drop Container */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                dragActive ? 'border-orange-500 bg-orange-50/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
              }`}
            >
              <input
                type="file"
                id="file-upload-input"
                onChange={handleFileChange}
                accept=".csv, .xlsx"
                className="hidden"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer space-y-3 block">
                <CloudUpload className="text-slate-400 text-4xl block mx-auto" />
                <div className="text-xs">
                  <span className="font-bold text-slate-700">Choose file</span>
                  <span className="text-slate-400"> or drag & drop here</span>
                </div>
                <p className="text-[9px] text-slate-400">CSV or Excel XLSX (Max size: 10MB)</p>
              </label>
            </div>

            {file && (
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 truncate mr-2">{file.name}</span>
                <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || loading}
              className="w-full bg-slate-900 hover:bg-orange-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'PROCESSING ETL PIPELINE...' : 'EXECUTE IMPORT PIPELINE'}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 text-center">
            <button
              onClick={handleDownloadTemplate}
              className="text-[10px] font-bold text-orange-500 hover:underline flex items-center justify-center space-x-1.5 mx-auto"
            >
              <LibraryBooks fontSize="inherit" />
              <span>DOWNLOAD TEST TEMPLATE CSV</span>
            </button>
          </div>

        </div>

        {/* Processing Logs Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <PlaylistPlay className="text-slate-400" />
              <span>ETL Execution Logs & Validation Summary</span>
            </h4>
            {success && <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Pipeline Finished</span>}
            {error && <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">Pipeline Failed</span>}
          </div>

          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Imported</span>
                <span className="text-sm font-black text-emerald-600 flex items-center justify-center space-x-1">
                  <CheckCircle fontSize="inherit" />
                  <span>{stats.success_count}</span>
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Rejected</span>
                <span className="text-sm font-black text-rose-600 flex items-center justify-center space-x-1">
                  <Error fontSize="inherit" />
                  <span>{stats.error_count}</span>
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Duplicates</span>
                <span className="text-sm font-black text-amber-600 flex items-center justify-center space-x-1">
                  <Warning fontSize="inherit" />
                  <span>{stats.duplicate_count}</span>
                </span>
              </div>
            </div>
          )}

          {/* Logs scrollbox */}
          <div className="h-72 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-300 overflow-y-auto space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-24 italic">
                Ready for ingestion. Upload a file to view automated parsing logs.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-900 pb-1 leading-normal">
                  <span className="text-orange-500 font-bold mr-1.5">[$]</span>
                  <span>{log}</span>
                </div>
              ))
            )}
            
            {stats?.warnings?.map((warning, idx) => (
              <div key={`w-${idx}`} className="text-rose-400 border-b border-slate-900 pb-1 leading-normal">
                <span className="text-rose-500 font-black mr-1.5">[!]</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
