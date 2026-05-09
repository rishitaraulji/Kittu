import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const Secrets = () => {
  const { partnerName } = useAuth();
  const displayPartner = partnerName || 'Your Partner';

  const [secrets, setSecrets] = useState([
    { id: 1, type: 'romantic', text: 'I still get butterflies every time your name pops up on my phone...', sender: displayPartner, time: '2h ago', blurred: false },
    { id: 2, type: 'wish', text: 'I wish we could just cuddle and watch movies all day today.', sender: displayPartner, time: 'Yesterday', blurred: false },
    { id: 3, type: 'thought', text: 'Sometimes I wonder what our future house will look like.', sender: 'You', time: '2 days ago', blurred: false },
  ]);

  const toggleBlur = (id: number) => {
    setSecrets(secrets.map(s => s.id === id ? { ...s, blurred: !s.blurred } : s));
  };

  const getTagStyle = (type: string) => {
    switch(type) {
      case 'romantic': return { bg: 'bg-accent-primary/15', text: 'text-accent-primary', border: 'border-accent-primary' };
      case 'funny': return { bg: 'bg-yellow-500/15', text: 'text-yellow-500', border: 'border-yellow-500' };
      case 'dream': return { bg: 'bg-blue-400/15', text: 'text-blue-400', border: 'border-blue-400' };
      case 'wish': return { bg: 'bg-emerald-400/15', text: 'text-emerald-400', border: 'border-emerald-400' };
      case 'thought': return { bg: 'bg-purple-500/15', text: 'text-purple-500', border: 'border-purple-500' };
      default: return { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500' };
    }
  };

  return (
    <div className="min-h-full bg-bg-primary pb-24">
      <div className="sticky top-0 z-10 p-5 pt-6 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-accent-primary/10">
        <h2 className="text-xl font-bold text-white mb-1">Secret Notes 🤫</h2>
        <p className="text-[13px] text-text-muted">Tap a message to reveal</p>
      </div>

      <div className="p-5">
        {secrets.map((secret, index) => {
          const style = getTagStyle(secret.type);
          
          return (
            <motion.div 
              key={secret.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => toggleBlur(secret.id)}
              className="glass-card mb-3.5 relative overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[3px] ${style.bg.replace('/15', '')}`}></div>
              
              <div className="flex items-center justify-between mb-2.5 pl-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
                  #{secret.type}
                </span>
                <span className="text-[11px] text-text-muted">{secret.time}</span>
              </div>
              
              <p className={`text-[14px] leading-relaxed transition-all duration-300 pl-1 select-none ${secret.blurred ? 'blur-sm text-text-soft opacity-80' : 'text-text-primary'}`}>
                {secret.text}
              </p>
              
              <div className="flex items-center justify-between mt-3 pl-1">
                <span className="text-[12px] text-text-muted">From: {secret.sender}</span>
                {secret.blurred && <span className="text-[11px] text-accent-secondary">Tap to read</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <button className="fixed bottom-[90px] right-5 w-14 h-14 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white shadow-[0_8px_24px_rgba(255,45,111,0.5)] z-[150] transition-transform hover:scale-110 hover:rotate-90">
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
};

export default Secrets;
