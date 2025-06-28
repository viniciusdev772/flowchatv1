# Troubleshooting Guide - FlowChat WhatsApp API

## Common Issues & Solutions

### WhatsApp Session Issues

#### QR Code Not Generating
**Symptoms**: No QR code appears or invalid QR code
**Causes**:
- Session already authenticated
- Network connectivity issues
- Baileys library issues

**Solutions**:
1. Check session status: `GET /api/baileys/sessions/status/:sessionId`
2. Clear session auth data: Delete `auth_sessions/:sessionId/` directory
3. Restart session: `DELETE` then `POST /api/baileys/sessions/start`
4. Check logs for Baileys connection errors

#### Session Disconnecting Frequently
**Symptoms**: Session keeps disconnecting and requiring re-authentication
**Causes**:
- WhatsApp security measures
- Multiple devices using same number
- Network instability

**Solutions**:
1. Ensure only one session per phone number
2. Check network stability and firewall settings
3. Implement proper reconnection handling
4. Monitor `connection.update` webhook events

#### Messages Not Sending
**Symptoms**: API returns success but messages don't deliver
**Causes**:
- Invalid recipient number format
- Session not fully connected
- Rate limiting by WhatsApp

**Solutions**:
1. Verify number format: +country_code+number (e.g., +5511999999999)
2. Check session status before sending
3. Implement message queue with retry logic
4. Monitor webhook delivery confirmations

### Database Connection Issues

#### MongoDB Connection Failed
**Symptoms**: Database connection errors in logs
**Causes**:
- MongoDB server not running
- Incorrect connection string
- Network connectivity issues

**Solutions**:
1. Verify MongoDB is running: `mongod --version`
2. Check connection string in environment variables
3. Test connection manually: `mongo "your_connection_string"`
4. Application continues without DB in development mode

#### Session Store Issues
**Symptoms**: Users logged out frequently or session data lost
**Causes**:
- MongoDB session collection issues
- Session secret changes
- Memory vs persistent storage conflicts

**Solutions**:
1. Check MongoDB sessions collection
2. Verify SESSION_SECRET environment variable
3. Clear sessions collection if needed
4. Restart application to reinitialize session store

### API Authentication Issues

#### Invalid API Token
**Symptoms**: 401 Unauthorized errors with valid-looking token
**Causes**:
- Token doesn't have "baileys_" prefix
- Token expired or deleted
- Wrong authorization header format

**Solutions**:
1. Verify token prefix: Must start with "baileys_"
2. Check token in database: Users collection
3. Use correct header: `Authorization: Bearer baileys_your_token`
4. Generate new token if needed

#### CSRF Token Mismatch
**Symptoms**: 403 Forbidden errors from frontend
**Causes**:
- Missing CSRF token in requests
- Token expired or invalid
- CORS configuration issues

**Solutions**:
1. Include CSRF token in request headers: `X-CSRF-Token`
2. Get fresh token from `/api/management/auth/csrf-token`
3. Check CORS_ORIGIN environment variable
4. Verify frontend making credentialed requests

### Media Handling Issues

#### File Upload Failures
**Symptoms**: Media upload returns errors or files not processed
**Causes**:
- File size exceeds limits
- Unsupported file format
- Disk space issues
- Multer configuration problems

**Solutions**:
1. Check file size limits in Multer configuration
2. Verify supported file types: images, videos, audio, documents
3. Check disk space in `uploads/` directory
4. Monitor Sharp image processing errors

#### Media Download Broken
**Symptoms**: Download URLs return 404 or corrupted files
**Causes**:
- File expired (7-day limit)
- File system permissions
- Download ID not found in database

**Solutions**:
1. Check file exists in `downloads/` directory
2. Verify download metadata in MongoDB
3. Check file permissions and ownership
4. Re-download media if expired

### Webhook Delivery Issues

#### Webhooks Not Firing
**Symptoms**: No webhook notifications received
**Causes**:
- Webhook URL unreachable
- SSL certificate issues
- Webhook not properly configured

**Solutions**:
1. Test webhook URL manually with POST request
2. Verify SSL certificate validity
3. Check webhook configuration in session
4. Monitor webhook delivery logs

