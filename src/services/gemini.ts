import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
};

export interface CameraParams {
  azimuth: number;
  elevation: number;
  distance: number;
  prompt?: string;
}

// Azimuth mappings (8 positions)
const AZIMUTH_MAP: Record<number, string> = {
  0: "front view",
  45: "front-right quarter view",
  90: "right side view",
  135: "back-right quarter view",
  180: "back view",
  225: "back-left quarter view",
  270: "left side view",
  315: "front-left quarter view"
};

// Elevation mappings (4 positions)
const ELEVATION_MAP: Record<number, string> = {
  "-30": "low-angle shot",
  0: "eye-level shot",
  30: "elevated shot",
  60: "high-angle shot"
};

// Distance mappings (3 positions)
const DISTANCE_MAP: Record<string, string> = {
  "0.6": "close-up",
  "1.0": "medium shot",
  "1.4": "wide shot"
};

function snapToNearest(value: number, options: number[]): number {
  return options.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

export function buildCameraPrompt(azimuth: number, elevation: number, distance: number): string {
  const azimuthSnapped = snapToNearest(azimuth, Object.keys(AZIMUTH_MAP).map(Number));
  const elevationSnapped = snapToNearest(elevation, Object.keys(ELEVATION_MAP).map(Number));
  const distanceSnapped = snapToNearest(distance, [0.6, 1.0, 1.4]);

  const azimuthName = AZIMUTH_MAP[azimuthSnapped];
  const elevationName = ELEVATION_MAP[elevationSnapped as keyof typeof ELEVATION_MAP];
  const distanceKey = distanceSnapped === 1 ? "1.0" : distanceSnapped.toFixed(1);
  const distanceName = DISTANCE_MAP[distanceKey];

  return `<sks> ${azimuthName} ${elevationName} ${distanceName}`;
}

export const generateNewPerspective = async (
  base64Image: string,
  params: CameraParams
): Promise<string | null> => {
  const ai = getAI();
  
  // Extract mime type from base64 string
  const mimeType = base64Image.match(/data:(.*?);base64/)?.[1] || "image/png";
  const imageData = base64Image.split(",")[1];

  const cameraPrompt = buildCameraPrompt(params.azimuth, params.elevation, params.distance);

  const systemPrompt = `
    You are a 3D camera simulation and scene re-rendering expert. 
    Based on the provided image, generate a COMPLETELY NEW image from a different camera perspective.
    
    Camera Instruction: ${cameraPrompt}
    
    CRITICAL INSTRUCTIONS:
    1. RE-RENDER THE ENTIRE SCENE: Do not just warp the existing image. You must imagine the scene in 3D space.
    2. CHARACTER CONSISTENCY: The main subject/character must remain identical in design, clothing, and features, but viewed from the new angle.
    3. BACKGROUND CONSISTENCY: The environment/background must also be re-rendered from the new perspective.
    4. LIGHTING & STYLE: Maintain the exact same artistic style, lighting conditions, and color palette as the original image.
    5. Output ONLY the generated image data.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: imageData,
              mimeType: mimeType,
            },
          },
          {
            text: systemPrompt,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error generating perspective:", error);
    throw error;
  }
};
