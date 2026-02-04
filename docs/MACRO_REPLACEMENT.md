# Macro Replacement System

The OpenAdServer supports dynamic macro replacement in landing URLs. This allows advertisers to track detailed information about each ad impression by embedding context variables in their landing page URLs.

## How It Works

When creating a creative, use macros in the `landing_url` field with the format `${MACRO_NAME}`. At runtime, these macros will be replaced with actual values from the ad request context.

## Example

**Input (stored in database):**
```
https://example.com/landing/5?creative_id=${CREATIVE_ID}&user_id=${USER_ID}&country=${COUNTRY}
```

**Output (in ad response):**
```
https://example.com/landing/5?creative_id=7&user_id=test_user_123&country=CN
```

## Supported Macros

### Request Information
- `${REQUEST_ID}` - Unique request identifier
- `${TIMESTAMP}` - Current timestamp in milliseconds
- `${TIMESTAMP_MS}` - Current timestamp in milliseconds (alias)
- `${TIMESTAMP_SEC}` - Current timestamp in seconds
- `${CACHEBUSTER}` - Random alphanumeric string for cache busting
- `${RANDOM}` - Random number (0-999999999)

### Ad Information
- `${AD_ID}` - Composite ad identifier (format: `ad_{campaign_id}_{creative_id}`)
- `${CREATIVE_ID}` - Creative ID
- `${CAMPAIGN_ID}` - Campaign ID
- `${ADVERTISER_ID}` - Advertiser ID

### Pricing & Bidding
- `${BID}` - Bid amount
- `${BID_TYPE}` - Bid type (0=CPM, 1=CPC, 2=CPA, 3=OCPM)
- `${ECPM}` - Effective CPM

### Creative Details
- `${CREATIVE_TYPE}` - Creative type (0=Image, 1=Video, 2=HTML, 3=Native)
- `${CREATIVE_TITLE}` - Creative title (URL-encoded)
- `${CREATIVE_WIDTH}` - Creative width in pixels
- `${CREATIVE_HEIGHT}` - Creative height in pixels

### User Context
- `${USER_ID}` - User identifier
- `${IP}` - User IP address
- `${OS}` - Operating system (ios, android, windows, etc.)
- `${COUNTRY}` - Country code (e.g., US, CN, UK)
- `${CITY}` - City name
- `${APP_ID}` - Application identifier
- `${DEVICE_MODEL}` - Device model (e.g., iPhone14,2)

### User Demographics (when available)
- `${AGE}` - User age
- `${GENDER}` - User gender

### User Interests
- `${INTERESTS}` - Comma-separated list of user interests

### ML Predictions (when available)
- `${PCTR}` - Predicted click-through rate
- `${PCVR}` - Predicted conversion rate
- `${SCORE}` - Final ranking score

## Usage Examples

### Basic Tracking
```
https://yoursite.com/land?cid=${CAMPAIGN_ID}&crid=${CREATIVE_ID}&uid=${USER_ID}
```

### Advanced Attribution
```
https://yoursite.com/track?
  ad_id=${AD_ID}&
  request_id=${REQUEST_ID}&
  user=${USER_ID}&
  country=${COUNTRY}&
  os=${OS}&
  ts=${TIMESTAMP}
```

### Cache Busting
```
https://yoursite.com/page?
  campaign=${CAMPAIGN_ID}&
  cb=${CACHEBUSTER}
```

### A/B Testing
```
https://yoursite.com/landing?
  variant=${CREATIVE_ID}&
  segment=${INTERESTS}&
  device=${OS}
```

## Notes

- All macro values are automatically URL-encoded
- Unknown macros are left unchanged
- Empty/null values result in empty strings
- Macros are case-sensitive (must be uppercase)
- Use `&` for query parameter separators (will be properly encoded)

## Testing

Update a creative's landing URL via the Admin API:

```bash
curl -X PUT http://localhost:3000/api/v1/creatives/7 \
  -H "Content-Type: application/json" \
  -d '{
    "landing_url": "https://example.com/landing?creative_id=${CREATIVE_ID}&user=${USER_ID}&ts=${TIMESTAMP}"
  }'
```

Then request an ad to see the macros replaced:

```bash
curl -X POST http://localhost:3000/ad/get \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": "home_banner",
    "user_id": "test_user_123",
    "os": "ios",
    "country": "US"
  }'
```
