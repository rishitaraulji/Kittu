import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Bell, Shield, LogOut, ChevronRight, Heart, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { connectPartnerByCode, disconnectPartner } from '../../services/UserService';

const Profile = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, partnerName } = useAuth();
  
  const [partnerInput, setPartnerInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (userProfile?.connectionCode) {
      navigator.clipboard.writeText(userProfile.connectionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectPartner = async () => {
    if (partnerInput.trim().length === 0 || !currentUser) return;
    setLoading(true);
    setError('');
    try {
      await connectPartnerByCode(currentUser.uid, partnerInput.trim());
      setPartnerInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser || !userProfile?.partnerId) return;
    if (window.confirm("Are you sure you want to disconnect?")) {
      setLoading(true);
      try {
        await disconnectPartner(currentUser.uid, userProfile.partnerId);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { icon: Settings, label: 'Account Settings', sub: 'Privacy, Security, Change Password', color: 'text-accent-primary', bg: 'bg-accent-primary/10' },
    { icon: Bell, label: 'Notifications', sub: 'Push alerts, Sounds, Vibrate', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { icon: Shield, label: 'Emergency Contact', sub: 'Manage SOS contacts', color: 'text-red-400', bg: 'bg-red-400/10' },
  ];

  return (
    <div className="min-h-full bg-bg-primary pb-24">
      <div className="pt-10 pb-6 px-5 text-center bg-gradient-to-b from-accent-primary/10 to-transparent">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative inline-block mb-3"
        >
          <div className="w-24 h-24 rounded-full border-4 border-accent-primary shadow-glow-strong bg-bg-card overflow-hidden flex items-center justify-center text-4xl">
            👨
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent-primary text-white flex items-center justify-center shadow-lg border-2 border-bg-primary">
            <Settings className="w-4 h-4" />
          </button>
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-1">{userProfile?.displayName || currentUser?.displayName || 'Loading...'}</h2>
        <p className="text-[13px] text-text-muted">{currentUser?.email}</p>
        
        {userProfile && !userProfile.partnerId && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-[12px] text-text-soft">Your Code:</span>
            <span className="font-mono text-accent-primary bg-accent-primary/10 px-2 py-1 rounded tracking-wider">{userProfile.connectionCode}</span>
            <button onClick={copyCode} className="p-1.5 bg-white/5 rounded-md hover:bg-white/10 transition">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-text-muted" />}
            </button>
          </div>
        )}
      </div>

      <div className="px-5">
        <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-3 pl-1">Connection</h3>
        
        {userProfile?.partnerId ? (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-accent-primary/10 to-purple-500/5 border border-accent-primary/25 rounded-2xl p-4 flex items-center gap-4 mb-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Heart className="w-24 h-24" />
            </div>
            <Heart className="w-10 h-10 text-accent-primary drop-shadow-[0_0_10px_rgba(255,45,111,0.5)] shrink-0" />
            <div className="flex-1 relative z-10">
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">Connected with</p>
              <p className="text-[16px] font-semibold text-white">{partnerName || 'Your Partner'}</p>
              <p className="text-[11px] text-accent-secondary mt-0.5">Securely linked</p>
            </div>
            <button 
              disabled={loading}
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-[12px] font-medium text-red-400 backdrop-blur-md relative z-10 disabled:opacity-50"
            >
              Disconnect
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-glass-bg border border-accent-primary/20 rounded-2xl p-5 mb-6 relative overflow-hidden"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-accent-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-white">Find Your Partner</p>
                  <p className="text-[11px] text-text-muted">Enter their connection code below</p>
                </div>
              </div>
              
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g. A1B2C3"
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-accent-primary outline-none transition-colors uppercase"
                />
                <button 
                  disabled={loading || !partnerInput}
                  onClick={handleConnectPartner}
                  className="px-5 py-2 bg-accent-primary rounded-xl text-white text-sm font-semibold hover:bg-accent-secondary transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : 'Connect'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-3 pl-1">Settings</h3>
        
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[12px] rounded-xl text-center"
          >
            {toastMsg}
          </motion.div>
        )}

        <div className="flex flex-col gap-2 mb-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button 
                key={index}
                onClick={() => {
                  setToastMsg(`${item.label} will be available in the next update!`);
                  setTimeout(() => setToastMsg(''), 3000);
                }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4 bg-glass-bg border border-accent-primary/10 rounded-2xl active:scale-95 transition-all hover:bg-accent-primary/5 hover:border-accent-primary/20 text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-white mb-0.5">{item.label}</p>
                  <p className="text-[12px] text-text-muted">{item.sub}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted" />
              </motion.button>
            );
          })}
        </div>

        <button 
          onClick={handleSignOut}
          className="w-full py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 mb-4"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
