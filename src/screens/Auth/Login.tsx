import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (currentUser) {
      navigate('/home');
    }
  }, [currentUser, navigate]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else {
        setError(err.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full p-6 pt-16 bg-bg-secondary flex flex-col">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <img src="/logo.svg" alt="Krisha" className="w-16 h-16 rounded-2xl shadow-glow-pink mx-auto mb-4 object-cover" />
        <h2 className="font-dancing text-3xl font-bold bg-gradient-to-br from-accent-primary to-accent-secondary bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,45,111,0.5)] mb-1">
          Welcome Back
        </h2>
        <p className="text-[13px] text-text-muted">Your partner is waiting for you</p>
      </motion.div>

      <motion.form 
        onSubmit={handleLogin}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card mb-6"
      >
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] rounded-xl text-center">{error}</div>}

        <div className="mb-4">
          <label className="block text-[12px] text-text-soft mb-1.5 font-medium tracking-wide uppercase">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-secondary w-4 h-4" />
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com" 
              className="w-full py-3.5 px-4 pl-11 bg-white/5 border border-accent-primary/20 rounded-2xl text-white text-sm outline-none transition-all focus:border-accent-primary focus:bg-accent-primary/10 focus:ring-2 focus:ring-accent-primary/20 placeholder:text-text-soft/40"
            />
          </div>
        </div>

        <div className="mb-2">
          <label className="block text-[12px] text-text-soft mb-1.5 font-medium tracking-wide uppercase">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-secondary w-4 h-4" />
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••" 
              className="w-full py-3.5 px-4 pl-11 bg-white/5 border border-accent-primary/20 rounded-2xl text-white text-sm outline-none transition-all focus:border-accent-primary focus:bg-accent-primary/10 focus:ring-2 focus:ring-accent-primary/20 placeholder:text-text-soft/40"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="text-right mb-6">
          <span className="text-[12px] text-accent-secondary cursor-pointer font-medium hover:underline">Forgot password?</span>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="btn-primary w-full max-w-full mb-4 disabled:opacity-70"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </motion.form>

      <p className="text-center text-[14px] text-text-muted mt-auto">
        Don't have an account? <span onClick={() => navigate('/register')} className="text-accent-secondary font-semibold cursor-pointer hover:underline">Sign up</span>
      </p>
    </div>
  );
};

export default Login;
