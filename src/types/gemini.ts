export type GeminiRole = "user" | "model";

export interface GeminiTextPart {
  readonly text: string;
}

export interface GeminiContent {
  readonly role: GeminiRole;
  readonly parts: readonly GeminiTextPart[];
}

export interface GeminiSystemInstruction {
  readonly parts: readonly GeminiTextPart[];
}

export interface GeminiGenerateContentRequest {
  readonly systemInstruction: GeminiSystemInstruction;
  readonly contents: readonly GeminiContent[];
}

/** Untrusted response members stay unknown until checked by the client parser. */
export interface GeminiGenerateContentResponse {
  readonly candidates?: unknown;
}
