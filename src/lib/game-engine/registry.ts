import { GameEngineError, type GameCategory, type GameDefinition, type PublicationStatus } from "./types";

/**
 * Game Registry (Step 01): the catalogue of available games.
 * Duplicate ids are rejected so two modules can never shadow a game.
 */
export class GameRegistry {
  private games = new Map<string, GameDefinition>();

  register(definition: GameDefinition): GameDefinition {
    if (!definition.id.trim()) throw new GameEngineError("INVALID_GAME", "Game id is required");
    if (this.games.has(definition.id)) {
      throw new GameEngineError("DUPLICATE_GAME", `Game already registered: ${definition.id}`);
    }
    this.games.set(definition.id, definition);
    return definition;
  }

  get(gameId: string): GameDefinition {
    const game = this.games.get(gameId);
    if (!game) throw new GameEngineError("GAME_NOT_FOUND", `Unknown game: ${gameId}`);
    return game;
  }

  has(gameId: string): boolean {
    return this.games.has(gameId);
  }

  list(filter: { category?: GameCategory; grade?: number; subjectId?: string; status?: PublicationStatus } = {}): GameDefinition[] {
    return [...this.games.values()].filter(
      (g) =>
        (filter.category === undefined || g.category === filter.category) &&
        (filter.grade === undefined || g.grades.includes(filter.grade)) &&
        (filter.subjectId === undefined || g.subjects.includes(filter.subjectId)) &&
        (filter.status === undefined || g.status === filter.status),
    );
  }

  /** Only published games may be offered to students. */
  listPublished(): GameDefinition[] {
    return this.list({ status: "published" });
  }
}
