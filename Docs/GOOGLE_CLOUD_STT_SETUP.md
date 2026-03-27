# Google Cloud Speech-to-Text Setup Guide

## Problem Overview

The Deaf Mode in SenseBridge requires Google Cloud Speech-to-Text API to convert speech to text for caption generation and sign-language pipeline processing. Currently, the API is **billing-disabled** on project `986426461751`, causing HTTP 403 errors:

```
PERMISSION_DENIED: Billing is disabled for project 986426461751
```

This document provides step-by-step instructions to enable billing and the Speech-to-Text API.

---

## Quick Summary

| Step | Task | Time | Cost |
|------|------|------|------|
| 1 | Link billing account | 2 min | Free (billing setup) |
| 2 | Enable Speech-to-Text API | 2 min | Free (API activation) |
| 3 | Set budget alerts | 3 min | Free (protection) |
| 4 | Configure quota limits | 2 min | Free (protection) |
| 5 | Test STT endpoint | 1 min | ~$0.01 (free tier included) |

**Total Time: 10 minutes | Total Cost: Free (with proper budget setup)**

---

## Important: Cost Protection

**Enabling billing does NOT automatically charge you.** You only pay for actual API usage. However, to protect against unexpected charges, you must:

1. Set a **monthly budget alert** (e.g., $5)
2. Set **API quota limits** (e.g., 1000 calls/day)
3. Monitor usage in the Console

**Free Tier Benefit:**
- First 60 minutes of audio per month are FREE
- This covers ~100-150 typical speech recognition requests
- For development/testing, you'll likely stay within free tier

---

## Step 1: Link Billing Account

### Prerequisites
- Google account (the one that created project 986426461751)
- Valid payment method (credit/debit card)

### Instructions

1. **Go to Google Cloud Console Billing:**
   - Open: https://console.cloud.google.com/billing
   - Log in with your Google account

2. **Select Your Project:**
   - Click **"My Projects"** dropdown at the top-left
   - Select project **`sensebridge-susan07`** (or `986426461751`)

3. **Link Billing Account:**
   - If no billing is linked, you'll see a large blue button: **"LINK BILLING ACCOUNT"**
   - Click it
   - Select **"Create a new billing account"** (or select existing if you have one)
   - Enter your name, address, and payment method

4. **Verify Linking:**
   - You should see "Billing Enabled" status
   - The project slug `sensebridge-susan07` should display with billing active

### Screenshot Checklist
- [ ] Billing console shows your project
- [ ] Billing status shows "Active" (not "Disabled")
- [ ] Payment method is accepted

---

## Step 2: Enable Speech-to-Text API

### Instructions

1. **Go to API Library:**
   - Open: https://console.cloud.google.com/apis/library
   - Ensure you're in project `sensebridge-susan07`

2. **Search for Speech-to-Text:**
   - In the search box, type: `speech-to-text`
   - Click the **"Cloud Speech-to-Text API"** result (NOT "Text-to-Speech")

3. **Enable the API:**
   - Click the blue **"ENABLE"** button (top-right)
   - Wait for 30 seconds while it activates
   - You should see: "API Enabled" checkmark

4. **Create API Key (if needed):**
   - The API key in your `.env` file (GOOGLE_CLOUD_VISION_API_KEY) should now work
   - If you need to create a new key:
     - Go to: https://console.cloud.google.com/apis/credentials
     - Click **"+ CREATE CREDENTIALS"** → "API Key"
     - Copy the key and update your `.env` file

### Verification
- [ ] API shows "Enabled" in Library
- [ ] No warning messages in credentials

---

## Step 3: Set Budget Alerts

Budget alerts notify you when usage approaches a threshold. This prevents surprise charges.

### Instructions

1. **Go to Budgets:**
   - Open: https://console.cloud.google.com/billing/budgets
   - Ensure you're in the correct billing account

2. **Create a New Budget:**
   - Click **"+ CREATE BUDGET"**
   - Name: `SenseBridge STT Dev Budget`
   - Type: **"Specified amount"**
   - Amount: **$5.00** (or adjust based on comfort level)

3. **Set Threshold Actions:**
   - Click **"Threshold rules"**
   - Add threshold: **50% of budget** → Action: Email notification
   - Add threshold: **100% of budget** → Action: Email notification
   - Add threshold: **150% of budget** → Action: Email notification

4. **Save Budget:**
   - Click **"CREATE"**
   - Verify budget appears in list

### Rationale
- 50% alert lets you catch spikes early
- 100-150% alerts occur if quota enforcement fails (defense-in-depth)
- $5 monthly budget covers ~500-1000 dev API calls

---

## Step 4: Configure API Quota Limits

Quotas limit the number of API calls per period, preventing runaway costs.

### Instructions

1. **Go to Quotas:**
   - Open: https://console.cloud.google.com/apis/api/speech.googleapis.com/quotas
   - Ensure you're viewing "Cloud Speech-to-Text API" quotas

2. **Find Daily/Monthly Quotas:**
   - Look for rows like:
     - "Requests per minute per project"
     - "Requests per day per project"

3. **Edit Quota:**
   - Click on a quota row (e.g., "Requests per day")
   - Enter a safe limit: **`1000`** (per day)
   - This is small enough to catch bugs but large enough for testing
   - Click **"UPDATE QUOTA LIMIT"**

4. **Repeat for other quotas** as needed

### Alternative: Use Request Quotas
If daily limits aren't available, you can monitor usage in:
- https://console.cloud.google.com/monitoring/dashboards
- Create a custom dashboard graph for Speech-to-Text API calls

