// src/components/Sidebar.jsx

import React, { useState, useEffect } from 'react';
import { 
  FiPackage, FiDollarSign, FiFileText, FiBarChart2, 
  FiChevronDown, FiChevronUp, FiList, FiPieChart, 
  FiTrendingUp, FiHome, FiBell, FiUser, FiUsers, 
  FiLogOut, FiCreditCard, FiClock, FiSettings, FiCalendar,
  FiBriefcase, FiRotateCcw
} from 'react-icons/fi';
import { HiMenu, HiX } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ✅ darkMode prop is still accepted (so parent code doesn't break) but the sidebar ALWAYS stays dark
// eslint-disable-next-line no-unused-vars
const Sidebar = ({ activeMenu, setActiveMenu, isOpen, setIsOpen, darkMode }) => {
  const [logoExists, setLogoExists] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [reminderCount, setReminderCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Admin menu items
  const adminMenuItems = [
    { id: 'all-data', label: 'Dashboard', icon: FiHome, path: '/dashboard' },
    { id: 'inventory', label: 'Inventory', icon: FiPackage, path: '/inventory' },
    { id: 'inventory-history', label: 'Inventory History', icon: FiRotateCcw, path: '/inventory-history' },
    { id: 'cash-in-hand', label: 'Owner Capital', icon: FiBriefcase, path: '/cash-in-hand' },
    { id: 'finance', label: 'Finance', icon: FiDollarSign, hasSubmenu: true },
    { id: 'billing', label: 'Billing', icon: FiFileText, path: '/billing' },
    { id: 'payment', label: 'Payment', icon: FiCreditCard, path: '/payment' },
    { id: 'reminders', label: 'Reminders', icon: FiBell, path: '/reminders', badge: reminderCount },
    { id: 'discarded', label: 'Draft', icon: FiClock, path: '/discarded', badge: discardedCount },
    { id: 'record', label: 'Records', icon: FiBarChart2, path: '/records' },
    { id: 'leave', label: 'Leave', icon: FiCalendar, path: '/leave' },
    { id: 'users', label: 'Users', icon: FiUsers, path: '/users' },
  ];

  // Employee menu items
  const employeeMenuItems = [
    { id: 'inventory', label: 'Inventory', icon: FiPackage, path: '/inventory' },
    { id: 'billing', label: 'Billing', icon: FiFileText, path: '/billing' },
    { id: 'reminders', label: 'Reminders', icon: FiBell, path: '/reminders', badge: reminderCount },
    { id: 'discarded', label: 'Discarded', icon: FiClock, path: '/discarded', badge: discardedCount },
    { id: 'leave', label: 'Leave', icon: FiCalendar, path: '/leave' },
  ];

  // Finance Submenu
  const financeSubmenu = [
    { id: 'finance-overview', label: 'Overview', icon: FiTrendingUp, path: '/finance' },
    { id: 'finance-expenses', label: 'Expenses', icon: FiList, path: '/finance-expenses' },
    { id: 'finance-charts', label: 'Charts', icon: FiPieChart, path: '/finance-charts' },
    { id: 'finance-credit', label: 'Credit', icon: FiCreditCard, path: '/finance-credit' },
  ];

  // Fetch user data
  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const response = await api.get('/me');
      if (response.data?.user) {
        setUser(response.data.user);
        setIsAdmin(response.data.user.is_admin || response.data.user.role === 'admin');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    }
  };

  // Fetch reminder count
  const fetchReminderCount = async () => {
    try {
      const birthdayRes = await api.get('/birthday-reminders/today');
      const birthdayCount = birthdayRes.data.birthday_customers?.length || 0;
      
      const serviceRes = await api.get('/service-reminders/all');
      const tuningCount = serviceRes.data.tuning?.length || 0;
      const oilChangeCount = serviceRes.data.oil_change?.length || 0;
      
      const total = birthdayCount + tuningCount + oilChangeCount;
      setReminderCount(total);
    } catch (error) {
      console.error('Error fetching reminder count:', error);
    }
  };

  // Fetch discarded count
  const fetchDiscardedCount = async () => {
    try {
      const response = await api.get('/saved-carts/count');
      if (response.data?.success) {
        setDiscardedCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching discarded count:', error);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Check window size for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024 && isOpen) {
        setIsOpen(false);
      }
      if (window.innerWidth >= 1024 && !isOpen) {
        setIsOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, setIsOpen]);

  // Logo check
  useEffect(() => {
    const img = new Image();
    img.src = '/change.png';
    img.onload = () => setLogoExists(true);
    img.onerror = () => setLogoExists(false);
  }, []);

  // Fetch user data and counts on mount
  useEffect(() => {
    fetchUserData();
    fetchReminderCount();
    fetchDiscardedCount();
    
    const reminderInterval = setInterval(fetchReminderCount, 60000);
    const discardedInterval = setInterval(fetchDiscardedCount, 30000);
    
    const handleReminderUpdate = () => {
      fetchReminderCount();
    };
    window.addEventListener('reminder-update', handleReminderUpdate);
    
    const handleDiscardedUpdate = () => {
      fetchDiscardedCount();
    };
    window.addEventListener('discarded-update', handleDiscardedUpdate);
    
    return () => {
      clearInterval(reminderInterval);
      clearInterval(discardedInterval);
      window.removeEventListener('reminder-update', handleReminderUpdate);
      window.removeEventListener('discarded-update', handleDiscardedUpdate);
    };
  }, []);

  const isFinanceActive = () => {
    return financeSubmenu.some(item => item.id === activeMenu);
  };

  useEffect(() => {
    if (isFinanceActive()) {
      setIsFinanceOpen(true);
    }
  }, [activeMenu]);

  const handleMenuClick = (item) => {
    if (item.hasSubmenu) {
      setIsFinanceOpen(!isFinanceOpen);
      if (!isFinanceOpen && !isFinanceActive()) {
        setActiveMenu('finance-overview');
      }
    } else {
      setActiveMenu(item.id);
      if (item.path) {
        navigate(item.path);
      }
      if (isMobile) {
        setIsOpen(false);
      }
    }
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const allMenuItems = isAdmin ? adminMenuItems : employeeMenuItems;

  // ✅ FIXED DARK THEME - sidebar never changes with the theme toggle
  const sidebarBg = 'bg-gray-900';
  const sidebarBorder = 'border-gray-800';
  const textColor = 'text-white';
  const textMuted = 'text-gray-400';
  const hoverBg = 'hover:bg-gray-800';
  const activeBg = 'bg-amber-500/20';
  const activeText = 'text-amber-500';
  const dividerColor = 'border-gray-800';

  return (
    <>
      {/* Sidebar */}
      <div className={`
        fixed lg:relative z-40 ${sidebarBg} shadow-2xl transition-all duration-300 h-full flex flex-col
        ${isOpen ? 'w-72' : 'w-20'}
        ${isMobile && isOpen ? 'left-0' : isMobile && !isOpen ? '-left-72' : ''}
        border-r ${sidebarBorder}
      `}>
        {/* Logo Section - Full Width */}
        <div className={`pt-4 pb-3 border-b ${dividerColor} ${sidebarBg} flex justify-center`}>
          <div className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${sidebarBg} ${isOpen ? 'w-full h-28' : 'w-12 h-12 rounded-full mx-auto'}`}>
            {logoExists ? (
              <img 
                src="/change.png" 
                alt="Fusix Logo" 
                className="w-full h-full object-contain" 
              />
            ) : (
              <span className="text-3xl text-white">❄️</span>
            )}
          </div>
        </div>

        {/* Menu Section - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {allMenuItems.map((item) => {
            const Icon = item.icon;
            const isFinanceMenuItem = item.id === 'finance';
            const isActive = activeMenu === item.id || (isFinanceMenuItem && isFinanceActive());
            const showBadge = item.badge > 0;
            
            return (
              <div key={item.id} className="relative">
                <button
                  onClick={() => handleMenuClick(item)}
                  className={`w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl mb-1 transition-all duration-300 ${
                    isActive
                      ? `${activeBg} ${activeText}`
                      : `${textMuted} ${hoverBg}`
                  } ${!isOpen ? 'justify-center' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <Icon className={`text-2xl shrink-0 ${isActive ? activeText : ''}`} />
                    {isOpen && <span className={`font-bold ${isActive ? activeText : textColor}`}>{item.label}</span>}
                  </div>
                  {isOpen && (
                    <div className="flex items-center gap-2">
                      {showBadge && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ${
                          item.id === 'discarded' 
                            ? 'bg-yellow-500 text-white' 
                            : 'bg-red-500 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      {item.hasSubmenu && (
                        <span className={textMuted}>
                          {isFinanceOpen ? <FiChevronUp className="text-sm" /> : <FiChevronDown className="text-sm" />}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Badge show when sidebar is closed */}
                  {!isOpen && showBadge && (
                    <span className={`absolute -right-1 -top-1 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      item.id === 'discarded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
                
                {/* Finance Submenu - Admin only */}
                {isOpen && isAdmin && item.hasSubmenu && isFinanceOpen && (
                  <div className="ml-8 mt-1 mb-2 space-y-1">
                    {financeSubmenu.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeMenu === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          onClick={() => {
                            setActiveMenu(subItem.id);
                            if (subItem.path) {
                              navigate(subItem.path);
                            }
                            if (isMobile) {
                              setIsOpen(false);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-300 font-bold ${
                            isSubActive
                              ? `${activeBg} ${activeText}`
                              : `${textMuted} ${hoverBg}`
                          }`}
                        >
                          <SubIcon className={`text-base ${isSubActive ? activeText : ''}`} />
                          <span>{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Profile Section - Bottom */}
        <div className={`border-t ${dividerColor}`}>
          {isOpen ? (
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500/20">
                  <FiUser className="text-xl text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm truncate ${textColor}`}>{user?.name || 'User'}</p>
                  <p className="text-xs truncate flex items-center gap-1">
                    {user?.role === 'admin' ? (
                      <span className="text-amber-500 font-bold">👑 Admin</span>
                    ) : (
                      <span className="text-blue-400 font-bold">👤 Employee</span>
                    )}
                  </p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-lg transition flex-shrink-0 hover:bg-amber-500/20 text-gray-400 hover:text-amber-400"
                  title="Logout"
                >
                  <FiLogOut className="text-lg" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 flex justify-center">
              <div className="relative group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/20">
                  <FiUser className="text-xl text-amber-400" />
                </div>
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap bg-gray-800">
                  {user?.name || 'User'} ({user?.role || 'employee'})
                </div>
                <button 
                  onClick={handleLogout}
                  className="absolute inset-0 rounded-full hover:bg-amber-500/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <FiLogOut className="text-amber-400 text-sm" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Toggle Button */}
      <button 
        onClick={toggleSidebar} 
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl text-white shadow-lg transition-all duration-300 bg-gray-900 hover:bg-gray-800"
        style={{ 
          left: isOpen ? '260px' : '16px',
          transition: 'left 0.3s ease'
        }}
      >
        {isOpen ? <HiX className="text-xl" /> : <HiMenu className="text-xl" />}
      </button>

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 z-30 lg:hidden bg-black/60"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;