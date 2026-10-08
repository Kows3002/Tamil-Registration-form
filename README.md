# Sangam Community Family Register

A React/Vite + Express application for collecting a complete family record for each community. MongoDB stores the household, individual members, place selections, support needs and contribution offers together in one community-scoped family document.

## What is included

- An English-only, section-by-section registration workspace with a restrained charcoal/grey palette, consistent Segoe UI typography, a compact section navigator and readable mobile controls. The root URL opens the form directly.
- Primary information, places and address, family members, household/livelihood, help needed, contributions, and review/consent sections.
- One member to start, with add/remove controls and individual age, relationship, education, occupation, phone and skills fields.
- Searchable, paginated dropdowns for State, District, Taluk / Tehsil / Mandal, Block, Gram / Village Panchayat, Village / Town, Habitation / Hamlet, Ward No., Street / Area, PIN Code and Post Office. Rural / Urban is a fixed-choice dropdown. Changing a parent clears its children.
- Place IDs and names are verified against MongoDB masters on the server; incompatible parent/child selections are rejected.
- Optional help categories, request priority and description; optional contribution categories, skills, availability and description. This registers interest in contributing and does not collect payments.
- A submission receipt/reference, loading states and notifications in the top right corner.
- An authenticated admin workspace with real counts, searchable family/member lists, help and contribution directories, and full family details. Lists refresh every 10 seconds while the tab is visible and have a manual refresh button.
- Existing JWT authentication, one-hour admin sessions, community access permissions, community management and versioned form builder.
- All new fields are additive. Existing family records and administrator-customised forms are retained. Only recognised, unchanged starter templates are automatically upgraded; old submitted form versions remain recorded.

## Run locally (Windows PowerShell)

### 1. Backend

Open a terminal in the project root:

```powershell
cd backend
npm install
```

If `backend/.env` already exists, keep your existing MongoDB URI and JWT secret. Otherwise copy `.env.example` to `.env` and set:

```dotenv
PORT=5000
MONGODB_URI=your-MongoDB-Atlas-connection-string
JWT_SECRET=your-long-private-random-secret
CLIENT_ORIGIN=http://localhost:5173
```

Start the backend:

```powershell
npm run dev
```

Wait for `MongoDB connected` and `API listening on 5000`. Startup creates the default `krishnan-community` and its published family form when needed. Existing legacy records are assigned to that community.

### 2. Location directory (only when missing / for a fresh database)

The source files already live in `backend/data/master-source/`. From `backend`:

```powershell
python -m pip install -r requirements-master-import.txt
npm run import:master
npm run import:english
```

The master importer upserts location records without replacing collections. The English importer adds English names by authoritative codes; it preserves original names and IDs. Python and `pypdf` are needed only for these import commands, not for the running backend.

The supplied rural directory covers **Tamil Nadu: 37 rural districts, 388 blocks, 12,525 panchayats and 79,395 habitations**. The state dropdown lists all 28 states and 8 union territories; district lists currently contain the supplied Tamil Nadu data. It does not imply nationwide district coverage or a complete urban directory.

Official English names were matched for all 388 blocks and 12,525 panchayats, and 75,378 habitations. The remaining 4,017 habitation names use deterministic Latin-script romanisation of the source names. Romanisation is not presented as an official translation; `englishSource` records the origin. Ambiguous legacy-code matches are never guessed.

English reference files are included in `backend/data/master-source/`:

