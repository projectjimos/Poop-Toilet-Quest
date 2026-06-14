# Security Specification - Poop Quest Firebase Security Spec

This document outlines the security requirements and invariants for the application database schema (`/users/{userId}`).

## 1. Data Invariants
- A user profile document can only be read by its owner.
- A user profile document can only be written (created or updated) by its owner.
- The `uid` in the document must match the authenticated user's `request.auth.uid`.
- Temporal values (`createdAt`, `updatedAt`) must enforce temporal integrity using `request.time`.
- Email must be a string and match the token's authenticated email.

## 2. The "Dirty Dozen" Payloads (Zero-Trust Validation Cases)

Below are 12 specific malicious payloads or actions that must be strictly rejected/denied by the security rules:

1. **Anonymous Unauthorized Write**: Trying to create/write a profile while not signed in.
2. **Identity Spoofing - Creation**: Creating a user profile document with path `/users/attacker_user` but specifying `uid: "victim_user"` in the payload to spoof owner.
3. **Identity Spoofing - Path Mismatch**: Trying to write a user profile under `/users/victim_user` when signed in as `attacker_user`.
4. **Email Spoofing (Forged Email)**: Creating a user profile under `/users/user_123` with `email: "admin@google.com"` when the auth token's email is actually `user_123@example.com`.
5. **Ghost Fields injection**: Trying to save extra fields not defined in the schema (e.g., adding `isAdmin: true` or `bypassed: true` fields).
6. **Mutating Immortal Field `createdAt`**: Updating a profile but changing `createdAt` to a different value or retrofitting a fake signup time.
7. **Client Timer Forgery (Fake `updatedAt`)**: Specifying a manual string formatted datetime for `updatedAt` instead of `request.time` (server timestamp).
8. **Malicious Negative Score**: Updating the user profile with `highScore: -9999` to break list orders or crash UI.
9. **Spaghetti ID Injection**: Creating a document with a non-alphanumeric/hazardous ID to exhaust resources or inject scripts.
10. **Malicious Empty SubbedTo Array Type Check**: Trying to save `subbedTo` as `null` or a string `"none"` instead of a proper array of strings.
11. **Malicious Giant String for email**: Storing a 5MB string inside `email` to cause Denial of Wallet (resource exhaustion).
12. **Foreign Reader Exploit**: An authenticated user `user_aaa` attempting to read `/users/user_bbb` to scan who they are subscribed to.

## 3. Test Cases Spec
All of the cases above must result in a strict `PERMISSION_DENIED` response, ensuring the database remains completely secure under any circumstance.
