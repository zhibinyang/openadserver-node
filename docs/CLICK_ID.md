# Click ID Mechanism

The Click ID mechanism provides a robust way to track the complete lifecycle of an ad impression, from delivery to conversion, using a single unique identifier.

## Overview

When an ad is served, the system generates a unique `click_id` (UUID) for each candidate. This ID is:
1. Stored in Redis with all relevant context (30-day TTL)
2. Embedded in tracking pixels (imp_pixel, click_pixel, conversion_pixel)
3. Logged in the database for all tracking events

## Architecture

### 1. Ad Response Flow

```
User Request → Ad Engine → Generate click_id per candidate
                         ↓
                      Store in Redis (click:{uuid})
                         ↓
                      Return pixels with click_id
```

### 2. Tracking Flow

```
Pixel Fired → Extract click_id → Retrieve context from Redis
                                 ↓
                              Log to Database with click_id
                                 ↓
                              Update Redis counters
```

## Implementation Details

### Ad Response (`engine.controller.ts`)

For each candidate ad:
```typescript
const clickId = randomUUID();

// Store metadata in Redis
await redisService.set(`click:${clickId}`, JSON.stringify({
    request_id, campaign_id, creative_id, advertiser_id,
    user_id, bid, ecpm, pctr, pcvr, timestamp, os, country, app_id
}), 30 * 24 * 60 * 60); // 30 days TTL

// Return pixels with click_id
{
    imp_pixel: `${baseUrl}/track?click_id=${clickId}&type=imp`,
    click_pixel: `${baseUrl}/track?click_id=${clickId}&type=click`,
    conversion_pixel: `${baseUrl}/track?click_id=${clickId}&type=conversion`
}
```

### Tracking (`tracking.service.ts`)

Two tracking methods are supported:

#### Primary Method: click_id
```http
GET /track?click_id=2ec1c303-3f8b-4758-9431-191f5d025dd6&type=imp
```

- Retrieves all context from Redis `click:{uuid}`
- Logs event to database with click_id
- Updates budget and frequency counters

#### Legacy Method: cid/crid
```http
GET /track?cid=5&crid=7&uid=user123&type=click
```

- Directly uses campaign_id and creative_id
- Backward compatible with old integrations
- Generates new request_id for legacy tracking

### Database Schema

```sql
ALTER TABLE ad_events ADD COLUMN click_id VARCHAR(64);
CREATE INDEX ad_events_click_id_idx ON ad_events (click_id);
```

## Benefits

### 1. Attribution Accuracy
- Unique identifier links impression → click → conversion
- No reliance on cookies or user_id
- Works across domains and devices (when integrated with deep linking)

### 2. Performance
- Redis lookup is O(1) with click_id
- Index on click_id enables fast database queries
- All context stored once, retrieved as needed

### 3. Analytics
Query all events for a single ad impression:
```sql
SELECT * FROM ad_events 
WHERE click_id = '2ec1c303-3f8b-4758-9431-191f5d025dd6'
ORDER BY event_time;
```

### 4. Data Enrichment
Redis stores rich context that may not be available at tracking time:
- Original request_id
- Bid and pricing information (ecpm, pctr, pcvr)
- User context (os, country, app_id)
- Advertiser hierarchy (advertiser_id)

## Example Flow

### 1. Request Ad
```bash
curl -X POST http://localhost:3000/ad/get \
  -H "Content-Type: application/json" \
  -d '{"slot_id": "banner", "user_id": "user123", "os": "ios"}'
```

**Response:**
```json
{
  "request_id": "req-abc",
  "candidates": [{
    "ad_id": "ad_5_7",
    "imp_pixel": "http://localhost:3000/track?click_id=uuid-123&type=imp",
    "click_pixel": "http://localhost:3000/track?click_id=uuid-123&type=click",
    "conversion_pixel": "http://localhost:3000/track?click_id=uuid-123&type=conversion"
  }]
}
```

### 2. Fire Impression
```bash
curl "http://localhost:3000/track?click_id=uuid-123&type=imp"
```

**Internal Process:**
1. Lookup `click:uuid-123` in Redis
2. Extract: campaign_id=5, creative_id=7, user_id=user123
3. Insert event: `{request_id: req-abc, click_id: uuid-123, event_type: IMPRESSION}`
4. Update frequency cap: `freq:user123:5`

### 3. Fire Click
```bash
curl "http://localhost:3000/track?click_id=uuid-123&type=click"
```

**Internal Process:**
1. Same click_id retrieves same context
2. Insert event: `{request_id: req-abc, click_id: uuid-123, event_type: CLICK}`
3. All events share same click_id

### 4. Query Attribution
```bash
curl "http://localhost:3000/api/v1/events?limit=10"
```

**Result:**
```json
[
  {"click_id": "uuid-123", "event_type": 2, "event_time": "2026-02-04T12:18:50Z"},
  {"click_id": "uuid-123", "event_type": 1, "event_time": "2026-02-04T12:18:47Z"}
]
```

## Redis Data Structure

**Key:** `click:{uuid}`

**Value (JSON):**
```json
{
  "request_id": "424e4b25-5d9b-45a5-8e91-d4401b51381d",
  "campaign_id": 5,
  "creative_id": 7,
  "advertiser_id": 3,
  "user_id": "test_user_789",
  "bid": 5,
  "bid_type": 2,
  "ecpm": 15.234,
  "pctr": 0.01523,
  "pcvr": 0.00234,
  "timestamp": 1770207512141,
  "os": "android",
  "country": "US",
  "app_id": "default_app"
}
```

**TTL:** 30 days (2,592,000 seconds)

## Monitoring

### Check Redis Storage
```bash
# Get stored click data
redis-cli GET "click:2ec1c303-3f8b-4758-9431-191f5d025dd6"

# Check TTL
redis-cli TTL "click:2ec1c303-3f8b-4758-9431-191f5d025dd6"
```

### Query Events by Click ID
```sql
SELECT 
  click_id,
  event_type,
  event_time,
  campaign_id,
  user_id
FROM ad_events
WHERE click_id = '2ec1c303-3f8b-4758-9431-191f5d025dd6'
ORDER BY event_time;
```

## Migration Notes

- Legacy tracking (cid/crid) remains supported for backward compatibility
- New integrations should use click_id exclusively
- Existing pixels will continue to work during migration period
- Both methods can coexist indefinitely
