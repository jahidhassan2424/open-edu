# Local MongoDB configuration

MongoDB is server-only and is accessed exclusively by Netlify Functions. Set these variables in the Netlify environment or a local Functions environment file; do not prefix them with `PUBLIC_`:

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=open_edu
PUBLIC_DATA_PROVIDER=mongodb
```

Netlify preview also requires the Firebase Web variables documented in `.env.example` and server-only Firebase Admin configuration. Use managed Netlify secrets for Admin credentials; never place them in `PUBLIC_*` variables. Preview deployments must use a separate database such as `open_edu_verification_01`.

The Firebase ID token remains the identity credential. Functions verify it with Firebase Admin SDK before repository access. `mongo-api` creates the course, term, and lesson indexes on invocation. A local connection check can be performed with the Netlify Functions emulator once dependencies are installed; no browser code should import the MongoDB module.

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