#### Webhook Payload Issues
**Symptoms**: Webhook receives data but format is unexpected
**Causes**:
- Message processing errors
- Quoted message extraction failures
- Media download failures

**Solutions**:
1. Check `extractMessageData()` function logs
2. Verify quoted message handling
3. Test webhook with different message types
4. Check Base64 encoding for media

### Performance Issues

#### High Memory Usage
**Symptoms**: Application using excessive RAM
**Causes**:
- Multiple active sessions
- Large media files in memory
- Memory leaks in session handling

**Solutions**:
1. Monitor session count and limit concurrent sessions
2. Implement media file cleanup
3. Use heap dumps to identify memory leaks
4. Restart application periodically if needed

#### Slow API Response Times
**Symptoms**: API endpoints taking too long to respond
**Causes**:
- Database query optimization needed
- Lack of caching
- Heavy media processing

**Solutions**:
1. Verify user profile caching (5-minute cache)
2. Optimize database queries with indexes
3. Implement request-level caching where appropriate
4. Monitor Pino logs for slow operations

### Environment & Configuration Issues

#### Environment Variables Not Loading
**Symptoms**: Application using default values instead of env vars
**Causes**:
- .env file not in correct location
- Variable names mismatch
- dotenv not properly configured

**Solutions**:
1. Verify .env file in project root
2. Check variable names match code expectations
3. Restart application after env changes
4. Use console.log to debug variable loading

#### Port Conflicts
**Symptoms**: Application fails to start with port errors
**Causes**:
- Port already in use
- Permission issues (ports < 1024)
- Multiple instances running

**Solutions**:
1. Change PORT environment variable
2. Check running processes: `lsof -i :3000`
3. Kill existing processes if needed
4. Use higher port numbers (3000+)

## Debugging Commands

### Check Session Status
```bash
# View active sessions
curl -H "Authorization: Bearer baileys_your_token" \
  http://localhost:3000/api/baileys/sessions/list

# Check specific session
curl -H "Authorization: Bearer baileys_your_token" \
  http://localhost:3000/api/baileys/sessions/status/session_id
```

### Database Debugging
```bash
# Connect to MongoDB
mongo "your_connection_string"

# Check collections
use your_database_name
show collections
db.sessions.find().limit(5)
db.downloads.find().limit(5)
```

### Log Analysis
```bash
# Follow application logs
npm run dev | grep "ERROR\|WARN"

# Check specific session logs
npm run dev | grep "session_id"

# Monitor webhook deliveries
npm run dev | grep "webhook"
```

### File System Checks
```bash
# Check auth sessions
ls -la auth_sessions/

# Check downloads directory
ls -la downloads/

# Check uploads directory
ls -la uploads/

# Disk space
df -h
```

## Emergency Procedures

### Complete System Reset
1. Stop application: `Ctrl+C` or `pm2 stop`
2. Clear all sessions: `rm -rf auth_sessions/*`
3. Clear downloads: `rm -rf downloads/*`
4. Clear uploads: `rm -rf uploads/*`
5. Clear MongoDB sessions: `db.sessions.deleteMany({})`
6. Restart application: `npm start`

### Session-Specific Reset
1. Stop specific session via API
2. Remove auth data: `rm -rf auth_sessions/session_id/`
3. Clear session from global map
4. Restart session via API

### Database Recovery
1. Export data: `mongodump --uri="connection_string"`
2. Clear problematic collections
3. Restart application
4. Re-import data if needed: `mongorestore`

## Monitoring & Alerts

### Key Metrics to Monitor
- Active session count
- Memory usage
- Database connection status
- Webhook delivery success rate
- API response times
- Error rate in logs

### Log Patterns to Watch
- `"SESSION_DISCONNECTED"` - Session stability issues
- `"WEBHOOK_DELIVERY_FAILED"` - Webhook problems
- `"DATABASE_CONNECTION_ERROR"` - DB issues
- `"AUTHENTICATION_FAILED"` - Auth problems
- `"MEDIA_PROCESSING_ERROR"` - File handling issues