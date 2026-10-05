# Tamil family registration

React/Vite frontend and Express/MongoDB API for a Tamil household registration form.

## Start MongoDB and configure the API

1. Install and start MongoDB, or use a MongoDB Atlas connection string.
2. Copy `backend/.env.example` to `backend/.env` and set your Atlas `MONGODB_URI` and a long, private `JWT_SECRET`.
3. In `backend/`, run `npm install`, then `npm run create-admin -- <username> <password-at-least-10-chars>`.
4. Start the API with `npm run dev` (port 5000).
5. In `frontend/`, run `npm install` and `npm run dev` (port 5173).

The frontend uses `VITE_API_URL` when set and otherwise calls `http://localhost:5000/api`. Set `CLIENT_ORIGIN` in `backend/.env` to the exact frontend origin when it differs from `http://localhost:5173`.

If Node reports `querySrv ECONNREFUSED` or `ETIMEOUT`, MongoDB has not reached the authentication stage. On Windows, check the active DNS resolver, VPN, firewall, or DNS filtering software. Test SRV lookup with `node -e "require('node:dns').promises.resolveSrv('_mongodb._tcp.<your-atlas-host>').then(console.log).catch(console.error)"`. Atlas network access and outbound TCP port 27017 must also be allowed once SRV resolution succeeds.

Admin pages are `/admin/login` and `/admin/dashboard`. The public registration endpoint accepts submissions without login; editing, listing, viewing, and deleting require an admin JWT. No credentials or database secrets are checked into this project.
