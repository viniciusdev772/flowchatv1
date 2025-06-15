# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WhatsApp multi-session API built with Node.js, Express, and Baileys library. It provides:
- Multi-session WhatsApp bot management 
- Group management functionality
- Media handling and file uploads
- Webhook system supporting up to 3 webhooks per session
- Rate limiting and security features
- MongoDB integration with development fallback
- React frontend with Apple Liquid Glass design

## Architecture

The project follows a modular Express.js architecture:

- **main.js** - Entry point and server setup with middleware configuration
- **src/app.js** - Core Baileys WhatsApp logic and session management  
- **src/api/** - API route handlers (groups.js for WhatsApp group operations)
- **src/config/** - Configuration files (database.js, swagger.js)
- **src/middleware/** - Security, rate limiting, CSRF, and authentication middleware
- **src/controllers/** - Route controllers (authController.js)
- **src/routes/** - Express route definitions
- **frontend/** - React/Vite frontend with Tailwind CSS and Framer Motion

## Development Commands

```bash
# Backend development with hot reload
npm run dev

# Frontend development 
npm run frontend

# Run both backend + frontend simultaneously
npm run dev:full

# Production start
npm start

# Frontend build
npm run frontend:build

# Frontend preview (after build)
npm run frontend:preview

# Install frontend dependencies
npm install:frontend
```

## Key Technical Details

### Session Management
- Sessions stored in `sessions` Map in src/app.js
- WhatsApp auth sessions persisted in `auth_sessions/` directory
- Global `whatsappSessions` object accessible across modules

### Database Integration
- MongoDB with development fallback (continues without DB in dev mode)
- Session storage uses MongoDB when available, memory store otherwise
- Connection managed in src/config/database.js

### Security Features
- Advanced rate limiting with MongoDB persistence (src/middleware/advancedRateLimit.js)
- CSRF protection with token handling (src/middleware/csrf.js)
- Helmet security headers and CORS configuration
- Express session management with secure cookies

### Media Handling
- File uploads to `uploads/` directory
- Media downloads to `downloads/` directory  
- Multer middleware for file processing
- Base64 encoding for webhook media

### Webhook System
- Up to 3 webhooks per session with priorities
- Webhook data stored in `webhooks` Map
- Real-time event broadcasting to active webhooks

## Environment Requirements

Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `DB_NAME` - Database name
- `SESSION_SECRET` - Session secret key
- `COOKIE_SECRET` - Cookie signing secret
- `CORS_ORIGIN` - Frontend URL (default: http://localhost:5173)
- `PORT` - Server port (default: 3000)

## API Structure

- `/api/baileys/*` - WhatsApp operations (sessions, messages, media)
- `/api/baileys/groups/*` - Group management operations
- `/api/management/*` - Server management endpoints
- `/api-docs` - Swagger documentation
- `/api/management/health` - Health check endpoint

## Frontend Architecture

React application using:
- Vite for fast development and building
- Tailwind CSS for styling with custom Apple Liquid Glass theme
- Framer Motion for animations
- Headless UI for accessible components
- React Router for navigation

Frontend runs on port 5173 in development, backend on port 3000.