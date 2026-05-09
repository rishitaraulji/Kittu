import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Lock, Heart, User } from 'lucide-react';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav on splash and auth screens
  if (['/', '/login', '/register'].includes(location.pathname)) {
    return null;
  }

  const navItems = [
    { id: '/home', icon: Home, label: 'Home' },
    { id: '/secrets', icon: Lock, label: 'Secrets' },
    { id: '/mood', icon: Heart, label: 'Mood' },
    { id: '/profile', icon: User, label: 'Profile' }
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[200] flex bg-[#0d0d1a]/95 backdrop-blur-xl border-t border-accent-primary/15 pb-[env(safe-area-inset-bottom,8px)] pt-2 px-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={`flex-1 flex flex-col items-center gap-1 p-2 transition-all duration-300 ${isActive ? 'text-accent-primary' : 'text-text-muted hover:text-text-soft'}`}
          >
            <Icon className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'scale-110 drop-shadow-[0_0_6px_#ff2d6f]' : ''}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;