- [Tamil Nadu Rural Development block list](https://tnrd.tn.gov.in/rdweb_newsite/project/admin/block_lgd_bcode.php?xls=1&lang=en)
- [English village panchayat PDF](https://tnrd.tn.gov.in/pdf/village_eng.pdf)
- [English district/block/village/habitation workbook](https://tnrd.tn.gov.in/databases/dist_blk_vill_hab.xlsx)

The uploaded rural files contain blocks, not revenue taluks. The Taluk dropdown now combines a bundled revenue taluk snapshot for all 37 imported districts with community-managed entries. `backend/src/config/taluks.json` records each district's government source URL and verification date. The backend uses the district's master code to filter the list; no extra database import is needed. `talukCode` is an application key and is stored separately from community `talukChoiceId` ObjectIds. Submission validation checks that the taluk belongs to the selected district. Refresh the snapshot when government revenue boundaries change; its named lists take precedence over inconsistent summary counts on source pages.

The rural **Village / Hamlet** dropdown includes every imported habitation under the selected panchayat, labelled `(hamlet)`, together with the community's verified village entries. Choosing a master hamlet fills the Habitation field and saves its real master ID; the backend derives its name from the verified district/block/panchayat chain. These names are not represented as an independent revenue village or urban town directory.

Independent village/town, ward and street directories remain community-managed. Open **Admin > Location directory** (`/admin/locations`) to add verified English names and their parent locations. Active entries immediately appear in the public dropdowns; deactivating an entry retains historical family records. Only entries with compatible parent locations are listed. Ward numbers are not generated from an arbitrary numeric range. A community taluk entry overrides a bundled taluk with the same name (ignoring case and surrounding whitespace), including hiding that name when inactive. Community administrators and the platform owner can maintain these lists; other community staff can read them.

The postal source contains 2,056 PIN codes and 11,880 post offices. Post offices are filtered by the selected PIN code. It does not provide verified district-to-PIN or taluk-to-block mappings, so those relationships are not guessed. Upload verified additional sources to extend urban, ward, street or postal geographic coverage.

Families can explicitly choose a village with the same name as the selected panchayat; a panchayat is not silently treated as a village. For missing taluks or streets, the form records a `locationMissing` flag rather than inventing a location ID. Names, contact details, a house/door number and request descriptions remain text inputs because they cannot be supplied from a fixed master list.


### 3. Frontend

In another terminal, from the project root:

```powershell
cd frontend
npm install
```

Set `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Restart Vite after changing this file:

```powershell
npm run dev
```

Use `http://localhost:5173` (the configured CORS origin).

| Page | Local URL |
| --- | --- |
| Public family form | http://localhost:5173/ |
| Community-specific form | http://localhost:5173/register/krishnan-community |
| Admin login | http://localhost:5173/admin/login |
| Admin overview | http://localhost:5173/admin/dashboard |
| Families | http://localhost:5173/admin/families |
| Members | http://localhost:5173/admin/members |
| Help requests | http://localhost:5173/admin/requests |
| Contributions | http://localhost:5173/admin/contributions |
| Location directory | http://localhost:5173/admin/locations |
| Form builder | http://localhost:5173/admin/form-builder |

Use your existing admin account. If the database has no admin yet, create the first platform owner from `backend`:

```powershell
npm run create-admin -- your-username your-password-at-least-10-characters
```

Additional community users can be created by the platform owner in Users & roles. No password is stored in frontend localStorage.

## How families use it

1. Open the public form without logging in.
2. Enter the primary contact and family details.
3. Choose each place in order; type in the dropdown search to filter names. Browse more names where the directory spans multiple pages.
4. Add every member, including the family head.
5. Fill any relevant household information.
6. Select help categories and describe the request if support is wanted.
7. Select contribution categories and describe the offer if interested.
8. Review the record, give consent and submit. Keep the reference shown after a successful save.

Only authorised administrators can browse the collected family data. Help requests and contribution offers appear in the admin directories for follow-up; matching, payment processing and message delivery are not implemented.

## Community-specific forms

Every community has its own registration URL and published form version. Administrators can add ordinary questions and sections using the form builder. The structured field types `location`, `members`, `support` and `contribution` use the system keys `district`, `members`, `support` and `contribution` respectively. Required system fields must stay visible when publishing.

Administrator-customised existing forms are not overwritten. To use the new sections for such a community, add the structured fields in the form builder and publish. Normal questions are stored as schema fields when applicable or in `customData` otherwise.

## Production

This change does not deploy either application. Deploy the updated backend and frontend together so production serves the new form configuration, schemas and code.

- Render service root: `backend`; build: `npm ci`; start: `npm start`.
- Keep the existing Render `MONGODB_URI`, `JWT_SECRET`, and approved `CLIENT_ORIGIN` values.
- Vercel root: `frontend`; build: `npm run build`; output: `dist`.
- Vercel environment variable: `VITE_API_URL=https://tamil-registration-form.onrender.com/api`.
- The existing `frontend/vercel.json` SPA rewrite is retained.
- `.env` files remain ignored by Git. API requests share `frontend/src/api.js`.

## Checks

```powershell
cd frontend
npm run build
npm run lint
```

From `backend`, syntax-check the source files:

```powershell
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

The optional MongoDB integration check needs the running database, default community and imported masters:

```powershell
node scripts/checkCommunityCollection.js
```

Location master and district/taluk regression tests run without a database:

```powershell
node --test tests/*.test.js
```

It validates a write/read round trip inside a transaction and aborts the transaction, leaving no committed test family. It also checks invalid age, categories and location selections.

