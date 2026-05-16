# UPNG Chatspace

Anonymous, ephemeral real-time chat for University of Papua New Guinea students. Messages self-destruct after 4 minutes. Identity rotates daily.

## Overview

- **Restricted access** — Google sign-in with `@student.upng.ac.pg` email required
- **Pseudonymous** — random handles (e.g. `Silent_Kapul_42`) assigned on login and rotated each day
- **Ephemeral** — messages expire after 4 minutes via server-side scheduled cleanup
- **140-character limit** — enforced client-side and in Firestore security rules
- **Terminal UI** — retro green-on-black aesthetic, PWA-installable

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Backend | Firebase (Auth, Firestore, Cloud Functions, Hosting) |
| PWA | vite-plugin-pwa + Workbox |
| Routing | React Router v6 |

## Project Structure

```
upng-web-chat/
├── src/
│   ├── firebase.ts              # Firebase app init (auth + db exports)
│   ├── App.tsx                  # Router + auth guard
│   ├── main.tsx                 # React root
│   ├── context/
│   │   └── UserContext.tsx      # Auth state, profile, daily handle rotation
│   ├── pages/
│   │   ├── Login.tsx            # Boot sequence + Google OAuth
│   │   └── Terminal.tsx         # Main chat interface
│   ├── utils/
│   │   └── commandParser.ts     # Slash command parser
│   └── styles/
│       └── global.css           # Terminal theme variables
└── functions/
    └── src/
        └── index.ts             # Scheduled TTL cleanup + flood detection
```

## Firestore Schema

**`users/{uid}`**
```
handle        string   — daily-rotated pseudonym
email         string
handleDate    string   — YYYY-MM-DD, triggers rotation when stale
lastSeen      timestamp
banned        boolean
```

**`messages/{id}`**
```
uid           string
handle        string
text          string   — max 140 chars
timestamp     timestamp
expiresAt     timestamp — now + 4 min
```

Additional collections (`polls`, `suggestions`, `reports`) are referenced by the command parser and ready for implementation.

## Cloud Functions

| Function | Trigger | Behaviour |
|---|---|---|
| `scheduledCleanup` | Every 1 minute | Batch-deletes messages where `expiresAt < now` |
| `onMessageCreate` | Firestore write | Auto-bans user and deletes message if > 100 messages in 10 minutes |

## Slash Commands

Type any of these in the chat input:

| Command | Description |
|---|---|
| `/help` | Show command reference |
| `/report @Handle` | Flag a user for admin review |
| `/poll "Question"` | Start a 24-hour flash poll |
| `/vote yes\|no` | Cast a vote on the active poll |
| `/suggest "Idea"` | Submit a feature suggestion |

`/help` is fully wired. The remaining commands have their parser logic complete; Firestore write handlers are pending.

## Local Development

**Prerequisites:** Node 18+, Firebase CLI (`npm i -g firebase-tools`)

```bash
# Frontend
npm install
npm run dev          # http://localhost:5173

# Cloud Functions
cd functions
npm install
npm run build
npm run serve        # local emulator
```

> The dev server connects to the live Firebase project by default. Use `firebase emulators:start` if you want an isolated environment.

## Build & Deploy

```bash
# Type-check + bundle frontend
npm run build

# Deploy everything (hosting, functions, firestore rules)
firebase deploy
```

Hosting serves `dist/` as a SPA — all routes rewrite to `index.html`.

## Security Rules Summary

- **Users**: authenticated reads; users write only their own document
- **Messages**: authenticated reads; creates validated on `uid`, text length 1–140; deletes blocked (functions only)
- **Domain whitelist**: `@student.upng.ac.pg` enforced in `UserContext` before any profile is created

## PWA

The app is installable as a standalone PWA. Workbox caches static assets and applies a `networkFirst` strategy (10s timeout) for Firestore API calls, providing basic offline resilience.
