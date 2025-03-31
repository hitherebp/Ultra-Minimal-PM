/**
 * Environment Variables Loader
 * This script loads environment variables from a gitignored env.js file
 * This should be the FIRST script loaded in your HTML
 */
(function() {
    // Check if environment variables are already loaded
    if (window.ENV_LOADED) {
        console.log('Environment variables already loaded');
        return;
    }

    // Flag to prevent double loading
    window.ENV_LOADED = true;

    // Function to load the env.js file
    function loadEnvFile() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '../../env.js', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    // Successfully loaded the file, evaluate it
                    try {
                        eval(xhr.responseText);
                        console.log('Environment variables loaded successfully');
                    } catch (error) {
                        console.error('Error parsing environment file:', error);
                    }
                } else {
                    console.warn('Environment file not found. Using default development configuration.');
                    // You could set up placeholder values here if needed
                }
            }
        };
        xhr.send();
    }

    // Load the environment file
    loadEnvFile();
})();