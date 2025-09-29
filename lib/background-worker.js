/**
 * GYMNASTIKA Background Worker
 * Continuously processes pending parsing tasks for "fire-and-forget" execution
 */

const ServerPipelineOrchestrator = require('./server-pipeline-orchestrator');
const ParsingTasksService = require('./parsing-tasks-service');

class BackgroundWorker {
    constructor(options = {}) {
        this.tasksService = new ParsingTasksService();
        this.orchestrator = new ServerPipelineOrchestrator();
        
        // Configuration
        this.pollInterval = options.pollInterval || 5000; // Check every 5 seconds
        this.maxConcurrentTasks = options.maxConcurrentTasks || 2; // Process max 2 tasks simultaneously
        this.maxRetries = options.maxRetries || 3;
        
        // State
        this.isRunning = false;
        this.runningTasks = new Map(); // taskId -> Promise
        this.pollTimer = null;
        
        console.log('🔄 Background Worker initialized with settings:', {
            pollInterval: this.pollInterval,
            maxConcurrentTasks: this.maxConcurrentTasks,
            maxRetries: this.maxRetries
        });
    }

    /**
     * Start the background worker
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Background worker is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting background worker...');

        // Start polling for tasks
        this.scheduleNextPoll();
        
        console.log('✅ Background worker started successfully');
    }

    /**
     * Stop the background worker
     */
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️ Background worker is not running');
            return;
        }

        this.isRunning = false;
        console.log('🛑 Stopping background worker...');

        // Clear polling timer
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }

        // Wait for running tasks to complete
        if (this.runningTasks.size > 0) {
            console.log(`⏳ Waiting for ${this.runningTasks.size} running tasks to complete...`);
            
            const runningPromises = Array.from(this.runningTasks.values());
            await Promise.allSettled(runningPromises);
            
            console.log('✅ All running tasks completed');
        }

        this.runningTasks.clear();
        console.log('🛑 Background worker stopped');
    }

    /**
     * Schedule next polling cycle
     */
    scheduleNextPoll() {
        if (!this.isRunning) return;

        this.pollTimer = setTimeout(async () => {
            try {
                await this.pollForTasks();
            } catch (error) {
                console.error('❌ Error during task polling:', error);
            } finally {
                this.scheduleNextPoll(); // Schedule next poll regardless of errors
            }
        }, this.pollInterval);
    }

    /**
     * Poll database for pending tasks
     */
    async pollForTasks() {
        try {
            // Check if tasks service is available
            if (!this.tasksService.enabled) {
                // Tasks service disabled - skip polling
                return;
            }

            // Check if we have capacity for more tasks
            const availableSlots = this.maxConcurrentTasks - this.runningTasks.size;
            if (availableSlots <= 0) {
                // console.log(`📊 Worker at capacity: ${this.runningTasks.size}/${this.maxConcurrentTasks} tasks running`);
                return;
            }

            // Get pending tasks from database
            const pendingTasks = await this.tasksService.getPendingTasks(availableSlots);
            
            if (pendingTasks.length === 0) {
                // No tasks to process - this is normal, don't log
                return;
            }

            console.log(`📋 Found ${pendingTasks.length} pending tasks, processing...`);

            // Start processing each task
            for (const task of pendingTasks) {
                if (this.runningTasks.size >= this.maxConcurrentTasks) {
                    break; // Reached capacity
                }

                await this.startTaskProcessing(task);
            }

        } catch (error) {
            console.error('❌ Error polling for tasks:', error);
        }
    }

    /**
     * Start processing a single task
     */
    async startTaskProcessing(task) {
        const taskId = task.id;
        
        try {
            console.log(`🎯 Starting task: ${task.task_name} (${taskId})`);
            
            // Create processing promise
            const taskPromise = this.processTask(task)
                .finally(() => {
                    // Remove from running tasks when complete
                    this.runningTasks.delete(taskId);
                    console.log(`📊 Task completed: ${taskId}, running: ${this.runningTasks.size}/${this.maxConcurrentTasks}`);
                });

            // Add to running tasks
            this.runningTasks.set(taskId, taskPromise);

            console.log(`📊 Task started: ${taskId}, running: ${this.runningTasks.size}/${this.maxConcurrentTasks}`);

        } catch (error) {
            console.error(`❌ Error starting task ${taskId}:`, error);
            this.runningTasks.delete(taskId);
        }
    }

    /**
     * Process a single parsing task
     */
    async processTask(task) {
        const taskId = task.id;
        const startTime = Date.now();

        try {
            console.log(`🚀 Processing task ${taskId}: "${task.task_name}"`);
            console.log(`📝 Task details:`, {
                taskName: task.task_name,
                searchQuery: task.search_query,
                websiteUrl: task.website_url,
                type: task.task_type,
                createdAt: task.created_at
            });

            // Execute the pipeline for this task
            const result = await this.orchestrator.executeSearch(taskId);

            const duration = Math.round((Date.now() - startTime) / 1000);
            console.log(`✅ Task ${taskId} completed successfully in ${duration}s`);
            console.log(`📊 Results: ${result.finalCount} organizations found`);

            return result;

        } catch (error) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`❌ Task ${taskId} failed after ${duration}s:`, error.message);
            
            // Handle task retry logic
            await this.handleTaskFailure(task, error);
            
            throw error;
        }
    }

    /**
     * Handle task failure and retry logic
     */
    async handleTaskFailure(task, error) {
        const taskId = task.id;
        const currentRetryCount = task.retry_count || 0;

        try {
            if (currentRetryCount < this.maxRetries) {
                // Increment retry count and reset to pending for retry
                const nextRetry = currentRetryCount + 1;
                console.log(`🔄 Scheduling retry ${nextRetry}/${this.maxRetries} for task ${taskId}`);
                
                await this.tasksService.updateTask(taskId, {
                    status: 'pending',
                    retry_count: nextRetry,
                    error_message: `Attempt ${nextRetry}: ${error.message}`,
                    current_stage: 'retry'
                });
                
            } else {
                // Max retries reached - mark as permanently failed
                console.log(`💀 Task ${taskId} permanently failed after ${this.maxRetries} retries`);
                
                await this.tasksService.markAsFailed(taskId, 
                    `Failed after ${this.maxRetries} retries. Last error: ${error.message}`);
            }

        } catch (dbError) {
            console.error(`❌ Error updating failed task ${taskId}:`, dbError);
        }
    }

    /**
     * Get worker status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            runningTasks: this.runningTasks.size,
            maxConcurrentTasks: this.maxConcurrentTasks,
            pollInterval: this.pollInterval,
            runningTaskIds: Array.from(this.runningTasks.keys()),
            orchestratorStatus: this.orchestrator.getStatus()
        };
    }

    /**
     * Get running tasks details
     */
    async getRunningTasksDetails() {
        if (this.runningTasks.size === 0) {
            return [];
        }

        try {
            const runningTaskIds = Array.from(this.runningTasks.keys());
            const tasks = [];

            for (const taskId of runningTaskIds) {
                const task = await this.tasksService.getTask(taskId);
                if (task) {
                    tasks.push(task);
                }
            }

            return tasks;

        } catch (error) {
            console.error('❌ Error getting running task details:', error);
            return [];
        }
    }

    /**
     * Force cancel a running task
     */
    async cancelTask(taskId) {
        try {
            if (this.runningTasks.has(taskId)) {
                console.log(`🛑 Force cancelling running task: ${taskId}`);
                
                // Try to cancel in orchestrator
                await this.orchestrator.cancel(taskId);
                
                // Remove from running tasks
                this.runningTasks.delete(taskId);
                
                console.log(`✅ Task ${taskId} cancelled and removed from worker`);
                return true;
            } else {
                console.log(`⚠️ Task ${taskId} is not currently running in worker`);
                
                // Still try to cancel in database
                await this.tasksService.cancelTask(taskId);
                return false;
            }

        } catch (error) {
            console.error(`❌ Error cancelling task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Health check for monitoring
     */
    async healthCheck() {
        try {
            const status = this.getStatus();
            const runningTasks = await this.getRunningTasksDetails();
            
            return {
                status: 'healthy',
                worker: status,
                runningTasks: runningTasks.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Health check failed:', error);
            
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = BackgroundWorker;