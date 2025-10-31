import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import type { Scene } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateImage = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        console.error("Invalid response from API for image generation:", response);
        throw new Error("No image generated or invalid API response.");
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

export const editImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
            console.error("Invalid response from API for image editing:", response);
            throw new Error("Failed to edit image: Invalid API response structure.");
        }
        
        for (const part of parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const imageMimeType = part.inlineData.mimeType;
                return `data:${imageMimeType};base64,${base64ImageBytes}`;
            }
        }
        throw new Error("No edited image returned");
    } catch (error) {
        console.error("Error editing image:", error);
        throw error;
    }
};

export const analyzeScript = async (script: string): Promise<Scene[]> => {
    // FIX: Declare response outside the try block to access it in the catch block for error logging.
    let response: GenerateContentResponse;
    try {
        const prompt = `Analyze the following Hindi script. Divide it into logical scenes. For each scene, provide the scene number, the exact text for that scene, and a concise, descriptive English prompt for an image generation model to create a relevant visual. Respond in JSON format. Script: "${script}"`;
        response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            scene: { type: Type.INTEGER },
                            text: { type: Type.STRING },
                            image_prompt: { type: Type.STRING }
                        },
                        required: ["scene", "text", "image_prompt"]
                    }
                }
            }
        });
        
        let jsonString = response.text.trim();
        // The model can sometimes wrap the JSON in ```json ... ```, so we strip that.
        const match = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (match && match[1]) {
            jsonString = match[1];
        }

        const scenes = JSON.parse(jsonString);
        return scenes;

    } catch (error) {
        console.error("Error analyzing script:", error);
        if (error instanceof SyntaxError) {
             console.error("Failed to parse JSON response from AI:", response.text);
        }
        throw error;
    }
};

export const generateSceneImage = async (prompt: string): Promise<string> => {
     try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
            console.error("Invalid response from API for scene image generation:", response);
            throw new Error("Failed to generate scene image: Invalid API response structure.");
        }

        for (const part of parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            }
        }
        throw new Error("No scene image generated");
    } catch (error) {
        console.error("Error generating scene image:", error);
        throw error;
    }
};

export const checkImageQuality = async (base64ImageData: string, mimeType: string, prompt: string): Promise<{ pass: boolean; feedback: string }> => {
    let response: GenerateContentResponse;
    try {
        const qualityPrompt = `You are an AI image quality assurance expert. Analyze the provided image based on the original prompt: "${prompt}". 
        Is the image a high-quality, non-distorted, and accurate representation of the prompt? 
        Respond ONLY with a JSON object with keys 'pass' (boolean) and 'feedback' (string, a brief explanation for your decision, max 20 words).`;
        
        response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    { text: qualityPrompt },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        pass: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING }
                    },
                    required: ["pass", "feedback"]
                }
            }
        });

        let jsonString = response.text.trim();
        const match = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (match && match[1]) {
            jsonString = match[1];
        }

        const result = JSON.parse(jsonString);
        return result;

    } catch (error) {
        console.error("Error checking image quality:", error);
         if (error instanceof SyntaxError && response) {
             console.error("Failed to parse JSON response from AI for quality check:", response.text);
        }
        // Return a default failure state if the check itself fails
        return { pass: false, feedback: "Quality check failed to execute." };
    }
};

export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return base64Audio;
        }
        throw new Error("No audio data returned");
    } catch (error) {
        console.error("Error generating speech:", error);
        throw error;
    }
};