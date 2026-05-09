import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { createUserProfile } from '../../services/UserService';

const Register = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (currentUser) {
      navigate('/home');
    }
  }, [currentUser, navigate]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms of Service.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      // Save custom user profile in Firestore to get the unique connection code
      await createUserProfile(userCredential.user, name);
      
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full p-6 pt-10 bg-bg-secondary flex flex-col">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6"
      >
        <h2 className="font-dancing text-3xl font-bold bg-gradient-to-br from-accent-primary to-accent-secondary bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,45,111,0.5)] mb-1">
          Create Account
        </h2>
        <p className="text-[13px] text-text-muted">Start your romantic journey</p>
      </motion.div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center mb-6 cursor-pointer"
      >
        <div className="w-20 h-20 rounded-full bg-glass-bg border-2 border-dashed border-accent-primary flex items-center justify-center mb-2 shadow-glow-pink hover:shadow-glow-strong hover:border-solid transition-all overflow-hidden relative">
          <Camera className="w-8 h-8 text-accent-primary/60" />
        </div>
        <span className="text-[12px] text-text-soft">Upload Photo</span>
      </motion.div>

      <motion.form 
        onSubmit={handleRegister}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card mb-6"
      >
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] rounded-xl text-center">{error}</div>}

        <div className="mb-4">
          <label className="block text-[12px] text-text-soft mb-1.5 font-medium tracking-wide uppercase">Your Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-secondary w-4 h-4" />
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="How should they call you?" 
              className="w-full py-3.5 px-4 pl-11 bg-white/5 border border-accent-primary/20 rounded-2xl text-white text-sm outline-none transition-all focus:border-accent-primary focus:bg-accent-primary/10 focus:ring-2 focus:ring-accent-primary/20 placeholder:text-text-soft/40"
            />
          </div>
        </div>

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

        <div className="mb-6">
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
        
        <div className="flex items-start gap-3 mb-6">
          <button 
            type="button"
            onClick={() => setTermsAccepted(!termsAccepted)}
            className={`w-[18px] h-[18px] min-w-[18px] rounded border-2 mt-0.5 flex items-center justify-center transition-all ${termsAccepted ? 'bg-accent-primary border-accent-primary' : 'border-accent-primary bg-transparent'}`}
          >
            {termsAccepted && <span className="text-[10px] text-white font-bold">✓</span>}
          </button>
          <p className="text-[12px] text-text-muted leading-snug cursor-pointer" onClick={() => setTermsAccepted(!termsAccepted)}>
            I agree to the <span className="text-accent-secondary cursor-pointer">Terms of Service</span> and <span className="text-accent-secondary cursor-pointer">Privacy Policy</span>
          </p>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="btn-primary w-full max-w-full disabled:opacity-70"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </motion.form>

      <p className="text-center text-[14px] text-text-muted mt-auto">
        Already have an account? <span onClick={() => navigate('/login')} className="text-accent-secondary font-semibold cursor-pointer hover:underline">Sign in</span>
      </p>
    </div>
  );
};

export default Register;
