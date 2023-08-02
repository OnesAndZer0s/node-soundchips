"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const speaker_1 = __importDefault(require("speaker"));
// Create the Speaker instance
const speaker = new speaker_1.default({
    channels: 2,
    bitDepth: 16,
    sampleRate: 44100 // 44,100 Hz sample rate
});
// PCM data from stdin gets piped into the speaker
process.stdin.pipe(speaker);
