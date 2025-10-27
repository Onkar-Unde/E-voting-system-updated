import React from 'react';
import { Routes, Route } from 'react-router-dom'; // ✅ FIXED
import Register from './Register';
import Login from './Login';
import Vote from './Vote';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/vote" element={<Vote />} />
    </Routes>
  );
}
