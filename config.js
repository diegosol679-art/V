// ============================================================
//  config.js — Gemini UI Configuration
//  Update this file when models or prices change!
// ============================================================

const CONFIG = {

  // ---------- API ----------
  // Gemini API endpoint — model name gets inserted dynamically in app.js
  apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",

  // ---------- Models ----------
  models: [
    {
      id: "gemini-2.0-flash",
      label: "Gemini 2.0 Flash",
      description: "Newest & fastest, great for most tasks",
      inputPricePerMillion: 0.10,
      outputPricePerMillion: 0.40,
    },
    {
      id: "gemini-2.0-flash-lite",
      label: "Gemini 2.0 Flash Lite",
      description: "Super cheap & quick, good for simple tasks",
      inputPricePerMillion: 0.075,
      outputPricePerMillion: 0.30,
    },
    {
      id: "gemini-1.5-pro",
      label: "Gemini 1.5 Pro",
      description: "Most powerful, best for complex reasoning",
      inputPricePerMillion: 1.25,
      outputPricePerMillion: 5.00,
    },
    {
      id: "gemini-1.5-flash",
      label: "Gemini 1.5 Flash",
      description: "Fast & affordable all-rounder",
      inputPricePerMillion: 0.075,
      outputPricePerMillion: 0.30,
    },
  ],

  // ---------- Defaults ----------
  defaults: {
    model: "gemini-2.0-flash",
    temperature: 0.5,
    maxTokens: 1024,
    systemPrompt: "You are a helpful assistant.",
  },

  // ---------- Token / Cost Display ----------
  cost: {
    decimalPlaces: 6,
    currency: "USD",
  },

  // ---------- UI ----------
  ui: {
    appName: "Gemini UI ✨",
    temperatureMin: 0,
    temperatureMax: 2,   // Gemini supports up to 2.0
    temperatureStep: 0.05,
    maxTokensMin: 256,
    maxTokensMax: 8192,
    maxTokensStep: 256,
  },

};

// Helper: get config for a given model id
function getModelConfig(modelId) {
  return CONFIG.models.find((m) => m.id === modelId) || CONFIG.models[0];
}

// Helper: estimate cost from token counts
function estimateCost(inputTokens, outputTokens, modelId) {
  const model = getModelConfig(modelId);
  const inputCost  = (inputTokens  / 1_000_000) * model.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}
