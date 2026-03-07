import { Game } from '../../shared/game-engine/index.js';
import GameView from '../../shared/pixi-board/GameView.js';
import { Theme } from '../../shared/pixi-board/BoardTheme.js';
import { OrientationMode } from '../../shared/pixi-board/GameView.js';
import { encode, UnencodedFrame } from 'modern-gif';

export type GifRecorderOptions = {
    game: Game;
    theme: Theme;
    preferredOrientations: { landscape: number; portrait: number };
    selectedBoardOrientationMode: 'auto' | OrientationMode;
    outputWidth: number;
    outputHeight: number;
    frameDelay: number;
    displayCoords: boolean;
    backgroundColor: string;
};

const waitFrames = (count: number): Promise<void> => {
    return new Promise(resolve => {
        let remaining = count;
        const tick = () => {
            remaining--;
            if (remaining <= 0) resolve();
            else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
};

export const recordGif = async (
    options: GifRecorderOptions,
    onProgress?: (current: number, total: number) => void,
): Promise<Blob> => {
    const {
        game,
        theme,
        preferredOrientations,
        selectedBoardOrientationMode,
        outputWidth,
        outputHeight,
        frameDelay,
        displayCoords,
        backgroundColor,
    } = options;

    // Create off-screen container
    const offscreenDiv = document.createElement('div');
    offscreenDiv.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${outputWidth}px;height:${outputHeight}px;`;
    document.body.appendChild(offscreenDiv);

    const gameView = new GameView(game, {
        theme,
        preferredOrientations,
        selectedBoardOrientationMode,
        displayCoords,
    });

    try {
        await gameView.mount(offscreenDiv);
        await gameView.ready();

        // Compositing canvas for solid background
        const compCanvas = document.createElement('canvas');
        compCanvas.width = outputWidth;
        compCanvas.height = outputHeight;
        const compCtx = compCanvas.getContext('2d')!;

        const movesCount = game.getMovesHistory().length;
        const totalFrames = movesCount + 1; // empty board + each move
        const frames: { data: Uint8ClampedArray; delay: number }[] = [];

        const captureFrame = (delay: number) => {
            const pixiCanvas = gameView.getView();

            // Fill background
            compCtx.fillStyle = backgroundColor;
            compCtx.fillRect(0, 0, outputWidth, outputHeight);

            // Draw pixi canvas onto compositing canvas
            compCtx.drawImage(pixiCanvas, 0, 0, outputWidth, outputHeight);

            const imageData = compCtx.getImageData(0, 0, outputWidth, outputHeight);
            frames.push({ data: imageData.data, delay });
        };

        // Frame 0: empty board
        gameView.setMovesHistoryCursor(-1);
        await waitFrames(2);
        captureFrame(frameDelay);
        onProgress?.(1, totalFrames);

        // One frame per move
        for (let i = 0; i < movesCount; i++) {
            gameView.setMovesHistoryCursor(i);
            await waitFrames(2);

            const isLastFrame = i === movesCount - 1;
            captureFrame(isLastFrame ? frameDelay * 3 : frameDelay);
            onProgress?.(i + 2, totalFrames);
        }

        // Encode GIF
        const output = await encode({
            width: outputWidth,
            height: outputHeight,
            frames: frames.map(f => ({
                data: f.data as unknown as BufferSource,
                delay: f.delay,
            } as UnencodedFrame)),
        });

        return new Blob([output], { type: 'image/gif' });
    } finally {
        gameView.destroy();
        offscreenDiv.remove();
    }
};
