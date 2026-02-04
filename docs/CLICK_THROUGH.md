# Click-Through Landing Page Mechanism

The landing page URL is now wrapped in a click-through redirect that enables server-side click tracking before sending users to their final destination.

## URL Structure

### Ad Response Landing URL
```
http://localhost:3000/tracking/click?
  click_id={uuid}&
  bid={bid_amount}&
  p={pctr}&
  rid={request_id}&
  to={encoded_destination_url}
```

### Destination URL (to parameter, decoded)
```
https://example.com/landing/5?
  creative_id=7&
  campaign_id=5&
  user_id=test_user_999&
  request_id=17716a4f-bd92-4db6-9ef4-9fb8f25fc9f9&
  os=ios&
  country=CN&
  timestamp=1770209118282&
  click_id=4a2aae9f-bccb-4b69-9f8f-bb3bad73d205&
  utm_source=openadserver&
  utm_medium=cpc&
  utm_campaign=5
```

## Flow

```
User clicks ad → /tracking/click (server-side)
                      ↓
                 Log click event
                      ↓
                 302 redirect → Final landing page
```

## Benefits

### 1. Server-Side Click Tracking
- **Guaranteed tracking**: Click is logged before redirect
- **No client-side dependency**: No reliance on JavaScript or pixels
- **Bot filtering**: Server can validate/filter bot traffic

### 2. Rich Attribution Data
The final landing page receives:
- **click_id**: Unique identifier for this specific impression
- **UTM parameters**: Standard marketing attribution (source, medium, campaign)
- **Context**: User info, device, location from macro replacement
- **Timing**: Request ID and timestamp for correlation

### 3. Advertiser Analytics
Advertisers can:
- Track user journey from ad click to conversion
- Correlate click_id with their own analytics systems
- Use UTM parameters in Google Analytics, etc.
- Implement server-side conversion tracking

## Implementation Details

### Step 1: Macro Replacement
Apply macros to the original creative landing_url:
```typescript
const originalLandingUrl = macroReplacer.replace(creative.landing_url, {
  requestId, candidate, userContext, timestamp
});
// Result: https://example.com/product?creative_id=7&user_id=user123...
```

### Step 2: Add Click ID and UTM
Append click_id and UTM parameters:
```typescript
const urlSeparator = originalLandingUrl.includes('?') ? '&' : '?';
const internalUrl = `${originalLandingUrl}${urlSeparator}click_id=${clickId}&utm_source=openadserver&utm_medium=cpc&utm_campaign=${campaign_id}`;
// Result: https://example.com/product?creative_id=7&click_id=uuid&utm_source=openadserver...
```

### Step 3: Wrap in Click-Through
Encode the destination as `to` parameter:
```typescript
const landingUrl = `${baseUrl}/tracking/click?click_id=${clickId}&bid=${bid}&p=${pctr}&rid=${requestId}&to=${encodeURIComponent(internalUrl)}`;
```

### Redirect Handler
```typescript
@Get('click')
async clickThrough(@Query('to') to: string, ...) {
  // 1. Validate
  if (!to) throw new BadRequestException();
  
  // 2. Track (async)
  trackingService.track({ type: 'click', click_id });
  
  // 3. Redirect (302)
  res.redirect(to);
}
```

## Example

### Request
```bash
curl -X POST http://localhost:3000/ad/get \
  -H "Content-Type: application/json" \
  -d '{"slot_id": "banner", "user_id": "user123"}'
```

### Response
```json
{
  "candidates": [{
    "landing_url": "http://localhost:3000/tracking/click?click_id=abc&bid=5&p=0.02&rid=req123&to=https%3A%2F%2Fexample.com%2Fproduct%3Fclick_id%3Dabc%26utm_source%3Dopenadserver"
  }]
}
```

### User Clicks
1. **Browser requests**: `GET /tracking/click?click_id=abc&to=https://example.com/product?click_id=abc&utm_source=openadserver`
2. **Server logs**: Click event in database with click_id=abc
3. **Server responds**: `302 Location: https://example.com/product?click_id=abc&utm_source=openadserver`
4. **Browser follows**: User lands on advertiser's page with full context

## Tracking Pixels vs Click-Through

### Tracking Pixels (imp_pixel, conversion_pixel)
- **Use**: Fire from client-side (JavaScript, <img> tag)
- **Format**: `http://localhost:3000/tracking/track?click_id=abc&type=imp`
- **Response**: 1x1 transparent GIF

### Click-Through (landing_url)
- **Use**: User navigation (href, window.location)
- **Format**: `http://localhost:3000/tracking/click?click_id=abc&to=...`
- **Response**: 302 redirect to destination

## Configuration

### Base URL
Set `BASE_URL` environment variable for production:
```bash
BASE_URL=https://ads.example.com
```

This affects:
- Click-through URLs: `${BASE_URL}/tracking/click?...`
- Tracking pixels: `${BASE_URL}/tracking/track?...`

## Monitoring

### Check Click Events
```bash
curl "http://localhost:3000/api/v1/events?limit=10"
```

### Filter by Click Type
```sql
SELECT * FROM ad_events 
WHERE event_type = 2  -- CLICK
AND click_id = 'abc'
ORDER BY event_time DESC;
```

### Verify Redirect
```bash
curl -i "http://localhost:3000/tracking/click?click_id=test&to=https://google.com"
# Should return: HTTP/1.1 302 Found
#                Location: https://google.com
```
