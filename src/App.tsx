import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Splash from './screens/Splash';
import Login from './screens/Auth/Login';
import Register from './screens/Auth/Register';
import Home from './screens/Home';
import Secrets from './screens/Secrets';
import MoodTracker from './screens/Mood';
import Profile from './screens/Profile';
import LiveCanvas from './screens/LiveCanvas';
import BottomNav from './components/Navigation/BottomNav';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Navigation/ProtectedRoute';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="h-full w-full overflow-y-auto overflow-x-hidden no-scrollbar bg-bg-primary pb-20 relative">
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/secrets" element={<ProtectedRoute><Secrets /></ProtectedRoute>} />
            <Route path="/mood" element={<ProtectedRoute><MoodTracker /></ProtectedRoute>} />
            <Route path="/canvas" element={<ProtectedRoute><LiveCanvas /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          
          <BottomNav />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
