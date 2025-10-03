const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = 3000;

app.use(express.json({ limit: '3072mb' }));
app.use(express.urlencoded({ limit: '3072mb', extended: true }));
// 3-hour timeout for requests and responses
app.use((req, res, next) => {
    req.setTimeout(3 * 60 * 60 * 1000);  // 3 hours
    res.setTimeout(3 * 60 * 60 * 1000);  // 3 hours
    next();
});

function getUploadDirFromHost(hostname) {
    if (hostname.startsWith('zero_qa')) {
        return '/var/www/zip/sbdt-uploaded-files/zeroqa';
    } else if (hostname.startsWith('hero_qa')) {
        return '/var/www/zip/sbdt-uploaded-files/heroqa';
    } else if (hostname.startsWith('remlqa')) {
        return '/var/www/zip/sbdt-uploaded-files/remlqa';
    } else if (hostname.startsWith('localhost')) {
        return '/Users/vaibhavgautam/Library/CloudStorage/OneDrive-UnoMindaLimited/projects_under_dev/jenkins_builder/demorepo/uploaded_files';
    } else {
        return null;
    }
}


// Define the upload directory
const buildUploadDir = path.join(__dirname, 'output_files');
// Ensure the upload directory exists
if (!fs.existsSync(buildUploadDir)) {
    fs.mkdirSync(buildUploadDir, { recursive: true });
}

// Set up multer storage for the new endpoint
const buildStorage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, buildUploadDir),
    filename: (req, file, cb) => {
        // Use the filename provided in the request body
        const newFilename = req.body.filename;
        if (!newFilename) {
            // Handle error if filename is not provided
            return cb(new Error('filename parameter is required'), null);
        }
        cb(null, newFilename);
    }
});

const uploadBuild = multer({ storage: buildStorage }).single('buildfile');

// API endpoint for uploading and renaming the build file
app.post('/upload_build', (req, res) => {
    uploadBuild(req, res, function (err) {
        if (err) {
            console.error('Multer error:', err);
            // Handle specific error for missing filename
            if (err.message === 'filename parameter is required') {
                return res.status(400).send(err.message);
            }
            return res.status(500).send('Upload error');
        }

        if (req.file) {
            console.log(`File uploaded successfully to ${buildUploadDir} as ${req.file.filename}`);
            res.status(200).send(`File uploaded successfully as ${req.file.filename}`);
        } else {
            res.status(400).send('No file uploaded. Please provide a file named "buildfile".');
        }
    });
});


// Upload endpoint
app.post('/upload', (req, res) => {
    const hostname = req.headers.host;
    const uploadDir = getUploadDirFromHost(hostname);

    if (!uploadDir) return res.status(400).send('Invalid subdomain.');

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (_, __, cb) => cb(null, uploadDir),
        filename: (_, file, cb) => cb(null, 'UnoMindaCluster.apk')
    });

    const upload = multer({ storage }).single('apkFile');

    upload(req, res, function (err) {
        if (err) {
            console.error('Multer error:', err);
            return res.status(500).send('Upload error');
        }

        if (req.file) {
            console.log(`File uploaded to ${uploadDir}`);
            res.status(200).send('File uploaded successfully');
        } else {
            res.status(400).send('No file uploaded');
        }
    });
});

// Build endpoint (still uses hardcoded uploaded_files for now)
app.post('/build', async (req, res) => {
    console.log('Build request received');
    const uploadDir = 'uploaded_files';
    const jenkinsUrl = 'http://10.40.20.73:8080/view/SBDT/job/UMC_SigningAPK/build';
    const username = 'jenkins_master';
    const apiToken = '112bc786668d23c420013ade864d26b083';
    const filePath = path.join(__dirname, uploadDir, 'UnoMindaCluster.apk');

    if (!fs.existsSync(filePath)) {
        console.error('APK file not found at:', filePath);
        return res.status(404).send('APK file not found. Please upload a file first.');
    }

    const form = new FormData();
    form.append('apk', fs.createReadStream(filePath));

    try {
        const response = await axios.post(jenkinsUrl, form, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${username}:${apiToken}`).toString('base64'),
                ...form.getHeaders()
            },
            body: form
        });

        if (response.ok) {
            console.log('Build request sent to Jenkins successfully.');
            res.status(200).json({ message: 'Build request sent to Jenkins successfully!' });
        } else {
            console.error('Failed to trigger Jenkins build:', response.status, response.statusText);
            const errorMessage = response.data?.message || response.statusText;
            res.status(response.status).json({ message: 'Failed to trigger Jenkins build:', error: errorMessage });
        }
    } catch (error) {
        console.error('Error triggering Jenkins build:', error);
        res.status(500).send('Error triggering Jenkins build.');
    }
});

// GET /count-files — subdomain determines folder
app.get('/count-files', (req, res) => {
    const uploadDir = getUploadDirFromHost(req.headers.host);
    if (!uploadDir) return res.status(400).send('Invalid subdomain.');

    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).json({ error: 'Error reading directory' });
        }

        const visibleFiles = files.filter(file => !file.startsWith('.'));
        res.status(200).json({ fileCount: visibleFiles.length });
    });
});

// DELETE /empty-uploads — subdomain determines folder
app.delete('/empty-uploads', (req, res) => {
    const uploadDir = getUploadDirFromHost(req.headers.host);
    if (!uploadDir) return res.status(400).send('Invalid subdomain.');

    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).json({ error: 'Error reading directory' });
        }

        if (files.length === 0) return res.status(200).send('Directory already empty.');

        const deletePromises = files.map(file => {
            const filePath = path.join(uploadDir, file);
            return new Promise(resolve => {
                fs.unlink(filePath, unlinkErr => {
                    if (unlinkErr) {
                        console.error('Error deleting:', filePath, unlinkErr);
                    } else {
                        console.log('Deleted:', filePath);
                    }
                    resolve();
                });
            });
        });

        Promise.all(deletePromises)
            .then(() => res.status(200).send('Directory emptied.'))
            .catch(deleteErr => {
                console.error('Error during deletion:', deleteErr);
                res.status(500).json({ error: 'Failed to empty directory', details: deleteErr.message });
            });
    });
});

app.use(express.static(__dirname));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

