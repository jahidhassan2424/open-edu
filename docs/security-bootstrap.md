# Security bootstrap and grading boundary

Open-EDU uses Firebase Authentication custom claims for authorization. The `users` Firestore collection is a profile only; it cannot grant a role.

## Bootstrap the first administrator

1. Create the Firebase project, enable Google sign-in, and let the intended administrator sign in once. Copy their Firebase Auth UID from the Firebase Console.
2. On a trusted operator machine, authenticate with a service account that has permission to manage Firebase Auth users. Set `GOOGLE_APPLICATION_CREDENTIALS` to the local service-account JSON path (or supply `FIREBASE_SERVICE_ACCOUNT_JSON` through a CI secret).
3. Run `node scripts/set-custom-claim.mjs --uid <UID> --role admin`.
4. Have that user sign out and back in. Firebase ID tokens are cached, so the new claim is not visible until token refresh.
5. Assign instructor roles with the same script. Never set `users/{uid}.role` in the console or client.

Do not commit service-account JSON or put it in browser-facing `PUBLIC_*` variables. `firebase-admin` is used only by the operator script and Cloud Functions.

## Deployable components

The SvelteKit application remains static. `functions/` is a separate Firebase Functions package and contains the callable endpoints `getLearnerQuiz`, `startQuizAttempt`, and `submitQuizAttempt`. Install and build it independently:

```powershell
cd functions
npm install
npm run build
cd ..
```

Firebase Functions deployment requires a Firebase project with Cloud Functions enabled (normally Blaze billing). Vercel/Netlify continue to host only the static `build` directory; no Admin SDK credential is supplied to either static host.

## Existing data migration required before production rules

Older course documents may embed `lessons[].quiz` objects containing answer keys, and old quiz attempts were client-authored. Firestore rules cannot redact individual fields. Before deploying the new rules, use a trusted Admin SDK migration to remove embedded quiz objects from `courses`, retain quiz answer keys only in `/quizzes`, and treat old attempts as untrusted historical data. Also rename or recreate existing enrollment documents as `{uid}_{courseId}`; the new lesson rule relies on that deterministic ID. Reauthenticate users after claims are assigned.
