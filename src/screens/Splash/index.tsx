import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const Splash = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && currentUser) {
      navigate('/home');
    }
  }, [currentUser, loading, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-bg-primary p-10">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative mb-8"
      >
        <img src="/logo.png" alt="Krisha Logo" className="w-28 h-28 rounded-3xl shadow-glow-strong object-cover" />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 w-36 h-36 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          <div className="absolute w-3 h-3 bg-accent-primary rounded-full top-0 left-1/2 -translate-x-1/2 shadow-[0_0_12px_#ff2d6f,0_0_24px_rgba(255,45,111,0.5)]"></div>
          <div className="absolute w-2 h-2 bg-accent-secondary rounded-full bottom-0 right-2 shadow-[0_0_10px_#ff6b9d]"></div>
        </motion.div>
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="font-dancing text-6xl font-bold bg-gradient-to-br from-accent-primary via-accent-secondary to-accent-soft bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,45,111,0.6)] mb-2 text-center"
      >
        Krisha
      </motion.h1>
      
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="text-[15px] text-text-soft tracking-wide mb-14 opacity-85 text-center"
      >
        Love knows no distance 💕
      </motion.p>

      <motion.button 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        onClick={() => navigate('/login')}
        className="btn-primary"
      >
        Get Started
      </motion.button>
    </div>
  );
};

export default Splash;
