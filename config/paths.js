/**
 * Railway Volume Paths Configuration
 * Centralized path management for persistent storage
 */

const path = require('path');

// Railway Volume base path (configurable via environment)
const VOLUME_PATH = process.env.VOLUME_PATH || '/app/data';

// Railway Volume directory paths
const LOGS_PATH = path.join(VOLUME_PATH, 'logs');
const EXPORTS_PATH = path.join(VOLUME_PATH, 'exports');
const TEMP_PATH = path.join(VOLUME_PATH, 'temp');
const CACHE_PATH = path.join(VOLUME_PATH, 'cache');

// Application-specific file paths
const APPLICATION_PATHS = {
    // Logging paths
    serverLog: path.join(LOGS_PATH, 'server.log'),
    errorLog: path.join(LOGS_PATH, 'error.log'),
    pipelineLog: path.join(LOGS_PATH, 'pipeline.log'),

    // Export paths
    csvExports: path.join(EXPORTS_PATH, 'csv'),
    jsonExports: path.join(EXPORTS_PATH, 'json'),
    reportExports: path.join(EXPORTS_PATH, 'reports'),

    // Temporary processing paths
    tempUploads: path.join(TEMP_PATH, 'uploads'),
    tempProcessing: path.join(TEMP_PATH, 'processing'),
    tempDownloads: path.join(TEMP_PATH, 'downloads'),

    // Cache paths
    queryCache: path.join(CACHE_PATH, 'queries'),
    resultCache: path.join(CACHE_PATH, 'results'),
    sessionCache: path.join(CACHE_PATH, 'sessions')
};

// Helper functions for path operations
const PATH_HELPERS = {
    /**
     * Get export file path with timestamp
     * @param {string} filename - Base filename
     * @param {string} format - File format (csv, json)
     * @returns {string} Full path with timestamp
     */
    getTimestampedExportPath(filename, format = 'csv') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = path.parse(filename).name;
        const exportDir = format === 'csv' ? APPLICATION_PATHS.csvExports : APPLICATION_PATHS.jsonExports;
        return path.join(exportDir, `${baseName}_${timestamp}.${format}`);
    },

    /**
     * Get temporary file path
     * @param {string} filename - Filename
     * @param {string} subdir - Subdirectory (uploads, processing, downloads)
     * @returns {string} Full temporary path
     */
    getTempPath(filename, subdir = 'processing') {
        const tempDir = APPLICATION_PATHS[`temp${subdir.charAt(0).toUpperCase() + subdir.slice(1)}`] || APPLICATION_PATHS.tempProcessing;
        return path.join(tempDir, filename);
    },

    /**
     * Get cache file path
     * @param {string} key - Cache key
     * @param {string} type - Cache type (queries, results, sessions)
     * @returns {string} Full cache path
     */
    getCachePath(key, type = 'results') {
        const cacheDir = APPLICATION_PATHS[`${type}Cache`] || APPLICATION_PATHS.resultCache;
        return path.join(cacheDir, `${key}.json`);
    },

    /**
     * Get log file path by type
     * @param {string} type - Log type (server, error, pipeline)
     * @returns {string} Full log path
     */
    getLogPath(type = 'server') {
        return APPLICATION_PATHS[`${type}Log`] || APPLICATION_PATHS.serverLog;
    }
};

module.exports = {
    // Base paths
    VOLUME_PATH,
    LOGS_PATH,
    EXPORTS_PATH,
    TEMP_PATH,
    CACHE_PATH,

    // Application-specific paths
    APPLICATION_PATHS,

    // Helper functions
    PATH_HELPERS,

    // Railway Volume validation
    isVolumeConfigured() {
        return process.env.VOLUME_PATH !== undefined;
    },

    // Get volume info
    getVolumeInfo() {
        return {
            volumePath: VOLUME_PATH,
            isConfigured: this.isVolumeConfigured(),
            directories: {
                logs: LOGS_PATH,
                exports: EXPORTS_PATH,
                temp: TEMP_PATH,
                cache: CACHE_PATH
            }
        };
    }
};