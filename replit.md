# ZeroBuild AI

## Overview

ZeroBuild AI is a mobile-first application that lets users describe an app idea in natural language and generates complete React Native (Expo) code using AI. The generated code can then be pushed to GitHub, with a pipeline toward building APKs. It's essentially a "describe → clarify → generate → deploy" tool for mobile apps.

The project has two main parts:
1. **Expo/React Native frontend** — a mobile app (and web-compatible) where users create projects, enter prompts, view generated code, and manage settings
2. **Express backend server** — serves as an API layer and handles static file serving for deployments

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: Stack-based navigation using expo-router with modal presentations for create and settings screens
- **State Management**: React Context (`ProjectProvider`) for project and settings state, with `@tanstack/react-query` available for server-state management
- **Local Storage**: `@react-native-async-storage/async-storage` stores projects and settings as JSON — this is the primary data persistence for the client
- **Styling**: Dark theme throughout using `StyleSheet.create`, with a centralized color constants file (`constants/colors.ts`). Both light and dark themes are defined but currently map to the same dark palette
- **Fonts**: Space Grotesk (UI text) and JetBrains Mono (code display)
- **Key UI Libraries**: expo-linear-gradient, expo-haptics, react-native-reanimated, expo-blur, expo-clipboard

### Route Structure

| Route | Purpose |
|-------|---------|
| `/` (index) | Home screen — lists all projects |
| `/create` | Modal — create new project with AI prompt |
| `/project/[id]` | Project detail — view code, push to GitHub, build |
| `/settings` | Modal — configure API keys and preferences |

### Backend (Express)

- **Runtime**: Node.js with TypeScript (compiled via `tsx` in dev, `esbuild` for production)
- **Server file**: `server/index.ts` — sets up Express with CORS handling for Replit domains and localhost
- **Routes**: `server/routes.ts` — currently minimal, creates HTTP server. Routes should be prefixed with `/api`
- **Storage layer**: `server/storage.ts` — in-memory storage (`MemStorage`) with a user CRUD interface. This is a placeholder and can be swapped for database-backed storage
- **Static serving**: In production, the server serves the Expo web build

### Database Schema (Drizzle + PostgreSQL)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema location**: `shared/schema.ts`
- **Current tables**: `users` table with id (UUID), username, password
- **Validation**: Zod schemas generated via `drizzle-zod`
- **Migrations**: Output to `./migrations` directory, pushed via `drizzle-kit push`
- **Note**: The database schema is minimal and doesn't yet store projects — projects are currently stored client-side in AsyncStorage. The server storage is in-memory (`MemStorage`)

### AI Code Generation

- **Service**: `lib/ai-service.ts` handles multi-provider AI code generation
- **Supported providers**: Google Gemini (default, uses gemini-2.5-flash + flash-lite fallback), Groq (llama-3.3-70b + fallback models), HuggingFace (Mistral-7B)
- **Pattern**: User provides a natural language prompt → system prompt instructs the AI to generate a complete standalone `App.js` file → raw code is returned
- **Retry logic**: Each provider retries with exponential backoff on rate limits (429). Gemini supports Retry-After header. Multiple model fallbacks per provider.
- **No silent fallback**: If all AI providers fail, the app throws a clear error with actionable advice instead of silently returning a template
- **API keys**: Stored locally in app settings via AsyncStorage

### GitHub + EAS Build Integration

- **Service**: `lib/github-service.ts`
- **Features**: Create repos, push complete Expo project (App.js, package.json, app.json, eas.json, babel.config.js) to GitHub
- **Build flow**: Code is pushed to GitHub → GitHub Actions triggers EAS Build → APK is built in Expo's cloud
- **EAS Config**: `eas.json` with preview profile (APK), production profile (AAB), and development profile
- **Auth**: GitHub personal access token + Expo token (as GitHub repo secret) stored in app settings

### Build System

- **Dev workflow**: Express API server serves the landing page and API
- **Production build**: `scripts/build.js` handles Expo static web build, then Express serves the output
- **APK builds**: Handled by EAS Build (Expo's cloud build service) triggered from GitHub
- **Scripts**: `expo:dev` for mobile dev, `server:dev` for API server, `server:prod` for production

## External Dependencies

### AI Providers (configured by user in settings)
- **Google Gemini API** (`generativelanguage.googleapis.com`) — primary LLM for code generation
- **Groq API** (`api.groq.com`) — alternative fast inference provider
- **HuggingFace Inference API** (`api-inference.huggingface.co`) — uses Mistral-7B-Instruct model

### Services
- **GitHub API** (`api.github.com`) — repo creation, code pushing
- **Expo EAS Build** (`expo.dev`) — cloud-based APK/AAB builds triggered via GitHub Actions
- **PostgreSQL** — database via `DATABASE_URL` environment variable (used by Drizzle, provisioned by Replit)

### Key npm Packages
- `expo` ~54.0.27 — React Native framework
- `expo-router` ~6.0.17 — file-based routing
- `express` ^5.0.1 — backend API server
- `drizzle-orm` ^0.39.3 + `drizzle-kit` — database ORM and migrations
- `@tanstack/react-query` ^5.83.0 — server-state management
- `pg` ^8.16.3 — PostgreSQL client
- `react-native-reanimated` ~4.1.1 — animations
- `react-native-keyboard-controller` ^1.20.6 — keyboard handling