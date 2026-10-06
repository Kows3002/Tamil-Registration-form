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

## Part 1: import government master data

The Part 1 source files are kept unchanged in `backend/data/master-source/`. Install Python dependencies once from `backend/` with `python -m pip install -r requirements-master-import.txt`, then run `npm run import:master`. The importer reads those files, validates and normalizes them, and upserts District, Block, Village Panchayat, Habitation, Assembly Constituency, Post Office, and PIN Code records. It creates indexes without dropping indexes or collections. Running it again is safe and updates the same master records. English district names are matched to the official LGD district codes listed by [Tamil Nadu Rural Development & Panchayat Raj](https://training.tnrd.tn.gov.in/tnrd/project/admin/district_lgd_dcode.php?lang=en&pdf=1).

The public read-only lookup routes are under `/api/master`: `districts`, `blocks?districtId=...`, `village-panchayats?blockId=...`, `habitations?villagePanchayatId=...`, `assembly-constituencies?search=...`, `post-offices?search=...`, and `pincodes?search=...`. List responses include `data.items` and pagination metadata; page sizes are capped at 100. The registration form uses these routes for cascading master-data selections and stores both selected IDs/codes and the existing Tamil/English text snapshots.

Import requires the configured `MONGODB_URI` to be reachable from the machine running the command. No records were imported during this implementation because the configured Atlas cluster could not be reached from this environment; rerun the command after Atlas network access/DNS is available.

For the Render web service, set **Root Directory** to `backend`, **Build Command** to `npm ci`, and **Start Command** to `npm start`. The start script launches `src/server.js` directly; this app has no compiled backend build directory. Configure `MONGODB_URI` and `JWT_SECRET` as Render environment variables. `MONGODB_URI` must include the intended database path (`tamil_family_registration` in the checked local environment); the code does not use a separate database-name variable. `CLIENT_ORIGIN` is optional for the current local and Vercel frontend origins. A successful startup logs every registered `/api/master` GET route after connecting to MongoDB.
