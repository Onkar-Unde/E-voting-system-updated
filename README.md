# E-Voting System (Backend-focused, Test Frontend)

This project contains an updated backend, smart contract, and a minimal frontend for testing.

## Quick start (development)

1. Install dependencies:
   - `npm install`
2. Start Hardhat node:
   - `npx hardhat node`
3. Compile & deploy contract:
   - `npx hardhat compile`
   - `npx hardhat run --network localhost scripts/deploy.js`
4. Create `.env` (copy `.env.example`) and fill PRIVATE_KEY (account 0 from hardhat) and CONTRACT_ADDRESS (printed during deploy)
5. Start MongoDB (Docker recommended):
   - `docker run -d -p 27017:27017 --name evote-mongo mongo:6`
6. Start backend:
   - `npm run dev`
7. Start frontend for testing:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Notes
- Registration must include: aadhaarHash, centerId, faceEmbedding (JSON array), fingerprintSecret.
- Login must include: aadhaarHash, faceEmbedding, fingerprintSecret and header `x-center-auth: true`.
- Voting requires a JWT obtained from login.
- Admin API key default: `change_this_admin_key` (set ADMIN_API_KEY in .env)
