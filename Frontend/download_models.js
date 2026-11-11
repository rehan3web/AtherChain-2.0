const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, 'public', 'models');
const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// Correct filenames based on manifest content
const files = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_landmark_68_tiny_model-weights_manifest.json',
    'face_landmark_68_tiny_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2'
];

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const downloadFile = (file) => {
    const filePath = path.join(modelsDir, file);
    const fileUrl = `${baseUrl}/${file}`;

    console.log(`Downloading ${file}...`);
    const fileStream = fs.createWriteStream(filePath);

    https.get(fileUrl, (response) => {
        if (response.statusCode === 200) {
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✓ ${file} Downloaded`);
            });
        } else {
            console.error(`Failed to download ${file}: Status ${response.statusCode}`);
            fileStream.close();
            fs.unlink(filePath, () => { }); // Delete empty file
        }
    }).on('error', (err) => {
        fs.unlink(filePath, () => { });
        console.error(`Error downloading ${file}:`, err.message);
    });
};

files.forEach(downloadFile);
