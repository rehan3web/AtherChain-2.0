const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const duration = 0.5; // seconds
const frequency = 440; // A4
const numSamples = sampleRate * duration;

const buffer = Buffer.alloc(44 + numSamples * 2);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);

// fmt subchunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // Mono
buffer.writeUInt16LE(1, 22); // Mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);

// data subchunk
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    const value = Math.floor(sample * 32767);
    buffer.writeInt16LE(value, 44 + i * 2);
}

const outFile = path.join(__dirname, 'public', 'beep.wav');
fs.writeFileSync(outFile, buffer);
console.log('Beep written to', outFile, 'Size:', buffer.length);
