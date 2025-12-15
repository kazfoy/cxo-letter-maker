const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || 'AIzaSyDq_g9qWDCXNuOi-dHAKLRV3L69LCwp2TU');

async function testModels() {
  const modelNames = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-pro',
    'gemini-pro',
  ];

  for (const modelName of modelNames) {
    try {
      console.log(`\nTesting model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello');
      const response = result.response.text();
      console.log(`✓ SUCCESS: ${modelName}`);
      console.log(`Response: ${response.substring(0, 50)}...`);
      break; // 成功したら終了
    } catch (error) {
      console.log(`✗ FAILED: ${modelName}`);
      console.log(`Error: ${error.message}`);
    }
  }
}

testModels();
