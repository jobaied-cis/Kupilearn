import { createLLMClient } from "../curriculum/llm";
import type { ClassroomDeps } from "./turn";
import { createVoiceClient } from "./voice";

/**
 * Production wiring from env (see `.env.example`):
 * - LLM_PROVIDER=meta (default, Meta Llama via META_*) | mock (offline)
 * - TTS_PROVIDER=browser (default, browser-native speech) | mock (tests)
 */
export function createClassroomDeps(): ClassroomDeps {
  return {
    llm: createLLMClient(),
    voice: createVoiceClient(),
  };
}