---

## Step 5: Test STT Endpoint

Once billing is linked and API is enabled, test the connection:

### Option A: Manual Test (PowerShell)

Run this in terminal after completing Steps 1-4, and waiting 5-10 minutes for propagation:

```powershell
# Extract API key from .env
$keyLine = Get-Content .env | Where-Object { $_ -match '^GOOGLE_CLOUD_VISION_API_KEY=' } | Select-Object -First 1
$key = $keyLine.Split('=',2)[1].Trim()

# Prepare minimal audio (1 second of silence)
$audioBase64 = "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAAA="

# Call Google Speech-to-Text API
$body = @{
    config = @{
        encoding = 'LINEAR16'
        sampleRateHertz = 16000
        languageCode = 'en-US'
    }
    audio = @{
        content = $audioBase64
    }
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://speech.googleapis.com/v1/speech:recognize?key=$key" `
    -ContentType 'application/json' `
    -Body $body

Write-Output "Success! Response:"
$response | ConvertTo-Json -Depth 10
```

**Expected Success Output:**
```json
{
  "results": []
}
```

**Expected Error If Still Disabled:**
```
PERMISSION_DENIED: Billing is disabled
```
→ If you still see this, wait 10 more minutes and retry

### Option B: Test via App

1. Open SenseBridge in Expo Go / Emulator
2. Navigate to **Deaf Mode**
3. Tap the **microphone button**
4. Speak a sentence (e.g., "Hello, how are you?")
5. Check result: Caption should appear or error message shown

---

## Troubleshooting

### Issue 1: "Billing is disabled" error still appears

**Solution:**
- [ ] Verify billing account is linked: https://console.cloud.google.com/billing
  - Should show "Billing Enabled" status
- [ ] Wait 10 minutes after linking for propagation
- [ ] Verify API is enabled: https://console.cloud.google.com/apis/library/speech.googleapis.com
  - Should show "API Enabled"
- [ ] Hard restart Expo: `npm start -- --clear`

### Issue 2: API key invalid or missing

**Solution:**
- [ ] Check `.env` file has: `GOOGLE_CLOUD_VISION_API_KEY=sk-xxx...` (not blank or placeholder)
- [ ] Create new API key if needed:
  - https://console.cloud.google.com/apis/credentials
  - Click **"+ CREATE CREDENTIALS"** → "API Key"
  - Copy and update `.env`
  - Restart app

### Issue 3: "Permission denied: The caller does not have permission"

**Solution:**
- [ ] Verify API key has "Cloud Speech-to-Text API" permissions (check API key restrictions in credentials page)
- [ ] Regenerate unrestricted API key:
  - https://console.cloud.google.com/apis/credentials
  - Edit key → Remove "API restrictions" → Save

### Issue 4: Unexpected charges appearing

**Solution:**
- [ ] Check usage https://console.cloud.google.com/billing/reports
  - Identify spike source
- [ ] Reduce quota limits further (e.g., 100/day instead of 1000/day)
- [ ] Disable API temporarily if abuse detected
- [ ] Contact Google Cloud support for investigation

---

## Verification Checklist

- [ ] Billing account linked to project `sensebridge-susan07`
- [ ] "Billing Status" shows "Active" (not "Disabled")
- [ ] Cloud Speech-to-Text API shows "Enabled"
- [ ] API key is set in `.env` (not blank/placeholder)
- [ ] Budget alert created ($5 threshold)
- [ ] Quota limits configured (1000/day)
- [ ] Manual test passed (or app STT working)
- [ ] Deaf Mode caption display working in app

---

## Next Steps (After Verification)

Once billing and API are working:

1. **Test Deaf Mode:**
   - Open SenseBridge → Deaf Mode → Speak
   - Should see live caption + gloss tokens

2. **Monitor Costs:**
   - Check https://console.cloud.google.com/billing/reports weekly
   - 60 min/month free; likely <$1/month for development

3. **Production Considerations:**
   - Consider speech recognition caching to reduce API calls
   - Monitor daily usage patterns for quota optimization
   - Document avg cost per user session

---

## References

- Google Cloud Billing: https://console.cloud.google.com/billing
- Speech-to-Text API Pricing: https://cloud.google.com/speech-to-text/pricing
- API Library: https://console.cloud.google.com/apis/library
- Budgets & Alerts: https://console.cloud.google.com/billing/budgets
- Quotas: https://console.cloud.google.com/apis/api/speech.googleapis.com/quotas

---

## FAQ

**Q: Will enabling billing auto-charge me?**
A: No. Billing setup = payment method registered. You only pay for actual API usage.

**Q: How much will STT cost?**
A: ~$0.006 per 15 seconds of audio. First 60 min/month free. Likely <$1/month for development.

**Q: Can I test without billing?**
A: No. Google requires active billing to use their APIs, even if you have free tier credits.

**Q: What if I hit the quota limit?**
A: API calls will be rejected with 429 "Too Many Requests" error. App will show error message instead of caption.

**Q: How long does billing enable to propagate?**
A: 5-15 minutes typically. If still not working after 15 min, check API is enabled and key is correct.

**Q: Can I use a different Google account?**
A: Yes, but you'll need a separate project or billing account linked to that account.

---

## Support

If you encounter issues not covered here:

1. Check Google Cloud status: https://status.cloud.google.com/
2. Review API error codes: https://cloud.google.com/speech-to-text/docs/error-codes
3. Check app logs: `npm start -- --clear` and watch console output
4. Contact Google Cloud Support: https://cloud.google.com/support

