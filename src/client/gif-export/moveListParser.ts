import { Game, PlayerIndex } from '../../shared/game-engine/index.js';
import { Move, isMoveValid } from '../../shared/move-notation/move-notation.js';

export class MoveListParseError extends Error {
    constructor(message: string, public moveIndex?: number) {
        super(message);
    }
}

export const parseMoveList = (input: string, boardSize: number): Game => {
    const tokens = input.trim().split(/\s+/).filter(t => t.length > 0);
    const game = new Game(boardSize);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (!isMoveValid(token)) {
            throw new MoveListParseError(`Invalid move "${token}" at position ${i + 1}`, i);
        }

        game.move(token as Move, i % 2 as PlayerIndex);
    }

    return game;
};

/**
 * Detect whether input looks like SGF format.
 */
export const isSGF = (input: string): boolean => {
    return input.trimStart().startsWith('(;');
};

/**
 * Parse an SGF string into a Game instance.
 * Extracts SZ (board size) and B[]/W[] move properties from the main line.
 */
export const parseSGF = (input: string): { game: Game; boardSize: number } => {
    // Extract board size from SZ property
    const szMatch = input.match(/SZ\[(\d+)/);
    if (!szMatch) {
        throw new MoveListParseError('SGF missing SZ (board size) property');
    }
    const boardSize = parseInt(szMatch[1], 10);

    // Extract moves: ;B[move] or ;W[move] from the main line.
    // B/W must appear right after ; (with optional whitespace) to avoid
    // matching properties like PB[name], BL[time], BR[rating], etc.
    const moveRegex = /;\s*([BW])\[([^\]]*)\]/g;
    const moves: { color: 'B' | 'W'; move: string }[] = [];

    let match;
    while ((match = moveRegex.exec(input)) !== null) {
        const color = match[1] as 'B' | 'W';
        const move = match[2];

        // Skip empty moves
        if (move === '') continue;

        moves.push({ color, move });
    }

    if (moves.length === 0) {
        throw new MoveListParseError('No moves found in SGF');
    }

    const game = new Game(boardSize);

    for (let i = 0; i < moves.length; i++) {
        const { move } = moves[i];

        if (!isMoveValid(move)) {
            throw new MoveListParseError(`Invalid move "${move}" in SGF at move ${i + 1}`, i);
        }

        game.move(move as Move, i % 2 as PlayerIndex);
    }

    return { game, boardSize };
};
