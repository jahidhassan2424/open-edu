# MongoDB serverless configuration

MongoDB is server-only and is accessed through the shared serverless handler. The production frontend may run on Netlify while the API runs on Vercel. Do not prefix server credentials with `PUBLIC_`.

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=open_edu_verification_01
FIREBASE_SERVICE_ACCOUNT_JSON=your_complete_service_account_json
ALLOWED_ORIGINS=https://your-preview.netlify.app
```

Configure these only in the Vercel backend project. `ALLOWED_ORIGINS` is a comma-separated allowlist of exact HTTPS frontend origins. Preview deployments must use a separate Atlas database whose name explicitly identifies it as verification or preview data, such as `open_edu_verification_01`.

Configure the Netlify frontend with the Firebase Web variables from `.env.example`, plus:

```text
PUBLIC_DATA_PROVIDER=mongodb
PUBLIC_API_BASE_URL=https://your-api.vercel.app
```

The Firebase ID token remains the identity credential. The Vercel Function verifies it with Firebase Admin SDK before repository access. The shared `mongo-api` handler creates required indexes on invocation. No browser code imports MongoDB or Firebase Admin modules.

## GitHub deployment

1. Create a Vercel project from the repository with the repository root as its root directory. Keep the build command from `vercel.json`; add the four server-only variables above for the Preview environment, and use only the isolated preview database.
2. Deploy the Vercel preview, then copy its HTTPS origin into Netlify as `PUBLIC_API_BASE_URL`.
3. Add the exact Netlify preview origin to Vercel's `ALLOWED_ORIGINS` and redeploy the Vercel preview if the value changed.
4. Create a Netlify project from the same repository. The build command and static publish directory are defined in `netlify.toml`. Add only the public frontend variables to Netlify.
5. Confirm an authenticated request to `/api/mongo` before testing imports or writes. Never point preview environment variables at the production database.

## Netlify preview smoke test

Run only against an isolated preview database and a deployed HTTPS preview URL:

```powershell
$env:SMOKE_TEST_MODE='true'
$env:PREVIEW_BASE_URL='https://<netlify-preview>.netlify.app'
$env:SMOKE_LEARNER_TOKEN='<short-lived test token>'
$env:SMOKE_INSTRUCTOR_TOKEN='<short-lived test token>'
npm run test:smoke:preview
```

The runner refuses non-HTTPS/local URLs, requires an explicitly isolated database name, never prints tokens, and first verifies unauthenticated rejection. Full seeded-course checks require the preview test identities and synthetic fixture setup.
