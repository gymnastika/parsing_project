/**
 * Database Utilities for GYMNASTIKA Platform
 * Helper functions for common database operations
 */

class DatabaseUtils {
    constructor() {
        this.db = null;
    }

    /**
     * Set database client reference
     */
    setClient(dbClient) {
        this.db = dbClient;
    }

    /**
     * Ensure database is ready
     */
    ensureReady() {
        if (!this.db || !this.db.isReady()) {
            throw new Error('Database not ready. Please initialize the connection first.');
        }
    }

    /**
     * Basic connection utilities - no table creation
     * Tables will be created separately later
     */

    /**
     * Database health check - basic connectivity only
     */
    async healthCheck() {
        this.ensureReady();
        
        const health = {
            status: 'healthy',
            checks: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Test basic connectivity
            const connectionTest = await this.db.testConnection();
            health.checks.connection = connectionTest;

        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }
}

// Global instance
window.dbUtils = new DatabaseUtils();

// Initialize connection to gymnastikaDB when available
if (window.gymnastikaDB) {
    window.dbUtils.setClient(window.gymnastikaDB);
}

console.log('🛠️ Database utilities ready');