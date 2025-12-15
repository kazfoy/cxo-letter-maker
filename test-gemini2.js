const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyDq_g9qWDCXNuOi-dHAKLRV3L69LCwp2TU');

async function testModels() {
  const modelNames = [
    'gemini-2.0-flash-exp',
    'gemini-exp-1206',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-002',
    'gemini-1.5-pro-002',
  ];

  for (const modelName of modelNames) {
    try {
      console.log(`\nTesting model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello in Japanese');
      const response = result.response.text();
      console.log(`✓ SUCCESS: ${modelName}`);
      console.log(`Response: ${response}`);
      break; // 成功したら終了
    } catch (error) {
      console.log(`✗ FAILED: ${modelName}`);
      console.log(`Error: ${error.message.substring(0, 150)}...`);
    }
  }
}

testModels();
