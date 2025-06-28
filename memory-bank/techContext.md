# Tech Context - FlowChat WhatsApp API

## Technologies Used
- **Backend**: Node.js 18+ with Express.js
- **WhatsApp Integration**: @whiskeysockets/baileys v6.7.18
- **Database**: MongoDB with connect-mongo session store
- **Frontend**: React 19 + Vite with Tailwind CSS
- **Authentication**: express-session + bcryptjs + JWT
- **Security**: Helmet, CORS, CSRF protection, express-mongo-sanitize
- **File Handling**: Multer, Sharp, fs-extra
- **Logging**: Pino with pretty printing
- **Documentation**: Swagger (swagger-jsdoc + swagger-ui-express)
- **Animation**: Framer Motion
- **Development**: Nodemon, Concurrently

## Development Setup
```bash
# Backend development with hot reload
npm run dev

# Frontend development 
npm run frontend

# Run both backend + frontend simultaneously
npm run dev:full

# Production start
npm start
```

## Key Dependencies
- **@whiskeysockets/baileys**: Core WhatsApp Web API implementation
- **express**: Web framework for API routes
- **mongodb**: Database driver with connection pooling
- **helmet**: Security middleware for HTTP headers
- **bcryptjs**: Password hashing and authentication
- **sharp**: Image processing for media handling
- **qrcode**: QR code generation for WhatsApp authentication
- **pino**: High-performance logging
- **multer**: File upload handling middleware

## Environment Requirements
- Node.js 18+
- MongoDB 4.4+
- 2GB+ RAM for multi-session handling
- 10GB+ storage for media downloads and auth sessions
