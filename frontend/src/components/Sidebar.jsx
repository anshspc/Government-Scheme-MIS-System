import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import {
  Dashboard,
  Map,
  BarChart,
  CompareArrows,
  CloudUpload,
  Timeline,
  Description,
  History,
  ExitToApp,
  AccountCircle
} from '@mui/icons-material';

export default function Sidebar() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  
  if (!user) return null;

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // Define navigation items with role restrictions
  const menuItems = [
    {
      name: 'Executive Dashboard',
      path: '/',
      icon: <Dashboard />,
      roles: ['Super Admin', 'State Admin', 'District Officer', 'Block Officer', 'Data Entry Operator']
    },
    {
      name: 'District Analytics',
      path: '/districts',
      icon: <Map />,
      roles: ['Super Admin', 'State Admin', 'District Officer', 'Block Officer']
    },
    {
      name: 'Scheme Analytics',
      path: '/schemes',
      icon: <BarChart />,
      roles: ['Super Admin', 'State Admin', 'District Officer', 'Block Officer']
    },
    {
      name: 'Reconciliation',
      path: '/reconciliation',
      icon: <CompareArrows />,
      roles: ['Super Admin', 'State Admin']
    },
    {
      name: 'Data Import Engine',
      path: '/import',
      icon: <CloudUpload />,
      roles: ['Super Admin', 'Data Entry Operator']
    },
    {
      name: 'Advanced Forecasts',
      path: '/forecasts',
      icon: <Timeline />,
      roles: ['Super Admin', 'State Admin', 'District Officer']
    },
    {
      name: 'MIS Reports Center',
      path: '/reports',
      icon: <Description />,
      roles: ['Super Admin', 'State Admin', 'District Officer', 'Block Officer']
    },
    {
      name: 'System Audit Logs',
      path: '/audit-logs',
      icon: <History />,
      roles: ['Super Admin', 'State Admin']
    }
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen fixed left-0 top-0 z-20 shadow-xl border-r border-slate-800">
      {/* Brand Logo Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2 shadow-md">
          <span className="text-xl font-black text-white">GOV</span>
        </div>
        <h1 className="text-xs font-bold tracking-widest text-slate-400 uppercase">National MIS Portal</h1>
        <p className="text-[10px] text-orange-400 mt-1 font-semibold">Scheme Monitoring System</p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto space-y-1">
        {filteredMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            <span className="transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col space-y-3">
        <div className="flex items-center space-x-3">
          <AccountCircle className="text-slate-400 text-3xl" />
          <div className="truncate">
            <p className="text-xs font-bold text-slate-200 leading-tight">{user.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user.role}</p>
            {user.district && (
              <p className="text-[9px] text-orange-400 font-bold leading-none mt-0.5">{user.district}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-red-900 text-slate-200 hover:text-white py-2 rounded-md text-xs font-bold transition-colors duration-200"
        >
          <ExitToApp fontSize="small" />
          <span>SIGN OUT</span>
        </button>
      </div>
    </aside>
  );
}
