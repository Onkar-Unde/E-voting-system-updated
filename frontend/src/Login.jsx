import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ navigation

export default function Login(){
  const navigate = useNavigate();
  const [aadhaarHash, setAadhaarHash] = useState('');
  const [faceEmbeddingText, setFaceEmbeddingText] = useState('[0.1,0.2,0.3,0.4]');
  const [fingerprintSecret, setFingerprintSecret] = useState('');
  const [result, setResult] = useState(null);

  async function handleLogin(e){
    e.preventDefault();
    let faceEmbedding;
    try {
      faceEmbedding = JSON.parse(faceEmbeddingText);
    } catch {
      setResult({ error: 'Invalid face embedding JSON' });
      return;
    }

    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-center-auth': 'true'
      },
      body: JSON.stringify({ aadhaarHash, faceEmbedding, fingerprintSecret })
    });

    const j = await res.json();
    setResult(j);

    if (j.jwt) {
      localStorage.setItem('evote_jwt', j.jwt);
      setTimeout(() => navigate('/vote'), 1000); // ✅ Redirect to Vote Page
    }
  }

  return (
    <div>
      <h2>Login & Biometric Verification</h2>
      <form onSubmit={handleLogin}>
        <input placeholder="Aadhaar Hash" value={aadhaarHash} onChange={e=>setAadhaarHash(e.target.value)} />
        <textarea value={faceEmbeddingText} onChange={e=>setFaceEmbeddingText(e.target.value)} rows={3} style={{width:'100%'}} />
        <input placeholder="Fingerprint Secret" value={fingerprintSecret} onChange={e=>setFingerprintSecret(e.target.value)} />
        <button type="submit">Login</button>
      </form>
      {result && <pre>{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
