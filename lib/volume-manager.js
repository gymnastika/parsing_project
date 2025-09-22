/**
 * Volume Manager for Railway Persistent Storage
 * Manages Railway Volume directories and ensures proper folder structure
 */

const fs = require('fs');
const path = require('path');

/**
 * Railway Volume paths configuration
 */
const VOLUME_CONFIG = {
    VOLUME_PATH: process.env.VOLUME_PATH || '/app/data',
    directories: [
        'logs',      // Application logs
        'exports',   // CSV/JSON exports from parsing
        'temp',      // Temporary files during processing
        'cache'      // Cached results and session data
    ]
};

/**
 * Ensure all required directories exist on Railway Volume
 * Creates directory structure if it doesn't exist
 */
function ensureDirectories() {
    console.log('🔧 Railway Volume Manager: Initializing storage directories...');

    try {
        const { VOLUME_PATH, directories } = VOLUME_CONFIG;

        // Ensure main volume directory exists
        if (!fs.existsSync(VOLUME_PATH)) {
            fs.mkdirSync(VOLUME_PATH, { recursive: true });
            console.log(`✅ Created main volume directory: ${VOLUME_PATH}`);
        }

        // Create each required subdirectory
        directories.forEach(dir => {
            const fullPath = path.join(VOLUME_PATH, dir);

            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`✅ Created directory: ${fullPath}`);
            } else {
                console.log(`✓ Directory exists: ${fullPath}`);
            }
        });

        // Verify directory permissions (Railway should handle this, but good to check)
        directories.forEach(dir => {
            const fullPath = path.join(VOLUME_PATH, dir);
            try {
                fs.accessSync(fullPath, fs.constants.W_OK);
                console.log(`✓ Write permissions confirmed: ${fullPath}`);
            } catch (error) {
                console.warn(`⚠️ Write permission issue: ${fullPath} - ${error.message}`);
            }
        });

        console.log('✅ Railway Volume ready for persistent storage');
        return true;

    } catch (error) {
        console.error('❌ Railway Volume initialization failed:', error);
        throw new Error(`Volume setup failed: ${error.message}`);
    }
}

/**
 * Get volume directory path by type
 * @param {string} type - Directory type: 'logs', 'exports', 'temp', 'cache'
 * @returns {string} Full path to the directory
 */
function getVolumeDirectory(type) {
    const { VOLUME_PATH, directories } = VOLUME_CONFIG;

    if (!directories.includes(type)) {
        throw new Error(`Invalid volume directory type: ${type}. Valid types: ${directories.join(', ')}`);
    }

    return path.join(VOLUME_PATH, type);
}

/**
 * Clean temporary files older than specified time
 * @param {number} maxAgeHours - Maximum age in hours (default: 24)
 */
function cleanupTempFiles(maxAgeHours = 24) {
    try {
        const tempDir = getVolumeDirectory('temp');
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
        const now = Date.now();

        const files = fs.readdirSync(tempDir);
        let cleaned = 0;

        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);

            if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                cleaned++;
                console.log(`🧹 Cleaned temp file: ${file}`);
            }
        });

        console.log(`✅ Temp cleanup completed: ${cleaned} files removed`);
        return cleaned;

    } catch (error) {
        console.error('❌ Temp cleanup failed:', error);
        return 0;
    }
}

/**
 * Get volume usage statistics
 * @returns {Object} Usage statistics for each directory
 */
function getVolumeStats() {
    try {
        const { VOLUME_PATH, directories } = VOLUME_CONFIG;
        const stats = {
            volumePath: VOLUME_PATH,
            directories: {}
        };

        directories.forEach(dir => {
            const dirPath = path.join(VOLUME_PATH, dir);

            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                let totalSize = 0;

                files.forEach(file => {
                    const filePath = path.join(dirPath, file);
                    const fileStats = fs.statSync(filePath);
                    totalSize += fileStats.size;
                });

                stats.directories[dir] = {
                    exists: true,
                    fileCount: files.length,
                    totalSize: totalSize,
                    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
                };
            } else {
                stats.directories[dir] = {
                    exists: false,
                    fileCount: 0,
                    totalSize: 0,
                    totalSizeMB: 0
                };
            }
        });

        return stats;

    } catch (error) {
        console.error('❌ Volume stats failed:', error);
        return null;
    }
}

module.exports = {
    ensureDirectories,
    getVolumeDirectory,
    cleanupTempFiles,
    getVolumeStats,
    VOLUME_CONFIG
};