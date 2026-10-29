import { createLLMClient } from "../curriculum/llm";
import type { ClassroomDeps } from "./turn";
import { createVoiceClient } from "./voice";

/**
 * Production wiring from env (see `.env.example`):
 * - LLM_PROVIDER=mock (default) | http
 * - TTS_PROVIDER=mock (default) | http | google
 * VAD/STT run in the client or media gateway; the server consumes text.
 */
export function createClassroomDeps(): ClassroomDeps {
  return {
    llm: createLLMClient(),
    voice: createVoiceClient(),
  };
}
