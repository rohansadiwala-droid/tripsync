
import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { Plane, Wallet, UserCircle, LogOut, ClipboardList } from 'lucide-react';
import ItineraryPlanner from './components/ItineraryPlanner';
import ExpenseSplitter from './components/ExpenseSplitter';
import LoginModal from './components/LoginModal';
import SharedLists from './components/SharedLists';
import type { Itinerary, User, TodoItem } from './types';

interface HeaderProps {
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLoginClick, onLogoutClick }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="bg-primary text-primary-content shadow-lg w-full sticky top-0 z-50">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">TripSync</h1>
            <p className="hidden md:block text-sm opacity-80 -mt-1">AI Itinerary & Group Expenses</p>
          </div>
          {!isOnline && (
            <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              <WifiOff size={14} />
              <span>OFFLINE MODE</span>
            </div>
          )}
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="font-semibold hidden sm:inline">Welcome, {user.name}!</span>
            <button 
              onClick={onLogoutClick}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-white"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        ) : (
          <button 
            onClick={onLoginClick}
            className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-white"
          >
            <UserCircle size={20} />
            <span className="hidden sm:inline">Login / Sign Up</span>
          </button>
        )}
      </div>
    </header>
  );
};

const NavLink: React.FC<{path: string, label: string, icon: React.ElementType}> = ({ path, label, icon: Icon }) => {
  const location = useLocation();
  const isActive = location.pathname === path;
  return (
    <Link
      to={path}
      className={`flex flex-col items-center justify-center p-3 text-sm font-medium transition-colors duration-200 md:flex-row md:w-full md:justify-start md:gap-3 md:px-4 md:py-3 md:rounded-lg ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-slate-600 hover:bg-base-200 hover:text-primary'
      }`}
    >
      <Icon size={22} />
      <span className="md:inline">{label}</span>
    </Link>
  );
};

const Navigation: React.FC = () => {
  const navItems = [
    { path: '/', label: 'Plan Trip', icon: Plane },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
  ];
  const listNavItem = { path: '/lists', label: 'Lists', icon: ClipboardList };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] md:relative md:shadow-none md:bg-transparent md:h-full">
      {/* Mobile Nav */}
      <div className="container mx-auto flex justify-around md:hidden">
        {[...navItems, listNavItem].map((item) => (
          <NavLink key={item.path} {...item} />
        ))}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-col md:h-full">
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavLink key={item.path} {...item} />
          ))}
        </div>
        <div className="mt-auto">
          <NavLink {...listNavItem} />
        </div>
      </div>
    </nav>
  );
};

function AppContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const { showNotification } = useNotification();
  const [todoItems, setTodoItems] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('tripSyncTodoItems');
      return saved ? JSON.parse(saved) as TodoItem[] : [];
    } catch (error) {
      console.error("Failed to parse to-do items from localStorage", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tripSyncTodoItems', JSON.stringify(todoItems));
    } catch (error) {
      console.error("Failed to save to-do items to localStorage", error);
    }
  }, [todoItems]);


  const handleLogin = (email: string) => {
    const name = email.split('@')[0];
    setCurrentUser({ name: name.charAt(0).toUpperCase() + name.slice(1) });
    setIsLoginModalOpen(false);
    showNotification(`Welcome back, ${name}!`, 'success');
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    showNotification('Logged out successfully', 'info');
  };

  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-neutral">
      <Header 
        user={currentUser} 
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
      />
      <div className="flex flex-col md:flex-row flex-grow container mx-auto">
        <aside className="hidden md:block md:w-64 p-4">
          <Navigation />
        </aside>
        <main className="flex-grow p-4 pb-24 md:pb-4">
          <Routes>
            <Route path="/" element={<ItineraryPlanner itinerary={itinerary} setItinerary={setItinerary} />} />
            <Route path="/expenses" element={<ExpenseSplitter />} />
            <Route path="/lists" element={<SharedLists items={todoItems} setItems={setTodoItems} itinerary={itinerary} />} />
          </Routes>
        </main>
      </div>
      <div className="md:hidden">
        <Navigation />
      </div>

      {isLoginModalOpen && (
        <LoginModal 
          onClose={() => setIsLoginModalOpen(false)} 
          onLogin={handleLogin}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
