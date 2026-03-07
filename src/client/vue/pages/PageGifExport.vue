<script setup lang="ts">
/* eslint-env browser */
import { ref, onUnmounted, computed, nextTick } from 'vue';
import GameView from '../../../shared/pixi-board/GameView.js';
import { Game } from '../../../shared/game-engine/index.js';
import { themes, Theme } from '../../../shared/pixi-board/BoardTheme.js';
import { parseMoveList, parseSGF, isSGF, MoveListParseError } from '../../gif-export/moveListParser.js';
import { recordGif } from '../../gif-export/GifRecorder.js';
import { downloadBlob } from '../../services/fileDownload.js';

// Input state
const moveListInput = ref('');
const boardSize = ref(11);
const parseError = ref<string | null>(null);
const game = ref<Game | null>(null);
const detectedSGF = ref(false);

// Config state
const themeName = ref<'dark' | 'light'>('dark');
const orientationMode = ref<'auto' | 'landscape' | 'portrait'>('landscape');
const orientationLandscape = ref(11); // diamond
const orientationPortrait = ref(9); // flat_2
const displayCoords = ref(false);
const frameDelay = ref(500);
const outputWidth = ref(600);
const outputHeight = ref(600);
const backgroundColor = ref('#343a40'); // dark theme background

const currentTheme = computed<Theme>(() => themes[themeName.value]);

// Preview state
const previewContainer = ref<HTMLElement>();
let previewGameView: GameView | null = null;

// Export state
const isGenerating = ref(false);
const progress = ref(0);
const progressTotal = ref(0);
const gifBlobUrl = ref<string | null>(null);
const gifBlob = ref<Blob | null>(null);

const landscapeOrientations = [
    { value: 0, label: 'Flat' },
    { value: 10, label: 'Flat 2' },
    { value: 11, label: 'Diamond' },
];

const portraitOrientations = [
    { value: 1, label: 'Flat' },
    { value: 9, label: 'Flat 2' },
    { value: 2, label: 'Diamond' },
];

const resolutionPresets = [
    { label: '400x400', width: 400, height: 400 },
    { label: '600x600', width: 600, height: 600 },
    { label: '800x800', width: 800, height: 800 },
];

const loadGame = async () => {
    parseError.value = null;
    cleanupPreview();
    cleanupGif();

    const input = moveListInput.value.trim();

    if (!input) {
        parseError.value = 'Please enter a move list or SGF.';
        return;
    }

    try {
        if (isSGF(input)) {
            detectedSGF.value = true;
            const result = parseSGF(input);
            game.value = result.game;
            boardSize.value = result.boardSize;
        } else {
            detectedSGF.value = false;
            game.value = parseMoveList(input, boardSize.value);
        }
    } catch (e) {
        if (e instanceof MoveListParseError) {
            parseError.value = e.message;
        } else {
            parseError.value = `Failed to parse: ${e instanceof Error ? e.message : String(e)}`;
        }
        return;
    }

    // Wait for Vue to render the v-if="game" sections before mounting
    await nextTick();
    mountPreview();
};

const mountPreview = async () => {
    if (!game.value || !previewContainer.value) return;

    previewGameView = new GameView(game.value, {
        theme: currentTheme.value,
        displayCoords: displayCoords.value,
        preferredOrientations: {
            landscape: orientationLandscape.value,
            portrait: orientationPortrait.value,
        },
        selectedBoardOrientationMode: orientationMode.value,
    });

    await previewGameView.mount(previewContainer.value);
};

const cleanupPreview = () => {
    if (previewGameView) {
        previewGameView.destroy();
        previewGameView = null;
    }
    if (previewContainer.value) {
        previewContainer.value.innerHTML = '';
    }
};

const cleanupGif = () => {
    if (gifBlobUrl.value) {
        URL.revokeObjectURL(gifBlobUrl.value);
        gifBlobUrl.value = null;
    }
    gifBlob.value = null;
};

