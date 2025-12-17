import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { question, communityName } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ answer: "Error: API Key belum diisi di .env.local" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // --- UPDATE: MENGGUNAKAN GEMINI 2.0 FLASH ---
    // Model ini lebih baru dan cepat.
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
      Kamu adalah admin komunitas "${communityName || 'Umum'}".
      Jawab pertanyaan ini dengan santai, singkat (max 2 kalimat), dan bahasa Indonesia gaul:
      "${question}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return NextResponse.json({ answer: response.text() });

  } catch (error) {
    console.error(">>> AI ERROR:", error);
    
    let msg = "Maaf, AI sedang gangguan.";
    
    // Cek error spesifik
    if (error.message?.includes("not found")) {
        msg = "Model Gemini 2.0 tidak ditemukan di akun ini. Coba buat API Key baru.";
    } else if (error.message?.includes("API key not valid")) {
        msg = "API Key Salah/Expired.";
    }

    return NextResponse.json({ answer: msg }, { status: 500 });
  }
}