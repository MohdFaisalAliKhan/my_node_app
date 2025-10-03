const fileInput = document.getElementById('apkFile');
const uploadSection = document.getElementById('uploadSection');
const fileInfo = document.getElementById('fileInfo');
const fileNameSpan = document.getElementById('fileName');
const fileSizeSpan = document.getElementById('fileSize');
const uploadButton = document.getElementById('uploadButton');
const progressBarContainer = document.getElementById('progressBarContainer');
const progressBar = document.getElementById('progressBar');
const loader = document.querySelector('.loader'); // Get the loader element

// Event listener for clicking the upload section to trigger file input
uploadSection.addEventListener('click', () => {
    fileInput.click();
});

// Event listener for when a file is selected
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
        fileNameSpan.textContent = file.name;
        fileSizeSpan.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB'; // Convert to MB
        fileInfo.style.display = 'block';
        uploadButton.style.display = 'block';
        progressBarContainer.style.display = 'none'; // Hide progress bar initially
        progressBar.style.width = '0%'; // Reset progress bar
        progressBar.textContent = '0%';
    } else {
        fileNameSpan.textContent = '';
        fileSizeSpan.textContent = '';
        fileInfo.style.display = 'none';
        uploadButton.style.display = 'none';
        progressBarContainer.style.display = 'none';
    }
});

// Add drag and drop functionality
uploadSection.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadSection.style.borderColor = '#007bff';
});

uploadSection.addEventListener('dragleave', (event) => {
    event.preventDefault();
    uploadSection.style.borderColor = '#ccc';
});

uploadSection.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadSection.style.borderColor = '#ccc';
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    }
});

// Event listener for the upload button click
uploadButton.addEventListener('click', function() {
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file first.');
        return;
    }

    const formData = new FormData();
    formData.append('apkFile', file); // 'apkFile' should match the name expected by your backend

    const xhr = new XMLHttpRequest();

    xhr.open('POST', '/upload', true); // Replace '/upload' with your backend upload endpoint

    xhr.upload.addEventListener('progress', function(event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = percentComplete + '%';
            progressBar.textContent = Math.round(percentComplete) + '%';
             progressBarContainer.style.display = 'block'; // Show progress bar during upload
        }
    });

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                console.log('Upload successful!');
                uploadButton.style.display = 'none';
                progressBarContainer.style.display = 'none';

                // Display post-upload options
                const uploadAgainButton = document.createElement('button');
                uploadAgainButton.textContent = 'Upload Again';
                uploadAgainButton.setAttribute('id', 'uploadAgainButton'); // Add ID for styling
                uploadAgainButton.addEventListener('click', function() {
                    window.location.reload(); // Reload the page
                });



                // Append buttons to the body or a specific container
                 // You might want to append these to a specific container in your HTML
                 // instead of the body for better layout control.
                 const buttonContainer = document.createElement('div'); // Create a container for the buttons
                 buttonContainer.appendChild(uploadAgainButton);

                 document.body.appendChild(buttonContainer);


            } else {
                console.error('Upload failed. Status:', xhr.status);
                // Handle upload errors
                alert('Upload failed. Please try again.');
                uploadButton.style.display = 'block'; // Show upload button again
                progressBarContainer.style.display = 'none'; // Hide progress bar
                progressBar.style.width = '0%'; // Reset progress bar
                progressBar.textContent = '0%';
            }
        }
    };

    xhr.send(formData);
});

