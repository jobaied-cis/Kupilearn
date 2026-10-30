import { createLLMClient } from "../curriculum/llm";
import type { ClassroomDeps } from "./turn";
import { createVoiceClient } from "./voice";

/**
 * Production wiring from env (see `.env.example`):
 * - LLM_PROVIDER=meta (default, Meta AI via META_*) | mock (offline tests)
 * - TTS_PROVIDER=browser (default, browser-native speech) | mock (tests)
 */
export function createClassroomDeps(): ClassroomDeps {
  return {
    llm: createLLMClient(),
    voice: createVoiceClient(),
  };
}
