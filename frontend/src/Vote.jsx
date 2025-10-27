import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Vote() {
  const [candidates, setCandidates] = useState([]);
  const [candidateId, setCandidateId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await fetch("http://localhost:4000/api/admin/candidates", {
          headers: { "x-api-key": "adminkey" }
        });

        if (!res.ok) {
          setMessage("Failed to load candidates (Unauthorized)");
          return;
        }

        const data = await res.json();
        if (!data.candidates?.length) {
          setMessage("No candidates found. Admin must add candidates first!");
          return;
        }

        setCandidates(data.candidates);
        setCandidateId(data.candidates[0].candidateId);
      } catch (error) {
        setMessage("Error loading candidates");
      }
    }

    loadCandidates();
  }, []);

  async function handleVote(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const token = localStorage.getItem("evote_jwt");
    if (!token) {
      setMessage("Please login first");
      navigate("/");
      return;
    }

    const res = await fetch("http://localhost:4000/api/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ candidateId: Number(candidateId) }),
    });

    const data = await res.json();

    if (res.status === 401) {
      setMessage("Session expired — Login again!");
      localStorage.removeItem("evote_jwt");
      navigate("/");
    } 
    else if (res.status === 403) {
      setMessage("Biometric verification required! Login again at center.");
      navigate("/");
    } 
    else if (!res.ok) {
      setMessage(data.error || "Error submitting vote");
    } 
    else {
      setMessage("✅ Vote Successfully Recorded on Blockchain!");
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>🗳 Cast Your Vote</h2>

      {candidates.length === 0 && <p>{message}</p>}

      {candidates.length > 0 && (
        <form onSubmit={handleVote}>
          <label>Choose Candidate:</label>
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
          >
            {candidates.map((c) => (
              <option key={c.candidateId} value={c.candidateId}>
                {c.name}
              </option>
            ))}
          </select>

          <button type="submit" disabled={loading} style={{ marginLeft: 10 }}>
            {loading ? "Recording Vote..." : "Vote"}
          </button>
        </form>
      )}

      {message && (
        <p style={{ marginTop: 15, color: "darkgreen", fontWeight: "bold" }}>
          {message}
        </p>
      )}
    </div>
  );
}
