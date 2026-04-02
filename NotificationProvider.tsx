
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, Bell } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border-l-4 min-w-[300px] max-w-md
              animate-fade-in-up transform transition-all duration-300
              ${n.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : ''}
              ${n.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : ''}
              ${n.type === 'info' ? 'bg-sky-50 border-sky-500 text-sky-800' : ''}
              ${n.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' : ''}
            `}
          >
            <div className="flex-shrink-0">
              {n.type === 'success' && <CheckCircle size={20} />}
              {n.type === 'error' && <AlertCircle size={20} />}
              {n.type === 'info' && <Bell size={20} />}
              {n.type === 'warning' && <AlertCircle size={20} />}
            </div>
            <p className="flex-grow text-sm font-medium">{n.message}</p>
            <button
              onClick={() => removeNotification(n.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
