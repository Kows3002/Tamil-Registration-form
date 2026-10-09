# Sangam family registration portal

Public form: `/`. Admin login: `/admin/login`.

## Start the application

From the project root, start the API:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

In another terminal, start the frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Frontend: `http://localhost:5173`. API: `http://localhost:5000/api`. For hosting, set `VITE_API_URL` to the deployed API URL including `/api`, then rebuild. Set `CLIENT_ORIGIN` on the backend to allow the frontend origin.

## Set the Adminshree password

From the project root:

```powershell
cd backend
npm.cmd run reset-admin -- Adminshree --super-admin
```

Enter a password of at least 12 characters, then confirm it. Input stays hidden. This command creates or updates Adminshree as an active platform administrator with access to all communities and reports. Passwords are stored as bcrypt hashes. Login is case insensitive; the database stores `adminshree`.

To change the password later while preserving its role:

```powershell
npm.cmd run reset-admin -- Adminshree
```

`backend/.env` must contain `MONGODB_URI` and `JWT_SECRET`. Editing the login label does not create credentials.

## Location masters

The configured database was empty. The supplied files have been imported: 37 rural-master districts, 388 blocks, 12,525 village panchayats, 79,395 complete habitations, 234 constituency names, 2,056 PIN codes and 11,880 post offices. One incomplete habitation is skipped; inconsistent parent codes are resolved using official village codes.

Lists follow state → district → block → panchayat → habitation. Taluks follow the district. Rural village options include the selected panchayat and supplied habitation names. A typed six-digit PIN enables matching post offices. Ward/street lists are optional, community-managed entries under **Location directory**. Urban town/city names can be typed and are marked as manual entries.

The supplied rural district master excludes Chennai and does not contain a complete urban town directory or other states' districts. Additional authoritative sources are needed for these places; missing names are not invented.

To initialize another database:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-master-import.txt
npm.cmd run import:master
npm.cmd run import:english
npm.cmd run check:master
```

Imports upsert supplied records without deleting registrations. They automatically use the local Python environment. The read-only check verifies counts, parent references, scoped APIs and a complete location selection.

## Submitted forms and PDFs

Successful submission displays the saved form in primary, residential, member, household, support and contribution sections. **Download PDF** creates a direct download named with the community and family head, for example `Naidu Community-Ravi.pdf`. The PDF includes the community, family name, reference, submission time and form details. Noto Sans Tamil renders Tamil names; its SIL Open Font License is included in `backend/assets/fonts`.

Public downloads use a random receipt credential valid for 24 hours; only its hash is stored. Download before closing or refreshing the receipt page. A reference alone cannot retrieve a form. Administrators can download a copy later from the family detail page.

## Admin reports and data format

The overview and family register open with **All communities** selected. This includes every community available to the signed-in administrator; choosing a community narrows the view. Previously the workspace silently selected the first alphabetical community, which could hide an existing registration in another community. Each register row now displays its community name. One family appears once, with its members inside **Open record**.

### Edit and publish the registration form

1. Open **Configure → Registration form** and select a community. The saved prebuilt template loads automatically, including for communities that previously had no form configuration.
2. Choose a section in the form sidebar. It displays the same registration fields as the public form.
3. Use **Edit question** to change the label, answer format, choices or help text. Tick **Required** below a field to make it mandatory; untick it to make it optional. Essential identity/location/member fields are protected because registrations require them.
4. Use **+ Add question** at the bottom of the section for an extra question. Choose Short answer, Long answer, Number, Dropdown, Single checkbox, Multiple checkboxes or another supported format. Use **Edit section** to change its title or description.
5. **Preview changes** shows your current edits. **Save draft** stores them without changing the live form. **Save & publish** saves the changes and updates the public registration form. **Copy registration link** provides the community's public link. **Preview published form** opens the live version.

The toolbar shows Unsaved changes, Draft saved or Published. Preview answers are never stored as registrations. Drafts retain the template's validation rules; publishing preserves previous versions and existing family records.

To initialize missing templates in another database without replacing existing forms, run `node scripts/repairMissingForms.js` from `backend`. Missing templates also initialize automatically when an administrator opens the form.

Navigation contains Overview, Family register, Help requests, Contributions and District & community reports. Members, user roles, community profile, location directory and platform management screens are retired from the admin navigation. **Registration form** remains visible under Configure, including when All communities is selected. Open it, choose a community, then view the existing prebuilt registration template in the same layout as the public form. Use **Edit question** to modify existing labels and choices; the **Required** checkbox is visible below each field. Save a draft, use **Save & publish**, and copy the registration link from the toolbar. Preview published form opens the current live version; the embedded template shows your edits before publishing. Sample answers in the embedded template are never saved as registrations.

Family PDFs use A4 pages with consistent margins, a page border, formal portal/community headings, registration reference and status, numbered shaded section bands, bordered two-column fields and numbered pages. Long values continue within the printable area. The same template serves public receipts and administrator downloads.

Open **District & community reports**. Choose district, community, status, dates or a name/phone/village search and press **Apply filters**. Counts and downloads use those applied filters. Downloads include all matching rows, including rows beyond the displayed page.

Two families containing three and four people count as **two registrations and seven members**. Community counts include distinct communities with matching registrations.

| Download | Row structure |
| --- | --- |
| Summary CSV | One row per district/community, with family and member totals. |
| Families CSV | One row per family with its reference, community, contact, residence, household, help and contribution details. |
| Members CSV | One row per person with family reference, community, district, relationship, age, occupation and work location. |
| Family PDF | One saved form, through **Open record → Download family PDF**. |

Families CSV `_id` links to Members CSV `Family reference`. CSV uses UTF-8 with a BOM for Tamil text in Excel. Formula-like cell values are escaped. Date filters use India Standard Time; archived records are excluded.

Platform administrators can report across all communities. Community administrators, managers and viewers are restricted to assigned communities. Data-entry operators and verifiers do not have reporting permission. The individual register also supports district, status and text filters.

## Checks

```powershell
cd backend
npm.cmd test
npm.cmd run check:master
npm.cmd run check:registration
node scripts/checkFormEditor.js
```

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
```

Untouched default forms upgrade to the merged template. Existing registrations, historical versions, customised forms and pending drafts are preserved.

`check:registration` validates submission, report totals, three CSV formats and the receipt PDF in a MongoDB transaction, then aborts it. It does not leave a test registration in the database.

From the project root, `node backend/scripts/checkAdminRecords.js` checks actual registration counts and the all-community register without printing personal information or changing records. `node backend/scripts/previewRegistrationPdf.js` writes a synthetic sample PDF to `artifacts/community-checks/registration-preview.pdf`; create this directory first if it does not exist.
