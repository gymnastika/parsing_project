/**
 * FastLoader - Lightweight loading system for preventing navigation race conditions
 * 
 * Features:
 * - Fast loading (1-2 seconds maximum)
 * - Essential checks only (no expensive async validation)
 * - Navigation blocking during critical initialization
 * - Simple progress feedback
 */
class FastLoader {
    constructor(options = {}) {
        this.options = {
            maxTimeout: options.maxTimeout || 1500, // 1.5 seconds max
            minTimeout: options.minTimeout || 300,   // 300ms minimum
            checkInterval: options.checkInterval || 200, // Check every 200ms
            onProgress: options.onProgress || null,
            onComplete: options.onComplete || null,
            debug: options.debug || false
        };
        
        this.isReady = false;
        this.startTime = null;
        this.checkCount = 0;
        this.navigationBlocked = true;
        this.progressInterval = null;
    }

    /**
     * Start the adaptive loading process
     */
    async start() {
        this.log('🚀 Starting fast loading...');
        this.startTime = Date.now();
        this.isReady = false;
        this.navigationBlocked = true;
        this.checkCount = 0;

        // Block navigation during loading
        this.blockNavigation();
        
        // Start progress checking
        this.startProgressCheck();
        
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    /**
     * Start periodic readiness checking
     */
    startProgressCheck() {
        this.progressInterval = setInterval(() => {
            this.checkReadiness();
        }, this.options.checkInterval);

        // Fast fallback timeout (max 1.5 seconds)
        setTimeout(() => {
            if (!this.isReady) {
                this.log('⚠️ Maximum timeout reached, completing loading');
                this.completeLoading('timeout');
            }
        }, this.options.maxTimeout);
    }

    /**
     * Check if essential components are ready
     */
    checkReadiness() {
        this.checkCount++;
        const elapsed = Date.now() - this.startTime;
        
        // Don't complete before minimum timeout (300ms)
        if (elapsed < this.options.minTimeout) {
            this.updateProgress('Инициализация...', 30);
            return;
        }

        const isReady = this.checkEssentials();
        const progress = elapsed < 500 ? 60 : 90; // Simple progress based on time

        this.log(`📊 Fast check #${this.checkCount}: essentials ${isReady ? 'ready' : 'pending'} (${progress}%)`);
        this.updateProgress('Загрузка системы...', progress);

        // Complete if essentials are ready OR after 800ms minimum
        if (isReady || elapsed > 800) {
            this.log('✅ Fast loading complete');
            this.completeLoading('success');
        }
    }

    /**
     * Check only essential items that prevent navigation race condition
     */
    checkEssentials() {
        // 1. Check if platform class exists and has started initializing
        if (!window.platform) {
            return false;
        }

        // 2. Check if basic DOM is ready (dashboard container exists)
        const dashboard = document.getElementById('dashboard');
        if (!dashboard) {
            return false;
        }

        // 3. Check if navigation elements exist
        const navLinks = document.querySelectorAll('.nav-link');
        if (navLinks.length === 0) {
            return false;
        }

        // All essential checks passed
        return true;
    }


    /**
     * Complete the loading process
     */
    completeLoading(reason = 'success') {
        if (this.isReady) return; // Prevent double completion
        
        this.isReady = true;
        const elapsed = Date.now() - this.startTime;
        
        this.log(`✅ Loading completed (${reason}) in ${elapsed}ms`);
        
        // Clear progress interval
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        // Unblock navigation
        this.unblockNavigation();

        // Update progress to 100%
        this.updateProgress('Система готова к использованию', 100);

        // Hide loading screen with smooth transition
        this.hideLoadingScreen();

        // Notify completion
        if (this.options.onComplete) {
            this.options.onComplete(reason, elapsed);
        }

        if (this.resolve) {
            this.resolve({ reason, elapsed });
        }
    }

    /**
     * Block navigation during loading
     */
    blockNavigation() {
        this.log('🚫 Blocking navigation during loading');
        this.navigationBlocked = true;
        
        // Add event listener to prevent navigation
        document.addEventListener('click', this.navigationBlocker.bind(this), true);
        
        // Add visual indicator
        document.body.style.pointerEvents = 'none';
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.pointerEvents = 'auto'; // Allow loading screen interactions
        }
    }

    /**
     * Unblock navigation after loading
     */
    unblockNavigation() {
        this.log('✅ Unblocking navigation - system ready');
        this.navigationBlocked = false;
        
        // Remove event listener
        document.removeEventListener('click', this.navigationBlocker.bind(this), true);
        
        // Remove visual indicator
        document.body.style.pointerEvents = 'auto';
    }

    /**
     * Navigation blocker event handler
     */
    navigationBlocker(event) {
        if (!this.navigationBlocked) return;
        
        // Allow clicks on loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen && loadingScreen.contains(event.target)) {
            return;
        }
        
        // Block navigation clicks
        const navElement = event.target.closest('.nav-link, .section-btn, [data-section]');
        if (navElement) {
            event.preventDefault();
            event.stopPropagation();
            this.log('🚫 Navigation blocked - loading in progress');
            this.showBlockedMessage();
        }
    }

    /**
     * Show message when navigation is blocked
     */
    showBlockedMessage() {
        // Update loading text to indicate blocking
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            const originalText = loadingText.textContent;
            loadingText.textContent = 'Загрузка системы... Подождите завершения';
            loadingText.style.color = '#fbbf24'; // Yellow color for warning
            
            setTimeout(() => {
                loadingText.textContent = originalText;
                loadingText.style.color = '';
            }, 1500);
        }
    }

    /**
     * Update loading progress
     */
    updateProgress(message, percentage) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }

        if (this.options.onProgress) {
            this.options.onProgress(message, percentage);
        }

        this.log(`📈 Progress: ${percentage}% - ${message}`);
    }

    /**
     * Hide loading screen with smooth transition
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;

        // Add fade-out transition
        loadingScreen.classList.add('fade-out');
        
        setTimeout(() => {
            loadingScreen.style.setProperty('display', 'none', 'important');
            
            // Show dashboard
            const dashboard = document.getElementById('dashboard');
            if (dashboard) {
                dashboard.classList.remove('hidden');
            }
        }, 300); // Wait for fade animation
    }

    /**
     * Log debug information
     */
    log(message, ...args) {
        if (this.options.debug) {
            console.log(`[FastLoader] ${message}`, ...args);
        }
    }

    /**
     * Get current loading statistics
     */
    getStats() {
        return {
            isReady: this.isReady,
            elapsed: this.startTime ? Date.now() - this.startTime : 0,
            checkCount: this.checkCount,
            navigationBlocked: this.navigationBlocked
        };
    }
}

// Make available globally
window.FastLoader = FastLoader;