const fs = require('fs');
const path = require('path');

// 1. Path to your .env file
const envPath = path.join(__dirname, '..', '.env');
let apiKey = null;

// 2. Read the .env file manually
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  // Look for GOOGLE_CLOUD_VISION_API_KEY
  const match = envContent.match(/^GOOGLE_CLOUD_VISION_API_KEY=(.*)$/m);
  if (match && match[1]) {
    // Remove quotes or extra spaces if present
    apiKey = match[1].replace(/['"]/g, '').trim();
  }
} catch (e) {
  console.warn("⚠️ Could not read .env file. Make sure it exists in the root directory.");
}

// Ensure we have an API key
if (!apiKey) {
  console.error("❌ GOOGLE_CLOUD_VISION_API_KEY not found in the .env file.");
  console.error("Make sure you have added it to your .env like this:\nGOOGLE_CLOUD_VISION_API_KEY=your_actual_api_key_here");
  process.exit(1);
}

console.log(`✅ Found API key in .env (ends with ...${apiKey.slice(-5)})`);
console.log("⏳ Testing Google Cloud Vision API with a sample image...\n");

// 3. Test Function
async function testVisionAPI() {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  
  // We will use a public image for the test (a standard cat image from Wikipedia)
  const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg';

  const requestBody = {
    requests: [
      {
        image: {
          source: { imageUri: testImageUrl }
        },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 3 }
        ]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.responses && data.responses[0].labelAnnotations) {
      console.log("🎉 SUCCESS! Your Google Cloud Vision API key is valid and working.");
      console.log("\nResults for the sample image:");
      
      const labels = data.responses[0].labelAnnotations;
      labels.forEach(label => {
        console.log(` 🏷️ ${label.description} (Confidence: ${(label.score * 100).toFixed(2)}%)`);
      });
      console.log("\nYou are ready to use this key in the SenseBridge app!");
    } else if (response.ok && data.responses && data.responses[0].error) {
      console.error("❌ API ERROR: The request was authenticated, but Vision API returned an error:");
      console.error(data.responses[0].error.message);
    } else {
      console.error("❌ AUTH/BILLING ERROR: The API returned an error.");
      console.error(JSON.stringify(data.error, null, 2));
      
      if (data.error?.message?.includes("billing")) {
          console.log("\n💡 HINT: Your API key is correct, but Cloud Vision requires a Billing Account to be linked to your Google Cloud Project.");
      }
    }
  } catch (error) {
    console.error("❌ NETWORK ERROR: Failed to reach the API.");
    console.error(error.message);
  }
}

testVisionAPI();
