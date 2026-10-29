import { EngineException } from "./types";
import type { EngineDeps } from "./engine";
import {
  InMemoryConceptGraphRepository,
  Neo4jConceptGraphRepository,
} from "./graph/repository";
import { JsonTextbookCorpus, createSimilarityScorer } from "./textbook/textbook";
import { createLLMClient } from "./llm";

/**
 * Production wiring from env (see `.env.example`):
 * - CURRICULUM_GRAPH_DRIVER=memory (default) | neo4j
 * - LLM_PROVIDER=mock (default) | http
 * - EMBEDDINGS_API_URL set → embedding similarity, else TF cosine
 */
export function createEngineDeps(): EngineDeps {
  const driver = (process.env.CURRICULUM_GRAPH_DRIVER ?? "memory").toLowerCase();
  const graph =
    driver === "neo4j"
      ? new Neo4jConceptGraphRepository()
      : driver === "memory"
        ? new InMemoryConceptGraphRepository()
        : null;
  if (!graph) {
    throw new EngineException(
      "GRAPH_DRIVER_UNKNOWN",
      "",
      `Unknown CURRICULUM_GRAPH_DRIVER: ${driver}`,
    );
  }
  return {
    graph,
    corpus: new JsonTextbookCorpus(),
    llm: createLLMClient(),
    scoreSimilarity: createSimilarityScorer(),
  };
}
