/**
 * GYMNASTIKA Parsing Tasks Service
 * Database service for managing server-side parsing tasks
 */

const { createClient } = require('@supabase/supabase-js');

class ParsingTasksService {
    constructor() {
        // Check for required environment variables
        if (!process.env.SUPABASE_URL) {
            console.warn('⚠️ SUPABASE_URL not configured - Parsing Tasks Service will be disabled');
            this.supabase = null;
            this.enabled = false;
            return;
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!serviceKey) {
            console.warn('⚠️ No Supabase key configured - Parsing Tasks Service will be disabled');
            this.supabase = null;
            this.enabled = false;
            return;
        }

        try {
            // Use server-side Supabase client with service role key for background operations
            this.supabase = createClient(process.env.SUPABASE_URL, serviceKey);
            this.enabled = true;
            console.log('📋 Parsing Tasks Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Parsing Tasks Service:', error.message);
            this.supabase = null;
            this.enabled = false;
        }
    }

    /**
     * Create a new parsing task
     */
    async createTask(userId, taskData) {
        if (!this.enabled) {
            console.warn('⚠️ Parsing Tasks Service is disabled - cannot create task');
            return null;
        }

        try {
            console.log('📝 ParsingTasksService.createTask called with:', {
                userId,
                taskName: taskData.taskName,
                type: taskData.type,
                searchQuery: taskData.searchQuery,
                websiteUrl: taskData.websiteUrl
            });

            const task = {
                user_id: userId,
                task_name: taskData.taskName,
                search_query: taskData.searchQuery || null,  // Optional for URL parsing
                website_url: taskData.websiteUrl || null,    // Optional for AI search
                task_type: taskData.type || 'ai-search',
                status: 'pending',
                current_stage: 'initializing',
                progress: {
                    current: 0,
                    total: taskData.type === 'ai-search' ? 7 : 3,  // 7 for AI search, 3 for URL parsing
                    stage: 'initializing',
                    message: 'Задача создана, ожидает выполнения...'
                }
            };

            console.log('📤 Inserting task into database:', JSON.stringify(task, null, 2));

            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .insert([task])
                .select()
                .single();

            if (error) {
                console.error('❌ Supabase error creating parsing task:', error);
                console.error('❌ Error details:', JSON.stringify(error, null, 2));
                throw error;
            }

            console.log(`✅ Created parsing task: ${data.id} for user ${userId}`);
            return data;

        } catch (error) {
            console.error('💥 Failed to create parsing task:', error);
            console.error('💥 Error message:', error.message);
            console.error('💥 Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Get task by ID
     */
    async getTask(taskId) {
        try {
            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('id', taskId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Task not found
                }
                throw error;
            }

            return data;

        } catch (error) {
            console.error(`❌ Error getting task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Get all tasks for a user
     */
    async getUserTasks(userId, limit = 50) {
        try {
            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error(`❌ Error getting tasks for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get user's active tasks (pending or running)
     */
    async getActiveTasks(userId) {
        try {
            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('user_id', userId)
                .in('status', ['pending', 'running'])
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error(`❌ Error getting active tasks for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get pending tasks (for background worker)
     */
    async getPendingTasks(limit = 10) {
        if (!this.enabled) {
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('❌ Error getting pending tasks:', error);
            throw error;
        }
    }

    /**
     * Get stuck/orphaned running tasks (for recovery)
     * Tasks in 'running' status for more than timeout threshold
     */
    async getStuckTasks(timeoutMinutes = 5, limit = 10) {
        if (!this.enabled) {
            return [];
        }

        try {
            // Calculate cutoff time (tasks older than this are considered stuck)
            const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('status', 'running')
                .lt('updated_at', cutoffTime) // updated_at older than cutoff
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('❌ Error getting stuck tasks:', error);
            throw error;
        }
    }

    /**
     * Get running tasks (for monitoring)
     */
    async getRunningTasks() {
        try {
            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('status', 'running')
                .order('updated_at', { ascending: true });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('❌ Error getting running tasks:', error);
            throw error;
        }
    }

    /**
     * Update task status and progress
     */
    async updateTask(taskId, updates) {
        if (!this.enabled) {
            console.warn('⚠️ Parsing Tasks Service is disabled - cannot update task');
            return null;
        }

        try {
            const updateData = {
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Set completed_at if status is completed
            if (updates.status === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }

            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .update(updateData)
                .eq('id', taskId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log(`📝 Updated task ${taskId}: ${updates.status || 'progress'}`);
            return data;

        } catch (error) {
            console.error(`❌ Error updating task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Update task progress
     */
    async updateProgress(taskId, stage, current, total, message) {
        return this.updateTask(taskId, {
            current_stage: stage,
            progress: {
                current,
                total,
                stage,
                message
            }
        });
    }

    /**
     * Mark task as running
     */
    async markAsRunning(taskId) {
        return this.updateTask(taskId, {
            status: 'running',
            current_stage: 'initializing'
        });
    }

    /**
     * Mark task as completed
     */
    async markAsCompleted(taskId, finalResults) {
        return this.updateTask(taskId, {
            status: 'completed',
            current_stage: 'complete',
            final_results: finalResults,
            progress: {
                current: 7,
                total: 7,
                stage: 'complete',
                message: `Завершено! Найдено ${finalResults?.length || 0} результатов`
            }
        });
    }

    /**
     * Mark task as failed
     */
    async markAsFailed(taskId, errorMessage) {
        return this.updateTask(taskId, {
            status: 'failed',
            error_message: errorMessage,
            retry_count: 0
        });
    }

    /**
     * Reset stuck task back to pending for retry
     */
    async resetStuckTask(taskId) {
        try {
            const task = await this.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const retryCount = (task.retry_count || 0) + 1;

            return this.updateTask(taskId, {
                status: 'pending',
                retry_count: retryCount,
                error_message: `Task was stuck in 'running' status, reset to pending (retry ${retryCount})`
            });
        } catch (error) {
            console.error(`❌ Error resetting stuck task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Save OpenAI data
     */
    async saveOpenAIData(taskId, threadId, queries) {
        return this.updateTask(taskId, {
            openai_thread_id: threadId,
            generated_queries: queries,
            current_stage: 'apify-search'
        });
    }

    /**
     * Save Apify run data
     */
    async saveApifyRuns(taskId, runs) {
        return this.updateTask(taskId, {
            apify_runs: runs
        });
    }

    /**
     * Save collected results
     */
    async saveResults(taskId, results, stage = 'collected_results') {
        const updateData = {};
        updateData[stage] = results;
        
        return this.updateTask(taskId, updateData);
    }

    /**
     * Clean up old completed tasks (optional maintenance)
     */
    async cleanupOldTasks(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { data, error } = await this.supabase
                .from('parsing_tasks')
                .delete()
                .eq('status', 'completed')
                .lt('completed_at', cutoffDate.toISOString())
                .select('id');

            if (error) {
                throw error;
            }

            if (data && data.length > 0) {
                console.log(`🧹 Cleaned up ${data.length} old completed tasks`);
            }

            return data?.length || 0;

        } catch (error) {
            console.error('❌ Error cleaning up old tasks:', error);
            throw error;
        }
    }

    /**
     * Cancel a task
     */
    async cancelTask(taskId) {
        return this.updateTask(taskId, {
            status: 'cancelled',
            current_stage: 'cancelled'
        });
    }
}

module.exports = ParsingTasksService;