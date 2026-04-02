import React, { useState } from 'react';
import { X, Mail, Lock, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
  onLogin: (email: string) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onLogin(email);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60] animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-neutral">Welcome Back!</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
        </div>
        <p className="text-gray-500">Sign in to sync your trip details.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 ${errors.email ? 'text-red-400' : 'text-gray-400'}`} size={20} />
              <input 
                type="email" 
                id="email" 
                value={email} 
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }} 
                placeholder="you@example.com" 
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 transition ${
                  errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-base-300 focus:ring-primary focus:border-primary'
                }`} 
                required
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password_modal" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 ${errors.password ? 'text-red-400' : 'text-gray-400'}`} size={20} />
              <input 
                type="password" 
                id="password_modal" 
                value={password} 
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }} 
                placeholder="••••••••" 
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 transition ${
                  errors.password ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-base-300 focus:ring-primary focus:border-primary'
                }`}
                required
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.password}
              </p>
            )}
          </div>
          <div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors">
              Sign In
            </button>
          </div>
        </form>
        <p className="text-center text-xs text-gray-400">
          Mock login: Use any valid email and 6+ char password.
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