// Preview rewind controls
const rewindStart = () => previewGameView?.setMovesHistoryCursor(-1);
const rewindBack = () => previewGameView?.changeMovesHistoryCursor(-1);
const rewindForward = () => previewGameView?.changeMovesHistoryCursor(+1);
const rewindEnd = () => previewGameView?.setMovesHistoryCursor(Infinity);

const generateGif = async () => {
    if (!game.value) return;

    isGenerating.value = true;
    progress.value = 0;
    progressTotal.value = 0;
    cleanupGif();

    try {
        const blob = await recordGif({
            game: game.value,
            theme: currentTheme.value,
            preferredOrientations: {
                landscape: orientationLandscape.value,
                portrait: orientationPortrait.value,
            },
            selectedBoardOrientationMode: orientationMode.value,
            outputWidth: outputWidth.value,
            outputHeight: outputHeight.value,
            frameDelay: frameDelay.value,
            displayCoords: displayCoords.value,
            backgroundColor: backgroundColor.value,
        }, (current, total) => {
            progress.value = current;
            progressTotal.value = total;
        });

        gifBlob.value = blob;
        gifBlobUrl.value = URL.createObjectURL(blob);
    } catch (e) {
        parseError.value = `GIF generation failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        isGenerating.value = false;
    }
};

const downloadGif = () => {
    if (!gifBlob.value) return;
    downloadBlob(gifBlob.value, 'hex-game.gif');
};

const setResolution = (width: number, height: number) => {
    outputWidth.value = width;
    outputHeight.value = height;
};

onUnmounted(() => {
    cleanupPreview();
    cleanupGif();
});
</script>

<template>
    <div class="container mt-4 mb-5">
        <h1 class="h3 mb-4">GIF Export</h1>

        <!-- Input Section -->
        <div class="card mb-3">
            <div class="card-body">
                <h2 class="h5 card-title">Game Input</h2>

                <div class="mb-3">
                    <label for="moveList" class="form-label">Move list or SGF</label>
                    <textarea
                        id="moveList"
                        v-model="moveListInput"
                        class="form-control font-monospace"
                        rows="4"
                        placeholder="Paste a move list (e.g. a1 b2 swap-pieces c3 d4...) or a full SGF string"
                    ></textarea>
                    <div class="form-text">SGF format is auto-detected. For move lists, set the board size below.</div>
                </div>

                <div class="row mb-3">
                    <div class="col-auto">
                        <label for="boardSize" class="form-label">Board size (for move lists)</label>
                        <select id="boardSize" v-model.number="boardSize" class="form-select" style="width: auto;">
                            <option v-for="s in 52" :key="s + 1" :value="s + 1">{{ s + 1 }}</option>
                        </select>
                    </div>
                </div>

                <button class="btn btn-primary" @click="loadGame">Load Game</button>

                <div v-if="parseError" class="alert alert-danger mt-3 mb-0">{{ parseError }}</div>
                <div v-if="game && detectedSGF" class="alert alert-info mt-3 mb-0">
                    SGF detected. Board size: {{ boardSize }}. Moves: {{ game.getMovesHistory().length }}.
                </div>
                <div v-if="game && !detectedSGF" class="alert alert-info mt-3 mb-0">
                    Loaded {{ game.getMovesHistory().length }} moves on a {{ boardSize }}x{{ boardSize }} board.
                </div>
            </div>
        </div>

        <!-- Configuration Section -->
        <div class="card mb-3" v-if="game">
            <div class="card-body">
                <h2 class="h5 card-title">Configuration</h2>

                <div class="row g-3">
                    <!-- Theme -->
                    <div class="col-md-4">
                        <label class="form-label">Theme</label>
                        <select v-model="themeName" class="form-select">
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>

                    <!-- Orientation mode -->
                    <div class="col-md-4">
                        <label class="form-label">Orientation mode</label>
                        <select v-model="orientationMode" class="form-select">
                            <option value="auto">Auto</option>
                            <option value="landscape">Landscape</option>
                            <option value="portrait">Portrait</option>
                        </select>
                    </div>

                    <!-- Orientation value -->
                    <div class="col-md-4">
                        <label class="form-label">Board orientation</label>
                        <select v-model.number="orientationLandscape" class="form-select" v-if="orientationMode !== 'portrait'">
                            <option v-for="o in landscapeOrientations" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                        <select v-model.number="orientationPortrait" class="form-select" v-if="orientationMode === 'portrait'">
                            <option v-for="o in portraitOrientations" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                    </div>

                    <!-- Show coords -->
                    <div class="col-md-4">
                        <div class="form-check mt-4">
                            <input id="showCoords" type="checkbox" v-model="displayCoords" class="form-check-input">
                            <label for="showCoords" class="form-check-label">Show coordinates</label>
                        </div>
                    </div>

                    <!-- Frame delay -->
                    <div class="col-md-4">
                        <label class="form-label">Frame delay: {{ frameDelay }}ms</label>
                        <input type="range" v-model.number="frameDelay" min="200" max="2000" step="100" class="form-range">
                    </div>

                    <!-- Background color -->
                    <div class="col-md-4">
                        <label class="form-label">Background color</label>
                        <input type="color" v-model="backgroundColor" class="form-control form-control-color">
                    </div>

                    <!-- Resolution -->
                    <div class="col-12">
                        <label class="form-label">Output resolution</label>
                        <div class="d-flex gap-2 align-items-center flex-wrap">
                            <button
                                v-for="preset in resolutionPresets"
                                :key="preset.label"
                                class="btn btn-sm"
                                :class="outputWidth === preset.width && outputHeight === preset.height ? 'btn-primary' : 'btn-outline-primary'"
                                @click="setResolution(preset.width, preset.height)"
                            >{{ preset.label }}</button>
                            <span class="text-muted">or</span>
                            <input type="number" v-model.number="outputWidth" class="form-control form-control-sm" style="width: 80px;" min="100" max="1600">
                            <span>x</span>
                            <input type="number" v-model.number="outputHeight" class="form-control form-control-sm" style="width: 80px;" min="100" max="1600">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Preview & Export Section -->
        <div class="card mb-3" v-if="game">
            <div class="card-body">
                <h2 class="h5 card-title">Preview</h2>

                <div class="preview-container" ref="previewContainer"></div>

                <div class="d-flex justify-content-center gap-2 mt-2 mb-3">
                    <button class="btn btn-sm btn-outline-primary" @click="rewindStart">|&lt;</button>
                    <button class="btn btn-sm btn-outline-primary" @click="rewindBack">&lt;</button>
                    <button class="btn btn-sm btn-outline-primary" @click="rewindForward">&gt;</button>
                    <button class="btn btn-sm btn-outline-primary" @click="rewindEnd">&gt;|</button>
                </div>

                <div class="d-flex gap-2 align-items-center">
                    <button
                        class="btn btn-success"
                        @click="generateGif"
                        :disabled="isGenerating"
                    >
                        {{ isGenerating ? 'Generating...' : 'Generate GIF' }}
                    </button>

                    <div v-if="isGenerating && progressTotal > 0" class="flex-grow-1">
                        <div class="progress">
                            <div
                                class="progress-bar"
                                role="progressbar"
                                :style="{ width: (progress / progressTotal * 100) + '%' }"
                            >{{ progress }}/{{ progressTotal }}</div>
                        </div>
                    </div>
                </div>

                <!-- GIF Result -->
                <div v-if="gifBlobUrl" class="mt-3">
                    <h3 class="h6">Result</h3>
                    <img :src="gifBlobUrl" class="gif-result border" alt="Generated GIF">
                    <div class="mt-2">
                        <button class="btn btn-primary" @click="downloadGif">Download GIF</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.preview-container
    width 100%
    height 400px
    border 1px solid var(--bs-border-color)
    border-radius 0.375rem
    overflow hidden

.gif-result
    max-width 100%
    height auto
</style>
