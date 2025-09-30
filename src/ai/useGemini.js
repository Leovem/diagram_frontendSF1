// src/ai/useGemini.js
import { useState, useMemo } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const genAI = useMemo(() => (apiKey ? new GoogleGenerativeAI(apiKey) : null), [apiKey]);
  const ensureReady = () => {
    if (!apiKey) throw new Error("Falta VITE_GEMINI_API_KEY en .env.local");
    if (!genAI) throw new Error("Cliente Gemini no inicializado");
  };

  const generateTextStream = async (prompt, onChunk, model = "gemini-2.5-flash") => {
    setLoading(true); setError(null);
    try {
      ensureReady();
      const m = genAI.getGenerativeModel({ model });
      const result = await m.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const t = chunk.text(); if (t) onChunk(t);
      }
    } catch (e) { setError(e.message || "Error inesperado"); throw e; }
    finally { setLoading(false); }
  };

  return { generateTextStream, loading, error };
};
