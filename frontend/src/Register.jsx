import React, { useState } from 'react';

export default function Register(){
  const [aadhaarHash, setAadhaarHash] = useState('');
  const [centerId, setCenterId] = useState('center-1');
  const [faceEmbeddingText, setFaceEmbeddingText] = useState('[0.1,0.2,0.3,0.4]');
  const [fingerprintSecret, setFingerprintSecret] = useState('123456');
  const [result, setResult] = useState(null);

  async function handleSubmit(e){
    e.preventDefault();
    let faceEmbedding = [];
    try { faceEmbedding = JSON.parse(faceEmbeddingText); } catch (err) { setResult({ error: 'Invalid face embedding JSON' }); return; }

    const res = await fetch('http://localhost:4000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaarHash, centerId, faceEmbedding, fingerprintSecret })
    });
    const j = await res.json();
    setResult(j);
  }

  return (
    <div>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Aadhaar Hash</label><br/>
          <input value={aadhaarHash} onChange={e=>setAadhaarHash(e.target.value)} required />
        </div>
        <div>
          <label>Center ID</label><br/>
          <input value={centerId} onChange={e=>setCenterId(e.target.value)} />
        </div>
        <div>
          <label>Face Embedding (JSON)</label><br/>
          <textarea value={faceEmbeddingText} onChange={e=>setFaceEmbeddingText(e.target.value)} rows={3} style={{width:'100%'}} />
        </div>
        <div>
          <label>Fingerprint Secret</label><br/>
          <input value={fingerprintSecret} onChange={e=>setFingerprintSecret(e.target.value)} />
        </div>
        <button type="submit">Register</button>
      </form>
      {result && <pre style={{background:'#f4f4f4', padding:10}}>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
