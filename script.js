// GYMNASTIKA RG Club UAE - Main Platform Script
class GymnastikaPlatform {
    constructor() {
        this.currentSection = 'parsing';
        this.currentUser = null;
        this.apifyClient = null;
        this.openaiClient = null;
        this.googleDriveClient = null;
        this.pipelineOrchestrator = null;
        this.supabase = null;
        this.fileManager = null;
        this.telegramSettingsBound = false;
        this.navigationBound = false;
        this.adaptiveLoader = null;
        this.taskSubscription = null; // Real-time subscription for parsing tasks
        this.taskPollingInterval = null; // Polling fallback for task updates
        this.currentTaskId = null; // Currently active task ID
        this.lastTaskStatus = null; // Last known task status for polling
        this.settings = {
            telegramBotToken: localStorage.getItem('telegramBotToken') || ''
        };

        // 📅 Date sorting settings for contacts
        this.dateSortDirection = 'desc'; // 'desc' = новые сверху, 'asc' = старые сверху
        this.lastContactsData = null; // Cache for re-sorting
    }

    // Initialize platform
    async init() {
        try {
            console.log('🚀 Initializing GYMNASTIKA Platform...');
            
            // Initialize Fast Loader (1-2 seconds max)
            this.fastLoader = new FastLoader({
                debug: true,
                onProgress: (message, percentage) => {
                    console.log(`📈 Fast loading progress: ${percentage}% - ${message}`);
                },
                onComplete: (reason, elapsed) => {
                    console.log(`✅ Fast loading completed: ${reason} in ${elapsed}ms`);
                }
            });
            
            // Check authentication
            const isAuthenticated = await this.checkAuth();
            if (!isAuthenticated) {
                this.showLoginForm();
                return;
            }

            // CRITICAL FIX: Show dashboard for already authenticated users
            console.log('✅ User already authenticated, showing dashboard...');
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            this.bindLogoutButtonForDashboard();

            // Start fast loading process (max 1.5 seconds)
            const loadingPromise = this.fastLoader.start();

            // Initialize components in parallel
            await this.initializeSystemComponents();

            // Wait for fast loading to complete
            await loadingPromise;

            // Check for active parsing tasks and restore state
            await this.checkAndRestoreActiveTask();

        } catch (error) {
            console.error('❌ Platform initialization error:', error);
            this.showError('Ошибка инициализации платформы');
        }
    }

    // Initialize system components in proper sequence
    async initializeSystemComponents() {
        try {
            console.log('🔧 Starting system component initialization...');
            
            // Step 1: Initialize clients (takes most time)
            console.log('📡 Initializing API clients...');
            await this.initializeClients();
            
            // Step 2: Initialize UI bindings
            console.log('🎨 Initializing UI components...');
            await this.initializeUI();
            
            // Step 3: Mark navigation as ready
            this.navigationBound = true;
            
            console.log('✅ System components initialized successfully');
            
        } catch (error) {
            console.error('❌ System component initialization failed:', error);
            throw error;
        }
    }

    // Get auth token helper method
    async getAuthToken() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            return session?.access_token || null;
        } catch (error) {
            console.error('❌ Failed to get auth token:', error);
            return null;
        }
    }

    // Check authentication status
    async checkAuth() {
        try {
            if (!window.SupabaseClient) {
                console.log('⏳ Waiting for Supabase client...');
                return false;
            }

            // Initialize Supabase client if not already initialized
            if (!window.SupabaseClient.isReady()) {
                console.log('🔄 Initializing Supabase client...');
                await window.SupabaseClient.initialize();
            }

            this.supabase = window.SupabaseClient.getClient();
            console.log('✅ Supabase client ready, checking session...');

            try {
                const { data: { session }, error } = await this.supabase.auth.getSession();
                console.log('🔍 Session check result:', { session: !!session, error });

                if (error) {
                    console.error('❌ Auth check error:', error);
                    return false;
                }

                if (session) {
                    console.log('✅ User is authenticated');
                    this.currentUser = session.user;
                    await this.loadUserProfile(session.user);
                    return true;
                }

                console.log('ℹ️ User is not authenticated');
                return false;
            } catch (sessionError) {
                console.error('❌ Session check failed:', sessionError);
                return false;
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            return false;
        }
    }

    // Load user profile data
    async loadUserProfile(user) {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('username, first_name, last_name')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('❌ Profile load error:', error);
                return;
            }

            // Update UI with profile data
            const currentUsername = document.getElementById('currentUsername');
            if (currentUsername && profile) {
                const displayName = profile.username ? 
                    `${profile.username} (${profile.first_name || ''} ${profile.last_name || ''})`.trim() :
                    user.email;
                currentUsername.textContent = displayName;
                console.log('✅ Username updated:', displayName);
            } else {
                console.log('❌ Profile element or data not found:', { 
                    element: !!currentUsername, 
                    profile: !!profile 
                });
            }
        } catch (error) {
            console.error('❌ Profile loading failed:', error);
        }
    }

    // Show login form
    showLoginForm() {
        console.log('🔐 Showing login form...');
        
        // Force hide loading screen (inline CSS display:flex!important blocks CSS classes)
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.setProperty('display', 'none', 'important');
            console.log('✅ Loading screen hidden via style.setProperty');
        }
        
        // Show login screen, hide dashboard
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        
        this.bindAuthEvents();
    }

    // Bind authentication events
    bindAuthEvents() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const showRegister = document.getElementById('registerToggle');
        const showLogin = document.getElementById('loginToggle');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                await this.login(username, password);
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('registerPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const username = document.getElementById('registerUsername').value;
                const firstName = document.getElementById('firstName').value;
                const lastName = document.getElementById('lastName').value;
                const secretCode = document.getElementById('secretCode').value;

                // 🔒 SECURITY: Validate password confirmation
                if (password !== confirmPassword) {
                    this.showError('Пароли не совпадают. Пожалуйста, проверьте введенные данные.');
                    return;
                }

                // Generate email from username for Supabase compatibility
                const email = `${username}@gmail.com`;

                await this.register(email, password, username, firstName, lastName, secretCode);
            });
        }

        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('registerForm').classList.remove('hidden');
                // Update toggle button states
                document.getElementById('loginToggle').classList.remove('active');
                document.getElementById('registerToggle').classList.add('active');
            });
        }

        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('registerForm').classList.add('hidden');
                document.getElementById('loginForm').classList.remove('hidden');
                // Update toggle button states
                document.getElementById('registerToggle').classList.remove('active');
                document.getElementById('loginToggle').classList.add('active');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    // Login user
    async login(username, password) {
        try {
            if (!window.gymnastikaAuth) {
                throw new Error('Auth client not available');
            }

            // Initialize auth client if needed
            if (!window.gymnastikaAuth.isInitialized()) {
                console.log('🔄 Initializing auth client...');
                await window.gymnastikaAuth.initialize();
            }

            // Use the auth client's login method (it handles username->email lookup)
            const result = await window.gymnastikaAuth.login(username, password);
            const data = { user: result.user, session: result.session };

            console.log('✅ Login successful');
            await this.loadUserProfile(data.user);
            
            // Loading screen will be hidden by FastLoader automatically
            // Hide auth screen and show dashboard
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');

            // CRITICAL FIX: Bind logout button when showing dashboard
            this.bindLogoutButtonForDashboard();

            // Initialize platform after successful login
            setTimeout(async () => {
                await this.initializeClients();
                setTimeout(async () => {
                    await this.initializeUI();
                }, 1000);
            }, 1500);

        } catch (error) {
            console.error('❌ Login error:', error);
            this.showError('Ошибка входа: ' + error.message);
        }
    }

    // Register user with email proxy
    async register(email, password, username, firstName, lastName, secretCode) {
        try {
            if (!window.gymnastikaAuth) {
                throw new Error('Auth client not available');
            }

            // Initialize auth client if needed
            if (!window.gymnastikaAuth.isInitialized()) {
                console.log('🔄 Initializing auth client...');
                await window.gymnastikaAuth.initialize();
            }

            // Use the auth client's register method with email proxy
            const result = await window.gymnastikaAuth.register({
                email,
                password,
                username,
                firstName,
                lastName,
                secretCode
            });

            console.log('✅ Registration successful');
            this.showSuccess('Регистрация выполнена успешно!');
            // Clear form and redirect to login after successful registration
            setTimeout(() => {
                this.clearRegistrationForm();
                this.switchToLoginForm();
            }, 1500);
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showError('Ошибка регистрации: ' + error.message);
        }
    }

    // Clear registration form fields
    clearRegistrationForm() {
        try {
            document.getElementById('registerPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('registerUsername').value = '';
            document.getElementById('firstName').value = '';
            document.getElementById('lastName').value = '';
            document.getElementById('secretCode').value = '';
            console.log('✅ Registration form cleared');
        } catch (error) {
            console.error('❌ Error clearing registration form:', error);
        }
    }

    // Switch to login form
    switchToLoginForm() {
        try {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');

            // Update toggle button states
            const loginToggle = document.getElementById('loginToggle');
            const registerToggle = document.getElementById('registerToggle');
            if (loginToggle) loginToggle.classList.add('active');
            if (registerToggle) registerToggle.classList.remove('active');

            console.log('✅ Switched to login form');
        } catch (error) {
            console.error('❌ Error switching to login form:', error);
        }
    }

    // Logout user
    async logout() {
        try {
            console.log('🔗 Starting logout process...');
            
            if (this.supabase) {
                await this.supabase.auth.signOut();
            }
            
            // Clear auth-related localStorage only (preserve other data)
            localStorage.removeItem('user');
            localStorage.removeItem('supabase.auth.token');
            localStorage.removeItem('sb-' + window.location.hostname + '-auth-token');
            
            console.log('✅ Logout completed, redirecting...');
            
            // Redirect to clean homepage (without URL parameters)
            window.location.href = '/index.html';
        } catch (error) {
            console.error('❌ Logout error:', error);
            // Force redirect even on error
            window.location.href = '/index.html';
        }
    }

    // Initialize API clients
    async initializeClients() {
        try {
            // Initialize Supabase client (already done in checkAuth)
            if (!this.supabase && window.SupabaseClient) {
                this.supabase = window.SupabaseClient.getClient();
            }

            // 🔧 ENHANCED FIX: Ensure gymnastikaDB is properly initialized
            if (window.gymnastikaDB && !window.gymnastikaDB.isInitialized) {
                console.log('🔄 Ensuring database client is initialized during client setup...');
                try {
                    await window.gymnastikaDB.initialize();
                    console.log('✅ Database client re-initialized successfully');
                } catch (initError) {
                    console.error('❌ Failed to re-initialize database client:', initError);
                }
            }
            
            // 🔍 DEBUG: Check database status after initialization
            console.log('🔍 DEBUG: Database client status after initialization:', {
                'gymnastikaDB exists': !!window.gymnastikaDB,
                'isInitialized': window.gymnastikaDB?.isInitialized,
                'isReady': window.gymnastikaDB?.isReady ? window.gymnastikaDB.isReady() : 'not available'
            });

            // Initialize Apify client
            if (window.ApifyClient) {
                this.apifyClient = new window.ApifyClient();
                console.log('🕷️ Apify client initialized');
            }

            // Initialize OpenAI client
            if (window.OpenAIClient) {
                this.openaiClient = new window.OpenAIClient();
                console.log('🤖 OpenAI client initialized');
            }
            
            // Initialize Google Drive client
            if (window.GoogleDriveClient) {
                this.googleDriveClient = new window.GoogleDriveClient({
                    debug: true,
                    showProgress: true
                });
                console.log('📤 Google Drive client initialized');
            }

            // Initialize Pipeline Orchestrator
            if (window.PipelineOrchestrator && this.apifyClient && this.openaiClient) {
                this.pipelineOrchestrator = new window.PipelineOrchestrator(
                    this.apifyClient,
                    this.openaiClient,
                    this.supabase
                );
                console.log('📊 Pipeline orchestrator initialized');
            }

            // Initialize FileManager with Gmail-compatible settings
            if (window.FileManager && this.supabase) {
                this.fileManager = new window.FileManager(this.supabase, {
                    debug: true,
                    maxFileSize: 25 * 1024 * 1024, // 25MB (Gmail limit)
                    maxTotalSize: 25 * 1024 * 1024, // 25MB total (Gmail limit)
                    maxFileCount: 10, // Recommended for Gmail
                    defaultBucket: 'email-attachments'
                });
                await this.fileManager.initialize();
                console.log('📁 FileManager initialized with Gmail-compatible settings');
            }

        } catch (error) {
            console.error('❌ Client initialization error:', error);
        }
    }

    // Initialize UI components
    async initializeUI() {
        try {
            console.log('🎨 Initializing UI components...');
            
            // Bind navigation if not already bound
            if (!this.navigationBound) {
                this.bindNavigation();
                this.navigationBound = true;
            }
            
            // Show initial section
            this.showSection('parsing');
            
            // Initialize parsing forms
            this.bindParsingForm();
            this.bindUrlParsingForm();

            // Bind tab buttons for parsing section
            this.bindTabButtons();
            
            // Bind logout button
            this.bindLogoutButton();
            
            // Bind telegram settings if not already bound
            if (!this.telegramSettingsBound) {
                await this.setupTelegramSettings();
                this.telegramSettingsBound = true;
            }
            
            // Bind Google OAuth button
            this.bindGoogleOAuth();

            // Bind Categories Management
            this.bindCategoriesManagement();
            
            // Bind email form validation
            this.bindEmailForm();
            
            // Check Google connection status
            this.checkGoogleConnectionStatus();
            
            // Bind completion modal events
            this.bindCompletionModal();

            // Force hide completion modal on startup
            this.hideCompletionModal();

            // Bind search input for database filtering
            this.bindSearchInput();

            // Setup hybrid task monitoring (real-time + polling fallback)
            await this.setupTaskMonitoring();

            console.log('✅ UI initialization complete');
            
        } catch (error) {
            console.error('❌ UI initialization error:', error);
        }
    }

    // Bind navigation events
    bindNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        console.log(`🔗 Found ${navLinks.length} navigation links`);
        
        navLinks.forEach((link, index) => {
            console.log(`🔗 Binding nav link ${index}: ${link.textContent.trim()}`);
            link.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default link behavior
                const section = link.dataset.section;
                console.log(`🔗 Navigation clicked: ${section}`);
                if (section) {
                    this.showSection(section);
                }
            });
        });
    }

    // Show specific section
    async showSection(sectionName) {
        console.log(`🔄 Switching to section: ${sectionName}`);
        
        // Update current section
        this.currentSection = sectionName;
        
        // Hide all sections
        document.querySelectorAll('.section-content').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const targetSection = document.getElementById(`${sectionName}-content`);
        if (targetSection) {
            console.log(`✅ Found section: ${sectionName}-content`);
            targetSection.classList.add('active');
        } else {
            console.log(`❌ Section not found: ${sectionName}-content`);
        }
        
        // Update browser URL hash
        window.location.hash = sectionName;
        
        // Update page title
        const pageTitle = document.getElementById('pageTitle');
        const titles = {
            'parsing': 'Парсинг данных',
            'database': 'База данных', 
            'email': 'Рассылка email',
            'settings': 'Настройки'
        };
        if (pageTitle && titles[sectionName]) {
            pageTitle.textContent = titles[sectionName];
        }
        
        // Update navigation state - ИСПРАВЛЕНО: .nav-link вместо .nav-button
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeButton) {
            console.log(`✅ Found active nav link for: ${sectionName}`);
            activeButton.classList.add('active');
        } else {
            console.log(`❌ Nav link not found for: ${sectionName}`);
        }
        
        // Load section-specific data
        await this.loadSectionData(sectionName);
        
        // 🔧 FIX: Auto-activate default tabs when entering sections
        if (sectionName === 'parsing') {
            console.log('🔄 Auto-activating AI search tab for parsing section');
            // Small delay to ensure UI is ready
            setTimeout(() => {
                this.switchTab('ai-search');
            }, 100);
            // Load categories into parsing form selects
            await this.loadCategoriesIntoSelects();
        } else if (sectionName === 'database') {
            console.log('🔄 Auto-activating task history tab for database section');
            // Small delay to ensure UI is ready
            setTimeout(() => {
                this.switchTab('task-history');
            }, 100);
        }
    }

    // Load section-specific data
    async loadSectionData(sectionName) {
        try {
            switch (sectionName) {
                case 'database':
                    // Load the default active tab (task-history) when navigating to database section
                    console.log('🎯 Database section - loading default active tab (task-history)');
                    await this.loadHistoryData();
                    break;
                case 'history':
                    await this.loadHistoryData();
                    break;
                case 'contacts':
                    await this.loadContactsData();
                    break;
                case 'email':
                    console.log('🎯 Email section - data synchronization ready');
                    // Check for and restore any saved email session state
                    const restored = await this.restoreEmailSessionState();
                    if (!restored) {
                        console.log('📧 Starting fresh email campaign');
                        // Ensure we're on step 1 if no session to restore
                        this.resetEmailToStep1();
                    }
                    // Email section contacts are loaded on-demand via loadEmailContacts()
                    // when user navigates to contact selection step, ensuring fresh data
                    break;
                default:
                    console.log(`No data loading required for section: ${sectionName}`);
                    break;
            }
        } catch (error) {
            console.error(`❌ Error loading ${sectionName} data:`, error);
        }
    }

    // ===== CACHE MANAGEMENT METHODS =====
    
    // Set data in localStorage cache with timestamp
    setCacheData(key, data) {
        try {
            const cacheEntry = {
                data: data,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
            console.log(`💾 Cached data for key: ${key} (${data?.length || 0} items)`);
        } catch (error) {
            console.error('❌ Error setting cache data:', error);
        }
    }

    // Get data from localStorage cache if valid
    getCacheData(key, maxAge = 3600000) { // Default: 1 hour cache
        try {
            const cacheEntry = localStorage.getItem(`cache_${key}`);
            if (!cacheEntry) {
                console.log(`📦 No cache found for key: ${key}`);
                return null;
            }

            const parsedEntry = JSON.parse(cacheEntry);
            const isValid = this.isCacheValid(parsedEntry.timestamp, maxAge);
            
            if (isValid) {
                console.log(`📦 Cache hit for key: ${key} (${parsedEntry.data?.length || 0} items)`);
                return parsedEntry.data;
            } else {
                console.log(`⏰ Cache expired for key: ${key}`);
                this.invalidateCache(key);
                return null;
            }
        } catch (error) {
            console.error('❌ Error getting cache data:', error);
            return null;
        }
    }

    // Check if cache timestamp is still valid
    isCacheValid(timestamp, maxAge = 3600000) {
        const now = Date.now();
        const age = now - timestamp;
        return age < maxAge;
    }

    // Invalidate (clear) cache for specific key
    invalidateCache(key) {
        try {
            localStorage.removeItem(`cache_${key}`);
            console.log(`🗑️ Cache invalidated for key: ${key}`);
        } catch (error) {
            console.error('❌ Error invalidating cache:', error);
        }
    }

    // Clear all cache entries
    clearAllCache() {
        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(key => key.startsWith('cache_'));
            cacheKeys.forEach(key => localStorage.removeItem(key));
            console.log(`🧹 Cleared ${cacheKeys.length} cache entries`);
        } catch (error) {
            console.error('❌ Error clearing cache:', error);
        }
    }

    // ===== EMAIL SESSION PERSISTENCE METHODS =====

    // Save email wizard session state for recovery on page refresh
    saveEmailSessionState(sessionState) {
        try {
            console.log('💾 Saving email session state:', sessionState);
            this.setCacheData('email_session', sessionState);
        } catch (error) {
            console.error('❌ Error saving email session state:', error);
        }
    }

    // Get saved email wizard session state
    getEmailSessionState() {
        try {
            const sessionState = this.getCacheData('email_session');
            console.log('🔍 Retrieved email session state:', sessionState);
            return sessionState;
        } catch (error) {
            console.error('❌ Error retrieving email session state:', error);
            return null;
        }
    }

    // Clear email wizard session state (after successful send or manual clear)
    clearEmailSessionState() {
        try {
            this.invalidateCache('email_session');
            console.log('🗑️ Email session state cleared');
        } catch (error) {
            console.error('❌ Error clearing email session state:', error);
        }
    }

    // TODO: Add session cleanup to email sending completion
    // When email sending functionality is implemented, add this line after successful send:
    // this.clearEmailSessionState(); // Clear session after successful email send

    // Restore email wizard state from saved session
    async restoreEmailSessionState() {
        try {
            const sessionState = this.getEmailSessionState();
            if (!sessionState) {
                console.log('📭 No saved email session found');
                return false;
            }

            console.log('🔄 Restoring email session state...');

            // Restore campaign ID
            this.currentEmailCampaignId = sessionState.campaignId;

            // Restore form data
            const subjectInput = document.getElementById('emailSubject');
            const bodyInput = document.getElementById('emailBody');

            if (subjectInput) subjectInput.value = sessionState.subject || '';
            if (bodyInput) bodyInput.value = sessionState.body || '';

            // Restore current email campaign object
            this.currentEmailCampaign = {
                subject: sessionState.subject || '',
                body: sessionState.body || '',
                attachments: sessionState.attachments || []
            };

            // Restore attachments if any exist
            if (sessionState.attachments && sessionState.attachments.length > 0) {
                await this.restoreEmailAttachments(sessionState.attachments);
            }

            // Restore step state
            if (sessionState.step === 2) {
                console.log('🎯 Restoring to step 2...');
                this.showEmailStep2();

                // Show restoration notification
                this.showSuccess('Сессия восстановлена! Продолжите настройку рассылки.');
            }

            return true;

        } catch (error) {
            console.error('❌ Error restoring email session state:', error);
            return false;
        }
    }

    // Restore email attachments from saved session
    async restoreEmailAttachments(attachments) {
        try {
            console.log('📎 Restoring email attachments:', attachments);

            // Restore attachments data for display
            const attachmentsList = document.querySelector('.attachments-list');
            if (attachmentsList && attachments.length > 0) {
                // Clear existing attachments display
                attachmentsList.innerHTML = '';

                // Show attachments container
                const emailForm = document.querySelector('.email-compose-form');
                if (emailForm) {
                    emailForm.classList.add('has-files');
                }

                // Recreate attachment items for display
                attachments.forEach((attachment, index) => {
                    const attachmentDiv = this.createAttachmentDisplayItem(attachment, index);
                    attachmentsList.appendChild(attachmentDiv);
                });

                console.log(`✅ Restored ${attachments.length} attachments for display`);
            }

        } catch (error) {
            console.error('❌ Error restoring email attachments:', error);
        }
    }

    // Create attachment display item for restored files
    createAttachmentDisplayItem(attachment, index) {
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-item';
        attachmentDiv.setAttribute('data-file-index', index);

        const isGoogleDrive = attachment.driveFileId;
        const statusIcon = isGoogleDrive ? '☁️' : '📎';
        const storageLabel = isGoogleDrive ? 'Google Drive' : 'Supabase Storage';

        attachmentDiv.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${statusIcon}</span>
                <div class="file-details">
                    <div class="file-name">${attachment.name}</div>
                    <div class="file-meta">
                        <span class="file-size">${this.formatFileSize(attachment.size)}</span>
                        <span class="file-storage">${storageLabel}</span>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <span class="restore-note">Восстановлено</span>
            </div>
        `;

        return attachmentDiv;
    }

    // Reset email wizard to step 1 (clean state)
    resetEmailToStep1() {
        console.log('🔄 Resetting email wizard to step 1');

        const step1 = document.getElementById('emailStep1');
        const step2 = document.getElementById('emailStep2');
        const progressStep1 = document.querySelector('[data-step="1"]');
        const progressStep2 = document.querySelector('[data-step="2"]');

        // Show step 1, hide step 2
        if (step1) step1.classList.add('active');
        if (step2) step2.classList.remove('active');
        if (progressStep1) progressStep1.classList.add('active');
        if (progressStep2) progressStep2.classList.remove('active');

        // Clear form fields
        const subjectInput = document.getElementById('emailSubject');
        const bodyInput = document.getElementById('emailBody');
        if (subjectInput) subjectInput.value = '';
        if (bodyInput) bodyInput.value = '';

        // Clear current campaign data
        this.currentEmailCampaign = null;
        this.currentEmailCampaignId = null;

        // Hide attachments container if visible
        const emailForm = document.querySelector('.email-compose-form');
        const attachmentsList = document.querySelector('.attachments-list');
        if (emailForm) emailForm.classList.remove('has-files');
        if (attachmentsList) attachmentsList.innerHTML = '';

        console.log('✅ Email wizard reset to step 1');
    }

    // ===== END CACHE MANAGEMENT =====

    // Load database data with cache-first strategy
    async loadDatabaseData() {
        const container = document.getElementById('databaseResults');
        if (!container) {
            console.log('❌ Database container not found');
            return;
        }

        console.log('🚀 Loading database data with cache-first strategy...');

        // STEP 1: Try to load from cache first (instant display)
        const cachedData = this.getCacheData('parsing_results');
        if (cachedData && cachedData.length > 0) {
            console.log('⚡ Displaying cached data instantly...');
            this.displayResults(cachedData, container, 'database');
        } else {
            // Show loading only if no cache available
            container.innerHTML = '<div class="loading">Загрузка данных...</div>';
        }

        // STEP 2: Start background sync with Supabase
        this.syncDatabaseDataInBackground(container, cachedData);
    }

    // Background sync with Supabase database
    async syncDatabaseDataInBackground(container, cachedData) {
        try {
            console.log('🔄 Starting background sync with Supabase...');

            // Wait for Supabase client to be ready
            if (!this.supabase) {
                console.log('⏳ Waiting for Supabase client to initialize...');
                
                // Wait up to 5 seconds for Supabase client
                let attempts = 0;
                while (!this.supabase && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (!this.supabase) {
                    console.log('❌ Supabase client not ready - background sync failed');
                    if (!cachedData || cachedData.length === 0) {
                        container.innerHTML = '<div class="error">Не удалось подключиться к базе данных</div>';
                    }
                    return;
                }
            }

            // Fetch fresh data from Supabase
            const { data: freshResults, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`🔄 Background sync completed: ${freshResults?.length || 0} results`);

            // Check if we need to update the UI
            const needsUpdate = this.shouldUpdateUI(cachedData, freshResults);
            
            if (needsUpdate) {
                console.log('🔄 Fresh data differs from cache - updating UI...');
                
                if (freshResults && freshResults.length > 0) {
                    this.displayResults(freshResults, container, 'database');
                } else {
                    container.innerHTML = '<div class="empty-state">Нет данных для отображения</div>';
                }
            } else {
                console.log('✅ Cache is up to date - no UI update needed');
            }

            // Always update cache with fresh data
            if (freshResults) {
                this.setCacheData('parsing_results', freshResults);
            }

        } catch (error) {
            console.error('❌ Background sync error:', error);
            // Don't update UI if there was an error and we have cached data
            if (!cachedData || cachedData.length === 0) {
                container.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
            }
        }
    }

    // Check if UI needs to be updated based on data comparison
    shouldUpdateUI(cachedData, freshData) {
        // If no cached data, always update
        if (!cachedData || cachedData.length === 0) {
            return true;
        }

        // If no fresh data, update if cache had data
        if (!freshData || freshData.length === 0) {
            return cachedData.length > 0;
        }

        // Check if array lengths differ
        if (cachedData.length !== freshData.length) {
            return true;
        }

        // Compare first few items' timestamps/IDs for quick check
        if (cachedData.length > 0 && freshData.length > 0) {
            const cachedFirst = cachedData[0];
            const freshFirst = freshData[0];
            
            // Check if first item changed (most likely to change)
            if (cachedFirst.id !== freshFirst.id || 
                cachedFirst.updated_at !== freshFirst.updated_at ||
                cachedFirst.created_at !== freshFirst.created_at) {
                return true;
            }
        }

        return false;
    }

    // Load history data with cache-first strategy
    async loadHistoryData() {
        console.log('🔍 loadHistoryData() called with cache-first strategy');
        const container = document.getElementById('databaseEmpty');
        console.log('📦 databaseEmpty container:', container);
        if (!container) {
            console.log('❌ Missing container');
            return;
        }

        // STEP 1: Try to load from cache first (instant display)
        const cachedHistoryData = this.getCacheData('task_history');
        if (cachedHistoryData && cachedHistoryData.length > 0) {
            console.log('⚡ Displaying cached history data instantly...');
            this.displayHistory(cachedHistoryData, container);
        } else {
            // Show loading only if no cache available
            container.innerHTML = '<div class="loading">Загрузка истории...</div>';
        }

        // STEP 2: Start background sync with Supabase
        this.syncHistoryDataInBackground(container, cachedHistoryData);
    }

    // Background sync for history data
    async syncHistoryDataInBackground(container, cachedData) {
        try {
            console.log('🔄 Starting background sync for history data...');

            // Wait for Supabase client to be ready
            if (!this.supabase) {
                console.log('⏳ Waiting for Supabase client to initialize for history sync...');
                
                let attempts = 0;
                while (!this.supabase && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (!this.supabase) {
                    console.log('❌ Supabase client not ready - history background sync failed');
                    if (!cachedData || cachedData.length === 0) {
                        container.innerHTML = '<div class="error">Не удалось подключиться к базе данных</div>';
                    }
                    return;
                }
            }

            // Get all parsing tasks from NEW persistent tasks table
            const { data: tasks, error } = await this.supabase
                .from('parsing_tasks')
                .select('*')
                .eq('user_id', this.currentUser?.id)
                .order('created_at', { ascending: false });

            console.log('📊 Background history sync result:', { data: tasks?.length, error: error });

            if (error) throw error;

            let freshHistoryData = [];
            if (tasks && tasks.length > 0) {
                console.log(`🔄 Background sync found ${tasks.length} parsing tasks`);

                // Transform parsing_tasks to history format
                freshHistoryData = tasks.map(task => ({
                    task_name: task.task_name,
                    search_query: task.search_query || task.website_url || 'Unknown Query',
                    total_results: task.final_results?.results?.length || 0,
                    contacts_count: task.final_results?.results?.filter(r => r.email)?.length || 0,
                    latest_date: task.completed_at || task.updated_at || task.created_at,
                    task_type: task.task_type,  // 'ai-search' or 'url-parsing'
                    status: task.status,
                    task_id: task.id
                }));

                console.log(`📊 Background sync transformed into ${freshHistoryData.length} history items`);
            }

            // ✅ FIX: Load legacy data from parsing_results table for backward compatibility
            try {
                const { data: legacyResults, error: legacyError } = await this.supabase
                    .from('parsing_results')
                    .select('*')
                    .eq('user_id', this.currentUser?.id)
                    .order('parsing_timestamp', { ascending: false });

                if (!legacyError && legacyResults && legacyResults.length > 0) {
                    console.log(`📜 Found ${legacyResults.length} legacy results from parsing_results table`);

                    // Group legacy results by task_name
                    const legacyGroups = legacyResults.reduce((acc, item) => {
                        const key = item.task_name || 'Без названия';
                        if (!acc[key]) {
                            acc[key] = [];
                        }
                        acc[key].push(item);
                        return acc;
                    }, {});

                    // Transform legacy groups to history format
                    const legacyHistory = Object.entries(legacyGroups).map(([name, items]) => ({
                        task_name: name,
                        search_query: items[0].original_query || 'Не указан',
                        total_results: items.length,
                        contacts_count: items.filter(i => i.email).length,
                        latest_date: items[0].parsing_timestamp || items[0].created_at,
                        task_type: 'ai-search',  // Legacy data was from AI Search
                        status: 'completed',
                        task_id: null  // No task_id for legacy data
                    }));

                    console.log(`📜 Transformed ${legacyHistory.length} legacy task groups`);

                    // Merge with current tasks
                    freshHistoryData = [...freshHistoryData, ...legacyHistory];

                    // Sort all by date (most recent first)
                    freshHistoryData.sort((a, b) => new Date(b.latest_date) - new Date(a.latest_date));

                    console.log(`✅ Total history items: ${freshHistoryData.length} (including legacy)`);
                }
            } catch (legacyError) {
                console.warn('⚠️ Failed to load legacy data:', legacyError.message);
                // Continue with current tasks only if legacy load fails
            }

            // Check if we need to update the UI
            const needsUpdate = this.shouldUpdateHistoryUI(cachedData, freshHistoryData);
            
            if (needsUpdate) {
                console.log('🔄 Fresh history data differs from cache - updating UI...');
                
                if (freshHistoryData.length > 0) {
                    this.displayHistory(freshHistoryData, container);
                } else {
                    container.innerHTML = '<div class="empty-state">История задач пуста</div>';
                }
            } else {
                console.log('✅ History cache is up to date - no UI update needed');
            }

            // Always update cache with fresh data
            if (freshHistoryData) {
                this.setCacheData('task_history', freshHistoryData);
            }

        } catch (error) {
            console.error('❌ Background history sync error:', error);
            // Don't update UI if there was an error and we have cached data
            if (!cachedData || cachedData.length === 0) {
                container.innerHTML = '<div class="error">Ошибка загрузки истории</div>';
            }
        }
    }

    // Check if history UI needs to be updated
    shouldUpdateHistoryUI(cachedData, freshData) {
        // If no cached data, always update
        if (!cachedData || cachedData.length === 0) {
            return true;
        }

        // If no fresh data, update if cache had data
        if (!freshData || freshData.length === 0) {
            return cachedData.length > 0;
        }

        // Check if array lengths differ
        if (cachedData.length !== freshData.length) {
            return true;
        }

        // Compare first item's task name and latest date for quick check
        if (cachedData.length > 0 && freshData.length > 0) {
            const cachedFirst = cachedData[0];
            const freshFirst = freshData[0];
            
            if (cachedFirst.task_name !== freshFirst.task_name || 
                cachedFirst.latest_date !== freshFirst.latest_date ||
                cachedFirst.total_results !== freshFirst.total_results) {
                return true;
            }
        }

        return false;
    }

    // Helper method to group parsing results into search sessions
    groupResultsIntoSessions(results) {
        if (!results || results.length === 0) return [];

        // Group by unique combinations of search parameters and approximate timestamp
        const sessionMap = new Map();
        
        results.forEach(result => {
            // Create a session key based on search query and time proximity (within same hour)
            const searchQuery = result.search_query || result.query || 'Unknown';
            const timestamp = new Date(result.created_at);
            const hourKey = timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
            const sessionKey = `${searchQuery}_${hourKey}`;
            
            if (!sessionMap.has(sessionKey)) {
                sessionMap.set(sessionKey, {
                    session_id: result.session_id || `session_${sessionKey}`,
                    search_query: searchQuery,
                    query: searchQuery,
                    status: 'completed',
                    created_at: result.created_at,
                    results: []
                });
            }
            
            sessionMap.get(sessionKey).results.push(result);
        });

        // Convert map to array and sort by most recent
        return Array.from(sessionMap.values())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // Helper method to group parsing results by task_name (user's original design)
    groupResultsByTaskName(results) {
        if (!results || results.length === 0) return [];

        // Group by task_name
        const taskMap = new Map();
        
        results.forEach(result => {
            const taskName = result.task_name || 'Unnamed Task';
            
            if (!taskMap.has(taskName)) {
                taskMap.set(taskName, {
                    task_name: taskName,
                    original_query: result.original_query || 'Unknown Query',
                    results: [],
                    total_results: 0,
                    contacts_count: 0,
                    latest_date: result.parsing_timestamp
                });
            }
            
            const task = taskMap.get(taskName);
            task.results.push(result);
            task.total_results++;
            
            // Count contacts (results with email)
            if (result.email) {
                task.contacts_count++;
            }
            
            // Update latest date
            if (new Date(result.parsing_timestamp) > new Date(task.latest_date)) {
                task.latest_date = result.parsing_timestamp;
            }
        });

        // Convert map to array and sort by most recent
        return Array.from(taskMap.values())
            .sort((a, b) => new Date(b.latest_date) - new Date(a.latest_date));
    }

    // View results for a specific task (from parsing_tasks table)
    async viewTaskResults(taskName, taskId = null) {
        try {
            console.log(`👁 Viewing results for task: ${taskName}`, taskId ? `(ID: ${taskId})` : '(legacy)');

            if (!this.supabase) {
                console.error('❌ Supabase client not available');
                return;
            }

            let results = [];
            let taskFound = false;

            // Case 1: TaskId provided - load from parsing_results table first, then fallback to parsing_tasks
            if (taskId) {
                // First, get the task to find task_name
                const { data: tasks, error: taskError } = await this.supabase
                    .from('parsing_tasks')
                    .select('*')
                    .eq('id', taskId)
                    .limit(1);

                if (taskError) {
                    console.error('❌ Error fetching task:', taskError);
                    this.showError('Ошибка загрузки результатов');
                    return;
                }

                if (tasks && tasks.length > 0) {
                    taskFound = true;
                    const task = tasks[0];
                    const taskData = task.task_data || {};
                    const taskNameForQuery = taskData.taskName || task.task_name || taskName;

                    // Get Supabase auth user ID for query
                    const supabaseUserId = (await this.supabase.auth.getUser()).data.user?.id;

                    // Try to load from parsing_results table (new system)
                    console.log(`🔍 Looking for results: task_name="${taskNameForQuery}", user_id="${supabaseUserId}"`);
                    const { data: savedResults, error: resultsError } = await this.supabase
                        .from('parsing_results')
                        .select('*')
                        .eq('task_name', taskNameForQuery)
                        .eq('user_id', supabaseUserId);

                    if (resultsError) {
                        console.error('❌ Error querying parsing_results:', resultsError);
                    } else {
                        console.log(`📊 Query returned ${savedResults?.length || 0} results from parsing_results`);
                    }

                    if (!resultsError && savedResults && savedResults.length > 0) {
                        // Transform from parsing_results table format
                        results = savedResults.map(item => ({
                            organization_name: item.organization_name || 'Неизвестная организация',
                            email: item.email || '',
                            description: item.description || '',
                            website: item.website || item.source_url || '',
                            country: item.country || 'Не определено',
                            parsing_timestamp: item.parsing_timestamp || item.created_at
                        }));
                        console.log(`✅ Found ${results.length} results from parsing_results table`);
                    } else {
                        // Fallback to final_results in parsing_tasks (old system)
                        console.log(`⚠️ No results in parsing_results table, checking parsing_tasks.final_results...`);
                        let rawResults = task.final_results || [];
                        if (typeof rawResults === 'string') {
                            try {
                                rawResults = JSON.parse(rawResults);
                            } catch (e) {
                                console.error('❌ Failed to parse final_results:', e);
                                rawResults = [];
                            }
                        }

                        // Check if final_results has a nested structure
                        if (rawResults && rawResults.results && Array.isArray(rawResults.results)) {
                            results = rawResults.results;
                            console.log(`🔍 Found ${results.length} results from parsing_tasks.final_results.results`);
                        } else {
                            results = Array.isArray(rawResults) ? rawResults : [];
                            console.log(`🔍 Found ${results.length} results from parsing_tasks.final_results (fallback)`);
                        }
                    }
                }
            }

            // Case 2: No taskId (legacy data) - load from parsing_results
            if (!taskId) {
                console.log('📜 Loading legacy data from parsing_results...');

                const { data: legacyResults, error: legacyError } = await this.supabase
                    .from('parsing_results')
                    .select('*')
                    .eq('task_name', taskName)
                    .eq('user_id', this.currentUser?.id);

                if (legacyError) {
                    console.error('❌ Error fetching legacy results:', legacyError);
                    this.showError('Ошибка загрузки результатов');
                    return;
                }

                if (legacyResults && legacyResults.length > 0) {
                    // Transform legacy results to new format
                    results = legacyResults.map(item => ({
                        organization_name: item.organization_name || 'Неизвестная организация',
                        email: item.email || '',
                        description: item.description || '',
                        website: item.website || item.source_url || '',
                        country: item.country || 'Не определено',
                        parsing_timestamp: item.parsing_timestamp || item.created_at
                    }));
                    console.log(`📜 Found ${results.length} legacy results from parsing_results`);
                }
            }

            // Display results or appropriate error
            if (results && results.length > 0) {
                // Normalize results to standard format
                const normalizedResults = results.map(item => {
                    // Check if it's URL Parsing format (has 'url' field)
                    if (item.url) {
                        return {
                            organization_name: item.title || item.name || 'Не указано',
                            email: item.email || item.contact?.email || '',
                            description: item.description || '',
                            website: item.url || item.website || '',
                            country: item.country || 'Не указана',
                            parsing_timestamp: item.timestamp || item.created_at || new Date().toISOString()
                        };
                    }
                    // Legacy format - already normalized
                    return item;
                });

                this.showResultsModal(taskName, normalizedResults);
            } else if (taskFound) {
                // Task exists in parsing_tasks but has no results
                this.showError('Задача завершена без результатов или еще выполняется');
            } else {
                this.showError('Результаты не найдены');
            }
        } catch (error) {
            console.error('❌ Error viewing task results:', error);
            this.showError('Произошла ошибка при загрузке результатов');
        }
    }

    // Show task menu (user's original functionality)
    showTaskMenu(taskName) {
        console.log(`≡ Showing menu for task: ${taskName}`);
        
        // Create context menu for task actions
        const menu = document.createElement('div');
        menu.className = 'task-context-menu';
        menu.innerHTML = `
            <div class="menu-item" onclick="platform.exportTaskResults('${taskName}')">
                <span>📤</span> Экспорт результатов
            </div>
            <div class="menu-item" onclick="platform.deleteTask('${taskName}')">
                <span>🗑️</span> Удалить задачу
            </div>
            <div class="menu-item" onclick="platform.duplicateTask('${taskName}')">
                <span>📋</span> Дублировать задачу
            </div>
        `;
        
        // Position menu near the button
        const rect = event.target.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        
        // Add to body
        document.body.appendChild(menu);
        
        // Remove menu when clicking outside
        setTimeout(() => {
            const clickHandler = (e) => {
                if (!menu.contains(e.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', clickHandler);
                }
            };
            document.addEventListener('click', clickHandler);
        }, 100);
    }

    // Delete task from history and database
    async deleteTask(taskName, taskId = null) {
        try {
            console.log(`🗑️ Deleting task: ${taskName}`, taskId ? `(ID: ${taskId})` : '(legacy)');

            // Confirmation dialog
            const confirmed = confirm(`Вы уверены, что хотите удалить задачу "${taskName}"?\n\nЭто действие нельзя отменить.`);
            if (!confirmed) {
                console.log('❌ Deletion cancelled by user');
                return;
            }

            if (!this.supabase) {
                console.error('❌ Supabase client not available');
                this.showError('Ошибка подключения к базе данных');
                return;
            }

            let deletedFromTasks = false;
            let deletedFromResults = false;

            // Case 1: TaskId provided - delete from parsing_tasks
            if (taskId) {
                console.log(`🗑️ Deleting from parsing_tasks table (ID: ${taskId})...`);

                const { error: taskError } = await this.supabase
                    .from('parsing_tasks')
                    .delete()
                    .eq('id', taskId)
                    .eq('user_id', this.currentUser?.id);

                if (taskError) {
                    console.error('❌ Error deleting from parsing_tasks:', taskError);
                    throw taskError;
                }

                deletedFromTasks = true;
                console.log('✅ Successfully deleted from parsing_tasks');
            }

            // Case 2: Also try to delete from parsing_results (legacy)
            // This handles both legacy tasks (no taskId) and cleanup of old data
            console.log(`🗑️ Deleting from parsing_results table (task_name: ${taskName})...`);

            const { error: resultsError } = await this.supabase
                .from('parsing_results')
                .delete()
                .eq('task_name', taskName)
                .eq('user_id', this.currentUser?.id);

            if (resultsError) {
                console.warn('⚠️ Error deleting from parsing_results:', resultsError);
                // Don't throw - this table might not have data
            } else {
                deletedFromResults = true;
                console.log('✅ Successfully deleted from parsing_results');
            }

            // Invalidate cache to refresh UI
            this.invalidateCache('task_history');
            this.invalidateCache('parsing_results');
            this.invalidateCache('contacts_data');
            console.log('🔄 Cache invalidated after deletion');

            // Refresh history display
            await this.loadHistoryData();

            // Show success message
            if (deletedFromTasks || deletedFromResults) {
                this.showSuccess(`Задача "${taskName}" успешно удалена`);
            } else {
                this.showError('Задача не найдена в базе данных');
            }

        } catch (error) {
            console.error('❌ Error deleting task:', error);
            this.showError('Ошибка при удалении задачи');
        }
    }

    // Load contacts data with cache-first strategy
    async loadContactsData() {
        console.log('📞 loadContactsData() called with cache-first strategy');
        const container = document.getElementById('contactsEmpty');
        if (!container) {
            console.log('❌ Missing contacts container');
            return;
        }

        // STEP 1: Try to load from cache first (instant display)
        const cachedContactsData = this.getCacheData('contacts_data');
        if (cachedContactsData && cachedContactsData.length > 0) {
            console.log('⚡ Displaying cached contacts data instantly...');
            this.displayContacts(cachedContactsData, container);
        } else {
            // Show loading only if no cache available
            container.innerHTML = '<div class="loading">Загрузка контактов...</div>';
        }

        // STEP 2: Start background sync with Supabase
        this.syncContactsDataInBackground(container, cachedContactsData);
    }

    // Background sync for contacts data
    async syncContactsDataInBackground(container, cachedData) {
        try {
            console.log('🔄 Starting background sync for contacts data...');

            // Wait for Supabase client to be ready
            if (!this.supabase) {
                console.log('⏳ Waiting for Supabase client to initialize for contacts sync...');
                
                let attempts = 0;
                while (!this.supabase && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (!this.supabase) {
                    console.log('❌ Supabase client not ready - contacts background sync failed');
                    if (!cachedData || cachedData.length === 0) {
                        container.innerHTML = '<div class="error">Не удалось подключиться к базе данных</div>';
                    }
                    return;
                }
            }

            // Get Supabase auth user ID
            const supabaseUserId = (await this.supabase.auth.getUser()).data.user?.id;

            // Load contacts from parsing_results table (new system)
            console.log('🔍 Background sync loading contacts from parsing_results table...');
            const { data: contacts, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .eq('user_id', supabaseUserId)
                .order('created_at', { ascending: false })
                .limit(500);

            console.log('📊 Background contacts sync result:', { data: contacts?.length, error: error });

            if (error) throw error;

            let freshContactsData = [];
            if (contacts && contacts.length > 0) {
                console.log(`🔄 Background sync found ${contacts.length} contacts from parsing_results`);

                // Filter contacts that have email
                const contactsWithInfo = contacts.filter(contact =>
                    (contact.email && contact.email.trim() !== '')
                );

                console.log(`📧 Background sync: ${contactsWithInfo.length} contacts with email`);

                if (contactsWithInfo.length > 0) {
                    // Normalize contact data from parsing_results schema
                    freshContactsData = contactsWithInfo.map(contact => ({
                        organization_name: contact.organization_name || 'Неизвестная организация',
                        email: contact.email || '',
                        description: contact.description || 'Описание отсутствует',
                        website: contact.website || contact.source_url || '',
                        country: contact.country || 'Не определено',
                        task_name: contact.task_name,
                        parsing_timestamp: contact.parsing_timestamp || contact.created_at
                    }));
                }
            }

            // Fallback: Try loading from parsing_tasks.final_results for old data
            if (freshContactsData.length === 0) {
                console.log('🔄 No contacts in parsing_results, trying parsing_tasks.final_results fallback...');

                const { data: tasks, error: tasksError } = await this.supabase
                    .from('parsing_tasks')
                    .select('final_results, task_data, created_at')
                    .eq('user_id', supabaseUserId)
                    .eq('status', 'completed')
                    .not('final_results', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (tasksError) {
                    console.error('❌ Error loading from parsing_tasks fallback:', tasksError);
                    console.log('⚠️ Fallback failed - this is expected if all tasks are in parsing_results table');
                }

                if (!tasksError && tasks && tasks.length > 0) {
                    console.log(`📜 Fallback: found ${tasks.length} completed tasks in parsing_tasks`);

                    const allContacts = [];
                    tasks.forEach(task => {
                        let results = task.final_results;

                        // Handle nested structure
                        if (results && results.results && Array.isArray(results.results)) {
                            results = results.results;
                        }

                        if (Array.isArray(results)) {
                            results.forEach(result => {
                                if (result.email && result.email.trim() !== '') {
                                    allContacts.push({
                                        organization_name: result.organizationName || result.organization_name || 'Неизвестная организация',
                                        email: result.email,
                                        description: result.description || 'Описание отсутствует',
                                        website: result.website || result.url || '',
                                        country: result.country || 'Не определено',
                                        task_name: (task.task_data && task.task_data.taskName) || 'Неизвестная задача',
                                        parsing_timestamp: task.created_at
                                    });
                                }
                            });
                        }
                    });

                    if (allContacts.length > 0) {
                        console.log(`📜 Fallback: extracted ${allContacts.length} contacts from parsing_tasks`);
                        freshContactsData = allContacts;
                    }
                }
            }

            // Check if we need to update the UI
            const needsUpdate = this.shouldUpdateContactsUI(cachedData, freshContactsData);
            
            if (needsUpdate) {
                console.log('🔄 Fresh contacts data differs from cache - updating UI...');
                
                if (freshContactsData.length > 0) {
                    this.displayContacts(freshContactsData, container);
                } else {
                    container.innerHTML = '<div class="empty-state">Контакты не найдены</div>';
                }
            } else {
                console.log('✅ Contacts cache is up to date - no UI update needed');
            }

            // Always update cache with fresh data
            if (freshContactsData) {
                this.setCacheData('contacts_data', freshContactsData);
            }

        } catch (error) {
            console.error('❌ Background contacts sync error:', error);
            // Don't update UI if there was an error and we have cached data
            if (!cachedData || cachedData.length === 0) {
                container.innerHTML = '<div class="error">Ошибка загрузки контактов</div>';
            }
        }
    }

    // Check if contacts UI needs to be updated
    shouldUpdateContactsUI(cachedData, freshData) {
        // If no cached data, always update
        if (!cachedData || cachedData.length === 0) {
            return true;
        }

        // If no fresh data, update if cache had data
        if (!freshData || freshData.length === 0) {
            return cachedData.length > 0;
        }

        // Check if array lengths differ
        if (cachedData.length !== freshData.length) {
            return true;
        }

        // Compare first item's organization name and email for quick check
        if (cachedData.length > 0 && freshData.length > 0) {
            const cachedFirst = cachedData[0];
            const freshFirst = freshData[0];
            
            if (cachedFirst.id !== freshFirst.id || 
                cachedFirst.organization_name !== freshFirst.organization_name ||
                cachedFirst.email !== freshFirst.email) {
                return true;
            }
        }

        return false;
    }

    // Display results in specified container
    displayResults(results, container, type) {
        const table = document.createElement('table');
        table.className = 'results-table';
        
        // Create header
        const header = document.createElement('thead');
        header.innerHTML = `
            <tr>
                <th>Организация</th>
                <th>Email</th>
                <th>Описание</th>
                <th>Сайт</th>
                <th>Страна</th>
                <th>Дата</th>
            </tr>
        `;
        table.appendChild(header);
        
        // Create body
        const body = document.createElement('tbody');
        results.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.organization_name || 'N/A'}</td>
                <td>${result.email || 'N/A'}</td>
                <td>${result.description ? (result.description.length > 50 ? result.description.substring(0, 50) + '...' : result.description) : 'N/A'}</td>
                <td>${result.website ? `<a href="${result.website}" target="_blank">${result.website}</a>` : 'N/A'}</td>
                <td>${result.country || 'N/A'}</td>
                <td>${new Date(result.created_at).toLocaleDateString()}</td>
            `;
            body.appendChild(row);
        });
        table.appendChild(body);
        
        container.innerHTML = '';
        container.appendChild(table);
    }

    // Display history - Exact replica of user's original design
    displayHistory(history, container) {
        const table = document.createElement('table');
        table.className = 'history-table';
        
        // Create header exactly like user's screenshot
        const header = document.createElement('thead');
        header.innerHTML = `
            <tr>
                <th>Дата</th>
                <th>Тип парсинга</th>
                <th>Название задачи</th>
                <th>Поисковый запрос</th>
                <th>Найдено</th>
                <th>С контактами</th>
                <th>Действия</th>
            </tr>
        `;
        table.appendChild(header);
        
        // Create body
        const body = document.createElement('tbody');
        history.forEach(task => {
            const row = document.createElement('tr');
            
            // Format date and time like in screenshot (10.09.2025 12:16:55)
            const dateObj = new Date(task.latest_date);
            const formattedDate = dateObj.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });
            const formattedTime = dateObj.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Determine task type display name
            const taskTypeDisplay = task.task_type === 'ai-search' ? 'AI Поиск' : 'По URL';

            row.innerHTML = `
                <td class="date-cell">${formattedDate}<br>${formattedTime}</td>
                <td class="type-cell">${taskTypeDisplay}</td>
                <td class="task-name-cell">${task.task_name || 'Без названия'}</td>
                <td class="query-cell">${task.search_query || 'Не указан'}</td>
                <td class="count-cell">${task.total_results || 0}</td>
                <td class="contacts-cell">${task.contacts_count || 0}</td>
                <td class="actions-cell">
                    <button class="btn-eye-original" onclick="platform.viewTaskResults('${task.task_name}', '${task.task_id || ''}')" title="Посмотреть результаты">👁</button>
                    <button class="btn-delete" onclick="platform.deleteTask('${task.task_name}', '${task.task_id || ''}')" title="Удалить задачу">🗑️</button>
                </td>
            `;
            body.appendChild(row);
        });
        table.appendChild(body);
        
        container.innerHTML = '';
        container.appendChild(table);
    }

    // Display contacts - Exact replica of user's original design
    displayContacts(contacts, container) {
        const table = document.createElement('table');
        table.className = 'contacts-table';
        
        // Create header with sorting button for date column
        const header = document.createElement('thead');
        header.innerHTML = `
            <tr>
                <th>Название организации</th>
                <th>Email</th>
                <th>Описание</th>
                <th>Веб-сайт</th>
                <th>Страна</th>
                <th class="sortable-header" data-sort="date">
                    Дата добавления 
                    <span class="sort-icon" id="dateSortIcon">${this.dateSortDirection === 'desc' ? '↓' : '↑'}</span>
                </th>
            </tr>
        `;
        table.appendChild(header);
        
        // Add click handler for date column sorting
        const dateHeader = header.querySelector('[data-sort="date"]');
        if (dateHeader) {
            dateHeader.style.cursor = 'pointer';
            dateHeader.addEventListener('click', () => {
                this.toggleDateSort();
                // Re-display contacts with new sorting
                this.displayContacts(this.lastContactsData || contacts, container);
            });
        }
        
        // 📅 Sort contacts by date before displaying
        const sortedContacts = this.sortContactsByDate([...contacts], this.dateSortDirection);
        
        // Store sorted contacts for re-sorting
        this.lastContactsData = sortedContacts;
        
        // Create body
        const body = document.createElement('tbody');
        sortedContacts.forEach(contact => {
            const row = document.createElement('tr');
            
            // Format date like in screenshot (10.09.25)
            const dateObj = new Date(contact.parsing_timestamp || contact.created_at || new Date());
            const shortDate = dateObj.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            });
            
            row.innerHTML = `
                <td class="org-name-cell">${contact.organization_name || 'Неизвестная организация'}</td>
                <td class="email-cell">
                    ${contact.email ? `<a href="mailto:${contact.email}" class="email-link">${contact.email}</a>` : 'Не определен'}
                </td>
                <td class="description-cell">${contact.description || 'Описание отсутствует'}</td>
                <td class="website-cell">
                    ${contact.website ? `<a href="${contact.website}" target="_blank" class="website-link">${contact.website}</a>` : 'Не определен'}
                </td>
                <td class="country-cell">${contact.country || 'Не определена'}</td>
                <td class="date-cell">${shortDate}</td>
            `;
            
            // Add click handler for contact row
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                // Don't trigger for link clicks
                if (e.target.tagName === 'A') return;
                this.showContactMenu(contact, e);
            });
            
            body.appendChild(row);
        });
        table.appendChild(body);
        
        container.innerHTML = '';
        container.appendChild(table);
    }

    // Show contact menu (context menu with edit/delete options)
    showContactMenu(contact, event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Remove any existing menu
        this.hideContactMenu();
        
        // Create menu container
        const menu = document.createElement('div');
        menu.className = 'contact-context-menu';
        menu.style.position = 'absolute';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.style.zIndex = '1000';
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'context-menu-btn edit-btn';
        editBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Редактировать
        `;
        editBtn.addEventListener('click', () => {
            console.log('🖱️ Edit button clicked for contact:', contact);
            try {
                this.editContact(contact);
                this.hideContactMenu();
            } catch (error) {
                console.error('❌ Error in edit button handler:', error);
                alert('Ошибка при редактировании контакта: ' + error.message);
            }
        });
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'context-menu-btn delete-btn';
        deleteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Удалить
        `;
        deleteBtn.addEventListener('click', () => {
            this.deleteContact(contact);
            this.hideContactMenu();
        });
        
        menu.appendChild(editBtn);
        menu.appendChild(deleteBtn);
        document.body.appendChild(menu);
        
        // Hide menu on outside click
        setTimeout(() => {
            document.addEventListener('click', this.hideContactMenu.bind(this));
        }, 10);
    }

    // Hide contact menu
    hideContactMenu() {
        const menu = document.querySelector('.contact-context-menu');
        if (menu) {
            menu.remove();
        }
        document.removeEventListener('click', this.hideContactMenu.bind(this));
    }

    // Edit contact - opens modal with contact data
    editContact(contact) {
        console.log('✏️ Editing contact:', contact);
        this.showEditContactModal(contact);
    }

    // Show edit contact modal - modal window for editing contact with Supabase integration
    showEditContactModal(contact) {
        console.log('🖼️ Showing edit contact modal for:', contact);
        
        // Remove any existing modal
        const existingModal = document.querySelector('.edit-contact-modal');
        if (existingModal) existingModal.remove();
        
        // Create modal overlay (EXACT COPY OF RESULTS MODAL)
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay edit-contact-modal';
        
        // COMPLETELY TRANSPARENT OVERLAY - EXACT COPY OF RESULTS MODAL
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            z-index: 10000 !important;
            display: block !important;
            pointer-events: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
        `;
        
        // Create modal content (EXACT COPY OF RESULTS MODAL STRUCTURE)
        const modal = document.createElement('div');
        modal.className = 'modal-content edit-contact-modal-content';
        
        // EXACT MODAL DESIGN - COPY OF RESULTS MODAL
        modal.style.cssText = `
            position: fixed !important;
            top: 50vh !important;
            left: 50vw !important;
            transform: translate(-50%, -50%) !important;
            width: auto !important;
            height: auto !important;
            min-width: 600px !important;
            max-width: 600px !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 10001 !important;
            border: none !important;
            outline: none !important;
            animation: none !important;
            transition: none !important;
            background: white !important;
            border-radius: 12px !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
        `;
        
        // Modal header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h3>Редактировать контакт</h3>
            <button class="modal-close" onclick="this.closest('.edit-contact-modal').remove()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;
        
        // Modal body with form - ULTRA COMPACT
        const body = document.createElement('div');
        body.className = 'modal-body edit-contact-modal-body';
        body.style.padding = '1rem';
        
        const form = document.createElement('form');
        form.className = 'edit-contact-form';
        form.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 0.05rem;
        `;
        form.innerHTML = `
            <div class="form-row" style="display: flex; gap: 0.5rem;">
                <div class="form-group" style="flex: 1;">
                    <label for="edit-organization-name" style="display: block; margin-bottom: 0.1rem; font-weight: 500; color: #374151; text-shadow: none; font-size: 13px;">Название организации</label>
                    <input type="text" id="edit-organization-name" value="${contact.organization_name || ''}" required style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; transition: border-color 0.2s;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'">
                </div>
            </div>
            
            <div class="form-row" style="display: flex; gap: 0.5rem;">
                <div class="form-group" style="flex: 1;">
                    <label for="edit-email" style="display: block; margin-bottom: 0.1rem; font-weight: 500; color: #374151; text-shadow: none; font-size: 13px;">Email</label>
                    <input type="email" id="edit-email" value="${contact.email || ''}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; transition: border-color 0.2s;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label for="edit-website" style="display: block; margin-bottom: 0.1rem; font-weight: 500; color: #374151; text-shadow: none; font-size: 13px;">Веб-сайт</label>
                    <input type="url" id="edit-website" value="${contact.website || ''}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; transition: border-color 0.2s;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'">
                </div>
            </div>
            
            <div class="form-row" style="display: flex; gap: 0.5rem;">
                <div class="form-group" style="flex: 1;">
                    <label for="edit-country" style="display: block; margin-bottom: 0.1rem; font-weight: 500; color: #374151; text-shadow: none; font-size: 13px;">Страна</label>
                    <input type="text" id="edit-country" value="${contact.country || ''}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; transition: border-color 0.2s;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'">
                </div>
            </div>
            
            <div class="form-row" style="display: flex; gap: 0.5rem;">
                <div class="form-group full-width" style="flex: 1;">
                    <label for="edit-description" style="display: block; margin-bottom: 0.1rem; font-weight: 500; color: #374151; text-shadow: none; font-size: 13px;">Описание</label>
                    <textarea id="edit-description" rows="2" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; resize: vertical; transition: border-color 0.2s;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#d1d5db'">${contact.description || ''}</textarea>
                </div>
            </div>
        `;
        
        body.appendChild(form);
        
        // Modal footer with buttons - PLATFORM STYLE BUTTONS
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.style.cssText = `
            padding: 1rem 1.5rem;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            background: #f8f9fa;
            border-radius: 0 0 12px 12px;
        `;
        footer.innerHTML = `
            <button type="button" class="btn-primary save-contact-btn" style="
                background: #6366f1;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                min-width: 140px;
                transition: background-color 0.2s;
            " onmouseover="this.style.background='#5855eb'" onmouseout="this.style.background='#6366f1'">Сохранить изменения</button>
            <button type="button" class="btn-secondary" onclick="this.closest('.edit-contact-modal').remove()" style="
                background: #6b7280;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                min-width: 100px;
                transition: background-color 0.2s;
            " onmouseover="this.style.background='#5b6471'" onmouseout="this.style.background='#6b7280'">Отмена</button>
        `;
        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // NO VISIBILITY MANIPULATION - SAME AS RESULTS MODAL
        
        // Add save functionality
        const saveBtn = footer.querySelector('.save-contact-btn');
        saveBtn.addEventListener('click', () => {
            this.saveContactChanges(contact.id, overlay);
        });
        
        // Close modal on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('edit-organization-name').focus();
        }, 100);
    }

    // Save contact changes to Supabase
    async saveContactChanges(contactId, modalOverlay) {
        console.log('💾 Saving contact changes for ID:', contactId);
        
        try {
            // Get form data
            const organizationName = document.getElementById('edit-organization-name').value.trim();
            const email = document.getElementById('edit-email').value.trim();
            const website = document.getElementById('edit-website').value.trim();
            const country = document.getElementById('edit-country').value.trim();
            const description = document.getElementById('edit-description').value.trim();
            
            if (!organizationName) {
                alert('Название организации обязательно для заполнения');
                return;
            }
            
            if (!this.supabase) {
                console.error('❌ Supabase client not initialized');
                alert('Ошибка подключения к базе данных');
                return;
            }
            
            // Update contact in Supabase
            const { data, error } = await this.supabase
                .from('parsing_results')
                .update({
                    organization_name: organizationName,
                    email: email || null,
                    website: website || null,
                    country: country || null,
                    description: description || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', contactId)
                .select();
            
            if (error) throw error;
            
            console.log('✅ Contact updated successfully:', data);
            
            // Invalidate cache to ensure fresh data
            this.invalidateCache('parsing_results');
            this.invalidateCache('task_history');
            this.invalidateCache('contacts_data');
            
            // Close modal
            modalOverlay.remove();
            
            // Refresh the contacts list
            this.loadContactsData();
            
            // Show success message
            alert('Контакт успешно обновлен');
            
        } catch (error) {
            console.error('❌ Error saving contact changes:', error);
            alert('Ошибка при сохранении изменений');
        }
    }

    // Delete contact - confirms and removes from Supabase
    async deleteContact(contact) {
        console.log('🗑️ Deleting contact:', contact);
        
        const confirmed = confirm(`Вы уверены, что хотите удалить контакт "${contact.organization_name || 'Unknown'}"?`);
        if (!confirmed) return;
        
        try {
            if (!this.supabase) {
                console.error('❌ Supabase client not initialized');
                return;
            }

            // Delete from Supabase
            const { error } = await this.supabase
                .from('parsing_results')
                .delete()
                .eq('id', contact.id);

            if (error) throw error;

            console.log('✅ Contact deleted successfully');
            
            // Invalidate cache to ensure fresh data
            this.invalidateCache('parsing_results');
            this.invalidateCache('task_history');
            this.invalidateCache('contacts_data');
            
            // Refresh the contacts list
            this.loadContactsData();
            
        } catch (error) {
            console.error('❌ Error deleting contact:', error);
            alert('Ошибка при удалении контакта');
        }
    }

    // ❌ REMOVED: Duplicate viewTaskResults() method that was overriding the correct implementation
    // The correct viewTaskResults(taskName, taskId) is at line 1299 with proper parsing_tasks support
    // This old method only loaded from parsing_results and caused wrong data to display

    // Show task menu - context menu for task actions
    showTaskMenu(taskName) {
        console.log('📋 Showing task menu for:', taskName);
        // TODO: Implement task menu (export, delete task, etc.)
        alert(`Меню задачи: ${taskName}`);
    }

    // Show results modal - displays parsing results in modal window
    showResultsModal(taskName, results) {
        console.log('🖼️ Showing results modal for task:', taskName, 'with', results.length, 'results');
        console.log('📊 First result structure:', results[0]);

        // Remove any existing modal
        const existingModal = document.querySelector('.results-modal');
        if (existingModal) existingModal.remove();
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay results-modal';
        
        // COMPLETELY TRANSPARENT OVERLAY - NO VISUAL EFFECTS
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            z-index: 10000 !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            outline: none !important;
            animation: none !important;
            transition: none !important;
            box-shadow: none !important;
            opacity: 1 !important;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'modal-content results-modal-content';
        
        // SIMPLE MODAL DESIGN - CLEAN AND CENTERED
        modal.style.cssText = `
            position: fixed !important;
            top: 50vh !important;
            left: 50vw !important;
            transform: translate(-50%, -50%) !important;
            width: auto !important;
            height: auto !important;
            min-width: 700px !important;
            max-width: 80vw !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 10001 !important;
            border: none !important;
            outline: none !important;
            animation: none !important;
            transition: none !important;
            display: flex !important;
            flex-direction: column !important;
            
            background: white !important;
            border-radius: 12px !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
        `;
        
        // Modal header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h3>Результаты парсинга: ${taskName}</h3>
            <button class="modal-close" onclick="this.closest('.results-modal').remove()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;
        
        // Modal body with results table
        const body = document.createElement('div');
        body.className = 'modal-body results-modal-body';
        
        const table = document.createElement('table');
        table.className = 'results-modal-table';
        
        // Table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Название организации</th>
                <th>Email</th>
                <th>Описание</th>
                <th>Веб-сайт</th>
                <th>Страна</th>
                <th>Дата добавления</th>
            </tr>
        `;
        
        // Table body with results
        const tbody = document.createElement('tbody');
        results.forEach(result => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(result.parsing_timestamp).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            row.innerHTML = `
                <td>${result.organization_name || 'Не указано'}</td>
                <td>${result.email || 'Не указан'}</td>
                <td title="${result.description || ''}">${result.description ? (result.description.length > 50 ? result.description.substring(0, 50) + '...' : result.description) : 'Не указано'}</td>
                <td>${result.website ? `<a href="${result.website}" target="_blank">${result.website}</a>` : 'Не указан'}</td>
                <td>${result.country || 'Не указана'}</td>
                <td>${formattedDate}</td>
            `;
            tbody.appendChild(row);
        });
        
        table.appendChild(thead);
        table.appendChild(tbody);
        body.appendChild(table);
        
        // Modal footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.innerHTML = `
            <div class="results-count">Найдено результатов: ${results.length}</div>
            <button class="btn-secondary" onclick="this.closest('.results-modal').remove()">Закрыть</button>
        `;
        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        
        // Add modal to overlay
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Close modal on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // View session results
    async viewSessionResults(sessionId) {
        try {
            if (!this.supabase) return;

            console.log('🔍 Loading session results for:', sessionId);

            // Extract search query and hour from synthetic session ID
            // sessionId format: "session_SearchQuery_YYYY-MM-DDTHH" or just the original ID
            let searchQuery = 'Unknown';
            let hourKey = '';
            
            if (sessionId.startsWith('session_')) {
                const parts = sessionId.replace('session_', '').split('_');
                if (parts.length >= 2) {
                    searchQuery = parts.slice(0, -1).join('_'); // Rejoin all parts except last as search query
                    hourKey = parts[parts.length - 1]; // Last part is hour key
                }
            }

            console.log('🔍 Searching for results with query:', searchQuery, 'and hour:', hourKey);

            // Get all parsing results and filter by the session criteria
            const { data: allResults, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter results to match the session criteria
            let sessionResults = [];
            if (allResults && allResults.length > 0) {
                sessionResults = allResults.filter(result => {
                    const resultQuery = result.search_query || result.query || 'Unknown';
                    const resultTimestamp = new Date(result.created_at);
                    const resultHourKey = resultTimestamp.toISOString().substring(0, 13);
                    
                    return (resultQuery === searchQuery && (hourKey === '' || resultHourKey === hourKey));
                });
            }

            console.log('🔍 Found session results:', sessionResults.length);

            if (sessionResults && sessionResults.length > 0) {
                this.viewResults(sessionResults);
            } else {
                this.showError('Результаты не найдены');
            }
        } catch (error) {
            console.error('❌ Error viewing session results:', error);
            this.showError('Ошибка загрузки результатов');
        }
    }

    // Copy contact info
    copyContact(email) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(email).then(() => {
                this.showSuccess('Email скопирован в буфер обмена');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = email;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('Email скопирован в буфер обмена');
        }
    }

    // Bind parsing form
    bindParsingForm() {
        const form = document.getElementById('parsingForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const taskName = document.getElementById('taskName').value.trim();
            const searchQuery = document.getElementById('searchQuery').value.trim();

            if (!taskName) {
                this.showError('Введите название задачи');
                return;
            }

            if (!searchQuery) {
                this.showError('Введите поисковый запрос');
                return;
            }

            // Проверка обязательного выбора категории
            const categoryId = document.getElementById('categorySelect')?.value ||
                             document.getElementById('urlCategorySelect')?.value;

            if (!categoryId) {
                this.showError('Выберите категорию перед началом парсинга');
                return;
            }

            await this.startParsing({ taskName, searchQuery, categoryId });
        });
    }

    // Bind URL parsing form
    bindUrlParsingForm() {
        const form = document.getElementById('urlParsingForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const taskName = document.getElementById('url-task-name').value.trim();
            const websiteUrl = document.getElementById('url-website').value.trim();
            const categoryId = document.getElementById('urlCategorySelect')?.value;

            if (!taskName) {
                this.showError('Введите название задачи');
                return;
            }

            if (!websiteUrl) {
                this.showError('Введите URL сайта');
                return;
            }

            if (!categoryId) {
                this.showError('Выберите категорию перед началом парсинга');
                return;
            }

            // Validate URL format
            try {
                new URL(websiteUrl);
            } catch (error) {
                this.showError('Введите корректный URL (например: https://example.com)');
                return;
            }

            await this.startUrlParsing({ taskName, websiteUrl, categoryId });
        });
    }

    // Bind tab buttons (AI search and URL parsing)
    bindTabButtons() {
        const tabButtons = document.querySelectorAll('.tab-button');
        console.log(`🔗 Found ${tabButtons.length} tab buttons`);
        
        tabButtons.forEach((button, index) => {
            const tabName = button.dataset.tab;
            console.log(`🔗 Binding tab button ${index}: ${button.textContent.trim()} (${tabName})`);
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`🔗 Tab clicked: ${tabName}`);
                this.switchTab(tabName);
            });
        });
    }

    // Switch between tabs
    switchTab(tabName) {
        console.log(`🔄 Switching to tab: ${tabName}`);

        // ✅ FIX: Reset progress bar ONLY if no active parsing
        // Don't reset during active parsing to preserve progress visibility
        if (!this.currentTaskId) {
            this.resetParsingUI();
            console.log('✅ UI reset - no active parsing');
        } else {
            console.log('⏸️ UI reset skipped - parsing in progress (taskId:', this.currentTaskId + ')');
        }

        // Clear search input when switching tabs
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            console.log('🔍 Search input cleared on tab switch');
        }

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked button
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            console.log(`✅ Tab button activated: ${tabName}`);
        }

        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show target tab content
        const targetContent = document.getElementById(`${tabName}-content`);
        if (targetContent) {
            targetContent.classList.add('active');
            console.log(`✅ Tab content shown: ${tabName}-content`);
        } else {
            console.log(`❌ Tab content not found: ${tabName}-content`);
        }

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    // Bind completion modal events
    bindCompletionModal() {
        console.log('🔗 Binding completion modal events...');
        
        // Bind "Go to Database" button
        const goToDatabaseBtn = document.getElementById('goToDatabaseBtn');
        if (goToDatabaseBtn) {
            goToDatabaseBtn.addEventListener('click', () => {
                console.log('🔗 Go to Database button clicked');
                // Hide the completion modal
                this.hideCompletionModal();
                // Switch to database section (contacts)
                this.showSection('database');
            });
            console.log('✅ Go to Database button bound');
        } else {
            console.log('❌ Go to Database button not found');
        }
        
        // Bind "Close" button
        const closeCompletionModalBtn = document.getElementById('closeCompletionModalBtn');
        if (closeCompletionModalBtn) {
            closeCompletionModalBtn.addEventListener('click', () => {
                console.log('🔗 Close completion modal button clicked');
                // Hide the completion modal
                this.hideCompletionModal();
            });
            console.log('✅ Close completion modal button bound');
        } else {
            console.log('❌ Close completion modal button not found');
        }
        
        // Bind click outside to close modal
        const modal = document.getElementById('parsingCompletionModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                // Close modal if clicked on overlay (not on modal content)
                if (e.target === modal) {
                    console.log('🔗 Completion modal overlay clicked - closing modal');
                    this.hideCompletionModal();
                }
            });
            console.log('✅ Completion modal overlay click bound');
        } else {
            console.log('❌ Completion modal not found');
        }
    }

    // Show completion modal
    showCompletionModal() {
        console.log('🎉 Showing completion modal...');
        const modal = document.getElementById('parsingCompletionModal');
        if (modal) {
            modal.classList.add('show');
            console.log('✅ Completion modal shown');
        } else {
            console.log('❌ Completion modal not found');
        }
    }

    // Hide completion modal  
    hideCompletionModal() {
        console.log('🔒 Hiding completion modal...');
        const modal = document.getElementById('parsingCompletionModal');
        if (modal) {
            modal.classList.remove('show');
            console.log('✅ Completion modal hidden');
        } else {
            console.log('❌ Completion modal not found');
        }
    }

    // Load tab-specific data
    async loadTabData(tabName) {
        try {
            console.log(`📊 Loading data for tab: ${tabName}`);
            switch (tabName) {
                case 'task-history':
                    await this.loadSectionData('history');
                    break;
                case 'contacts':
                    await this.loadSectionData('contacts');
                    break;
                default:
                    console.log(`No data loading required for tab: ${tabName}`);
                    break;
            }
        } catch (error) {
            console.error(`❌ Error loading tab data for ${tabName}:`, error);
        }
    }

    // Bind search input for context-aware filtering
    bindSearchInput() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) {
            console.log('❌ Search input not found');
            return;
        }

        console.log('🔗 Binding search input...');

        // Real-time search on input
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            console.log(`🔍 Search term: "${searchTerm}"`);

            // Determine current active tab
            const activeTab = document.querySelector('.database-tab.active');
            const currentTab = activeTab?.dataset?.tab || 'task-history';
            console.log(`📍 Current tab: ${currentTab}`);

            this.performSearch(searchTerm, currentTab);
        });

        console.log('✅ Search input bound');
    }

    // Perform context-aware search based on active tab
    performSearch(searchTerm, currentTab) {
        console.log(`🔎 Performing search: "${searchTerm}" in tab: ${currentTab}`);

        if (currentTab === 'task-history') {
            this.searchTaskHistory(searchTerm);
        } else if (currentTab === 'contacts') {
            this.searchContacts(searchTerm);
        }
    }

    // Search in task history table
    searchTaskHistory(searchTerm) {
        const table = document.querySelector('#historyEmpty .history-table');
        if (!table) {
            console.log('❌ Task history table not found');
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        let visibleCount = 0;

        rows.forEach(row => {
            // Get all cell values for searching
            const dateCell = row.querySelector('.date-cell')?.textContent?.toLowerCase() || '';
            const typeCell = row.querySelector('.type-cell')?.textContent?.toLowerCase() || '';
            const taskNameCell = row.querySelector('.task-name-cell')?.textContent?.toLowerCase() || '';
            const queryCell = row.querySelector('.query-cell')?.textContent?.toLowerCase() || '';
            const countCell = row.querySelector('.count-cell')?.textContent?.toLowerCase() || '';
            const contactsCell = row.querySelector('.contacts-cell')?.textContent?.toLowerCase() || '';

            // Combine all cell values for searching
            const rowText = `${dateCell} ${typeCell} ${taskNameCell} ${queryCell} ${countCell} ${contactsCell}`;

            // Show/hide row based on search match
            if (rowText.includes(searchTerm) || searchTerm === '') {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        console.log(`✅ Task history search: ${visibleCount}/${rows.length} rows visible`);
    }

    // Search in contacts table
    searchContacts(searchTerm) {
        const table = document.querySelector('#contactsEmpty .contacts-table');
        if (!table) {
            console.log('❌ Contacts table not found');
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        let visibleCount = 0;

        rows.forEach(row => {
            // Get all cell values for searching
            const orgNameCell = row.querySelector('.org-name-cell')?.textContent?.toLowerCase() || '';
            const emailCell = row.querySelector('.email-cell')?.textContent?.toLowerCase() || '';
            const descriptionCell = row.querySelector('.description-cell')?.textContent?.toLowerCase() || '';
            const websiteCell = row.querySelector('.website-cell')?.textContent?.toLowerCase() || '';
            const countryCell = row.querySelector('.country-cell')?.textContent?.toLowerCase() || '';
            const dateCell = row.querySelector('.date-cell')?.textContent?.toLowerCase() || '';

            // Combine all cell values for searching
            const rowText = `${orgNameCell} ${emailCell} ${descriptionCell} ${websiteCell} ${countryCell} ${dateCell}`;

            // Show/hide row based on search match
            if (rowText.includes(searchTerm) || searchTerm === '') {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        console.log(`✅ Contacts search: ${visibleCount}/${rows.length} rows visible`);
    }

    // Bind logout button (already bound in bindAuthEvents, this is redundant)
    bindLogoutButton() {
        // Removed duplicate logout binding to prevent conflicts
        console.log('🔗 Logout button already bound in bindAuthEvents()');
    }

    // CRITICAL FIX: Bind logout button specifically for dashboard
    bindLogoutButtonForDashboard() {
        console.log('🔗 Binding logout button for dashboard...');
        const logoutBtn = document.getElementById('logoutBtn');

        if (logoutBtn) {
            // Remove any existing event listeners to prevent duplicates
            logoutBtn.replaceWith(logoutBtn.cloneNode(true));
            const newLogoutBtn = document.getElementById('logoutBtn');

            newLogoutBtn.addEventListener('click', async () => {
                console.log('🔗 Logout button clicked!');
                await this.logout();
            });

            console.log('✅ Logout button bound successfully for dashboard');
        } else {
            console.error('❌ Logout button not found in DOM');
        }
    }

    // Bind Google OAuth button
    bindGoogleOAuth() {
        const connectGoogleBtn = document.getElementById('connectGoogleBtn');
        if (connectGoogleBtn) {
            console.log('🔗 Binding Google OAuth button');
            connectGoogleBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('🔗 Google OAuth button clicked');
                await this.handleGoogleConnect();
            });
        } else {
            console.log('❌ Google OAuth button not found');
        }
    }

    // Bind Categories Management
    bindCategoriesManagement() {
        console.log('🏷️ Binding categories management...');

        const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
        const categoriesModal = document.getElementById('categoriesModal');
        const closeCategoriesModal = document.getElementById('closeCategoriesModal');
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        const newCategoryName = document.getElementById('newCategoryName');

        if (!manageCategoriesBtn || !categoriesModal) {
            console.log('❌ Categories elements not found');
            return;
        }

        // Open modal from Database section
        manageCategoriesBtn.addEventListener('click', () => {
            console.log('🏷️ Opening categories modal from Database');
            categoriesModal.classList.add('active');
            this.loadCategories();
        });

        // Bind inline "Add Category" buttons in parsing forms
        const addCategoryInlineAI = document.getElementById('addCategoryInlineAI');
        const addCategoryInlineURL = document.getElementById('addCategoryInlineURL');

        if (addCategoryInlineAI) {
            addCategoryInlineAI.addEventListener('click', () => {
                console.log('🏷️ Opening categories modal from AI Search form');
                categoriesModal.classList.add('active');
                this.loadCategories();
            });
        }

        if (addCategoryInlineURL) {
            addCategoryInlineURL.addEventListener('click', () => {
                console.log('🏷️ Opening categories modal from URL Parsing form');
                categoriesModal.classList.add('active');
                this.loadCategories();
            });
        }

        // Close modal
        const closeModal = () => {
            console.log('🏷️ Closing categories modal');
            categoriesModal.classList.remove('active');
            if (newCategoryName) {
                newCategoryName.value = '';
            }
        };

        if (closeCategoriesModal) {
            console.log('✅ Close button found, binding click event');
            closeCategoriesModal.addEventListener('click', (e) => {
                console.log('🔴 Close button clicked!');
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            });
        } else {
            console.error('❌ Close button not found in DOM');
        }

        // Close on overlay click
        categoriesModal.addEventListener('click', (e) => {
            if (e.target === categoriesModal) {
                closeModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && categoriesModal.classList.contains('active')) {
                closeModal();
            }
        });

        // Add category
        if (addCategoryBtn && newCategoryName) {
            const handleAddCategory = async () => {
                const categoryName = newCategoryName.value.trim();
                if (!categoryName) {
                    this.showError('Введите название категории');
                    return;
                }

                try {
                    console.log('➕ Adding category:', categoryName);
                    await this.createCategory(categoryName);
                    newCategoryName.value = '';
                    await this.loadCategories();
                } catch (error) {
                    console.error('❌ Error adding category:', error);
                    this.showError('Ошибка создания категории: ' + error.message);
                }
            };

            addCategoryBtn.addEventListener('click', handleAddCategory);

            // Allow Enter key to submit
            newCategoryName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleAddCategory();
                }
            });
        }

        console.log('✅ Categories management bound');
    }

    // Load categories from database
    async loadCategories() {
        console.log('📋 Loading categories...');
        const categoriesList = document.getElementById('categoriesList');

        if (!categoriesList) {
            console.error('❌ Categories list element not found');
            return;
        }

        try {
            // Show loading state
            categoriesList.innerHTML = `
                <div class="categories-loading">
                    <div class="loading-spinner-small"></div>
                    <p>Загрузка категорий...</p>
                </div>
            `;

            const { data: categories, error } = await this.supabase
                .from('categories')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!categories || categories.length === 0) {
                categoriesList.innerHTML = `
                    <div class="categories-empty">
                        <p>У вас пока нет категорий. Создайте первую категорию выше.</p>
                    </div>
                `;
                return;
            }

            // Render categories
            categoriesList.innerHTML = categories.map(category => `
                <div class="category-item" data-category-id="${category.id}">
                    <span class="category-item-name">${this.escapeHtml(category.name)}</span>
                    <div class="category-item-actions">
                        <button class="category-delete-btn" data-category-id="${category.id}">
                            Удалить
                        </button>
                    </div>
                </div>
            `).join('');

            // Bind delete buttons
            categoriesList.querySelectorAll('.category-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.getAttribute('data-category-id');
                    await this.deleteCategory(categoryId);
                });
            });

            console.log(`✅ Loaded ${categories.length} categories`);

        } catch (error) {
            console.error('❌ Error loading categories:', error);
            categoriesList.innerHTML = `
                <div class="categories-empty">
                    <p style="color: #ef4444;">Ошибка загрузки категорий: ${error.message}</p>
                </div>
            `;
        }
    }

    // Load categories into parsing form selects
    async loadCategoriesIntoSelects() {
        console.log('🔄 Loading categories into parsing form selects...');

        const aiSelect = document.getElementById('categorySelect');
        const urlSelect = document.getElementById('urlCategorySelect');

        if (!aiSelect || !urlSelect) {
            console.log('❌ Category select elements not found');
            return;
        }

        if (!this.currentUser) {
            console.log('❌ No current user for loading categories');
            return;
        }

        try {
            const { data: categories, error } = await this.supabase
                .from('categories')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('name', { ascending: true });

            if (error) throw error;

            // Build options HTML
            let optionsHTML = '<option value="">Выберите категорию (опционально)</option>';
            if (categories && categories.length > 0) {
                optionsHTML += categories.map(cat =>
                    `<option value="${cat.id}">${this.escapeHtml(cat.name)}</option>`
                ).join('');
            }

            // Update both selects
            aiSelect.innerHTML = optionsHTML;
            urlSelect.innerHTML = optionsHTML;

            console.log(`✅ Loaded ${categories ? categories.length : 0} categories into selects`);

        } catch (error) {
            console.error('❌ Error loading categories into selects:', error);
            // Keep default option on error
            const defaultHTML = '<option value="">Выберите категорию (опционально)</option>';
            aiSelect.innerHTML = defaultHTML;
            urlSelect.innerHTML = defaultHTML;
        }
    }

    // Create new category
    async createCategory(name) {
        console.log('➕ Creating category:', name);

        if (!name || !name.trim()) {
            throw new Error('Название категории не может быть пустым');
        }

        if (!this.currentUser) {
            throw new Error('Пользователь не авторизован');
        }

        try {
            const { data, error } = await this.supabase
                .from('categories')
                .insert({
                    user_id: this.currentUser.id,
                    name: name.trim()
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Category created:', data);

            // Refresh parsing form selects after creating category
            await this.loadCategoriesIntoSelects();

            return data;

        } catch (error) {
            console.error('❌ Error creating category:', error);
            throw error;
        }
    }

    // Delete category
    async deleteCategory(categoryId) {
        console.log('🗑️ Deleting category:', categoryId);

        if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('categories')
                .delete()
                .eq('id', categoryId)
                .eq('user_id', this.currentUser.id);

            if (error) throw error;

            console.log('✅ Category deleted');

            // Refresh both modal and parsing form selects
            await this.loadCategories();
            await this.loadCategoriesIntoSelects();

        } catch (error) {
            console.error('❌ Error deleting category:', error);
            this.showError('Ошибка удаления категории: ' + error.message);
        }
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Bind email form validation and save functionality
    bindEmailForm() {
        console.log('📧 Binding email form validation...');
        
        const emailSubject = document.getElementById('emailSubject');
        const emailBody = document.getElementById('emailBody');
        const nextToStep2Btn = document.getElementById('nextToStep2');
        const emailAttachments = document.getElementById('emailAttachments');

        if (!emailSubject || !emailBody || !nextToStep2Btn) {
            console.log('❌ Email form elements not found');
            return;
        }

        // Initialize current campaign data storage
        this.currentEmailCampaign = {
            subject: '',
            body: '',
            attachments: []
        };

        // Enhanced validation function (now calls class method)
        const validateEmailForm = () => this.validateEmailForm();

        // Store DOM elements for class method access
        this.emailFormElements = {
            subject: emailSubject,
            body: emailBody,
            nextButton: nextToStep2Btn
        };

        // Bind input events for real-time validation
        emailSubject.addEventListener('input', validateEmailForm);
        emailBody.addEventListener('input', validateEmailForm);

        // File upload handling
        const fileDropZone = document.querySelector('.file-drop-zone');
        const attachmentsList = document.getElementById('attachmentsList');

        if (emailAttachments && fileDropZone && attachmentsList) {
            // Click to select files
            fileDropZone.addEventListener('click', () => {
                emailAttachments.click();
            });

            // Handle file selection
            emailAttachments.addEventListener('change', (e) => {
                this.handleEmailAttachments(e.target.files, attachmentsList);
            });

            // Drag and drop functionality
            fileDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDropZone.classList.add('dragover');
            });

            fileDropZone.addEventListener('dragleave', () => {
                fileDropZone.classList.remove('dragover');
            });

            fileDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                fileDropZone.classList.remove('dragover');
                this.handleEmailAttachments(e.dataTransfer.files, attachmentsList);
            });

        }

        // Bind "Next to Step 2" button
        nextToStep2Btn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('📧 Next to Step 2 button clicked');

            const validation = validateEmailForm();
            if (validation.isValid) {
                await this.saveEmailCampaignAndContinue();
            } else {
                this.showError(validation.errorMessage || 'Пожалуйста, заполните заголовок и текст письма');
            }
        });

        // Initial validation
        validateEmailForm();
    }

    // Enhanced email form validation as class method
    validateEmailForm() {
        if (!this.emailFormElements) return { isValid: false, errorMessage: 'Form not initialized' };

        const subject = this.emailFormElements.subject.value.trim();
        const body = this.emailFormElements.body.value.trim();
        const nextBtn = this.emailFormElements.nextButton;

        // Check if both required fields are filled
        const hasRequiredFields = subject.length > 0 && body.length > 0;

        // Check for files currently uploading
        const uploadingFiles = this.currentEmailCampaign.attachments.filter(file =>
            file.uploadStatus === 'uploading'
        );

        // Check for Google Drive files without proper permissions
        const googleDriveFiles = this.currentEmailCampaign.attachments.filter(file => file.needsPermissionSetup);
        const pendingPermissions = googleDriveFiles.filter(file => file.permissionStatus !== 'granted');

        // Determine validation status and error message
        let isValid = hasRequiredFields;
        let errorMessage = '';

        if (!hasRequiredFields) {
            errorMessage = 'Заполните заголовок и текст письма';
        } else if (uploadingFiles.length > 0) {
            isValid = false;
            errorMessage = `Подождите завершения загрузки файлов (${uploadingFiles.length} файл(ов))`;
        } else if (pendingPermissions.length > 0) {
            isValid = false;
            errorMessage = `Настройте разрешения для ${pendingPermissions.length} файл(ов) Google Drive`;
        }

        // Update button state
        if (nextBtn) {
            nextBtn.disabled = !isValid;
            if (!isValid && errorMessage) {
                nextBtn.title = errorMessage;
                nextBtn.style.opacity = '0.5';
            } else {
                nextBtn.title = '';
                nextBtn.style.opacity = '1';
            }
        }

        // Update campaign data
        if (this.currentEmailCampaign) {
            this.currentEmailCampaign.subject = subject;
            this.currentEmailCampaign.body = body;
        }

        console.log(`📧 Email form validation: ${isValid ? '✅ Valid' : '❌ Invalid'} ${errorMessage ? `- ${errorMessage}` : ''}`);

        return { isValid, errorMessage };
    }

    // Handle email attachments with immediate display + Google Drive integration  
    async handleEmailAttachments(files, attachmentsList) {
        console.log('📎 Processing email attachments:', files.length);
        console.log('🔍 FileManager status:', !!this.fileManager);
        console.log('🔍 GoogleDriveClient status:', !!this.googleDriveClient);
        
        if (!this.fileManager) {
            console.error('❌ FileManager not initialized');
            this.showToast('Система управления файлами не инициализирована', 'error');
            return;
        }

        // Keep existing attachments - just add new ones
        console.log(`📎 Adding ${files.length} new files to existing ${this.currentEmailCampaign.attachments.length} files`);
        
        // STEP 1: IMMEDIATE FILE DISPLAY (synchronous, non-blocking)
        console.log('🚀 STEP 1: Immediately showing files in UI');
        
        const fileInfoArray = [];
        const gmailLimit = 25 * 1024 * 1024; // 25MB
        let cumulativeSize = 0; // Track total size for Supabase attachments

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Dynamic routing logic based on cumulative size
            let isGoogleDriveFile = false;
            let forceGoogleDrive = false;

            if (file.size > gmailLimit) {
                // Large files always go to Google Drive
                isGoogleDriveFile = true;
            } else if (cumulativeSize + file.size > gmailLimit) {
                // File is small but cumulative size would exceed limit - force to Google Drive
                isGoogleDriveFile = true;
                forceGoogleDrive = true;
                console.log(`📊 File "${file.name}" (${this.formatFileSize(file.size)}) routed to Google Drive due to cumulative size: ${this.formatFileSize(cumulativeSize)} + ${this.formatFileSize(file.size)} > ${this.formatFileSize(gmailLimit)}`);
            } else {
                // File can go to Supabase - add to cumulative size
                cumulativeSize += file.size;
                console.log(`📊 File "${file.name}" (${this.formatFileSize(file.size)}) routed to Supabase. Cumulative size: ${this.formatFileSize(cumulativeSize)}/${this.formatFileSize(gmailLimit)}`);
            }
            
            // Create temporary file info for immediate display
            const tempFileInfo = {
                originalName: file.name,
                size: file.size,
                type: file.type,
                isGoogleDriveFile: isGoogleDriveFile,
                forceGoogleDrive: forceGoogleDrive, // Flag for cumulative size routing
                uploadStatus: isGoogleDriveFile ? 'uploading' : 'uploading',
                tempFile: file, // Keep reference for later upload
                driveUploadProgress: 0,
                supabaseUploadProgress: 0,
                // Set permission flags for Google Drive files immediately
                needsPermissionSetup: isGoogleDriveFile,
                permissionStatus: isGoogleDriveFile ? 'pending' : undefined
            };
            
            // Add to attachments array immediately
            this.currentEmailCampaign.attachments.push(tempFileInfo);
            const fileIndex = this.currentEmailCampaign.attachments.length - 1;
            
            // Show file in UI immediately with progress bar
            this.createAttachmentDisplayWithProgress(tempFileInfo, fileIndex, attachmentsList);
            
            fileInfoArray.push({ fileInfo: tempFileInfo, fileIndex, file });
            
            const routingReason = forceGoogleDrive ? 'Google Drive (cumulative size)' :
                                 isGoogleDriveFile ? 'Google Drive (large file)' : 'Supabase';
            console.log(`📁 File ${i + 1}/${files.length} displayed: ${file.name} → ${routingReason}`);
        }
        
        // Show attachments container immediately
        this.showAttachmentsContainer(attachmentsList);

        // Trigger validation immediately after adding files
        this.validateEmailForm();

        // STEP 2: Start background uploads (non-blocking)
        this.startBackgroundUploads(fileInfoArray, attachmentsList);
    }

    // Create attachment display with progress bar for immediate feedback
    createAttachmentDisplayWithProgress(fileInfo, index, attachmentsList) {
        console.log('🎨 createAttachmentDisplayWithProgress started');
        console.log('📋 Parameters:', {
            fileName: fileInfo.originalName,
            index,
            attachmentsList: !!attachmentsList,
            attachmentsListTag: attachmentsList?.tagName,
            attachmentsListParent: attachmentsList?.parentElement?.className
        });

        const attachmentItem = document.createElement('div');
        attachmentItem.className = 'attachment-item';
        attachmentItem.setAttribute('data-file-index', index);
        // Set data-file-path for consistency with createAttachmentDisplay
        if (fileInfo.filePath) {
            attachmentItem.setAttribute('data-file-path', fileInfo.filePath);
        }

        // Determine file icon and status - unified with createAttachmentDisplay logic
        let statusIcon = '📎'; // Default
        let statusClass = 'status-uploading';
        const isGoogleDriveFile = fileInfo.isGoogleDriveFile; // Use pre-calculated routing decision

        // Use same logic as createAttachmentDisplay for consistency
        if (fileInfo.driveFileId) {
            statusIcon = '☁️';
            statusClass = 'status-drive-completed';
        } else if (isGoogleDriveFile) { // Gmail limit - Google Drive files
            statusIcon = '☁️';
            statusClass = 'status-cloud';
            // Set permission flags for consistency
            if (!fileInfo.hasOwnProperty('needsPermissionSetup')) {
                fileInfo.needsPermissionSetup = true;
                fileInfo.permissionStatus = 'pending';
            }
        }

        // File type detection for better display
        const fileExtension = fileInfo.originalName.split('.').pop()?.toLowerCase();
        const fileTypeClass = this.getFileTypeClass(fileExtension);

        // Upload info removed per user request - no timestamps shown

        // Create Google Drive button if needed - unified with createAttachmentDisplay logic
        let googleDriveButton = '';
        if (isGoogleDriveFile || fileInfo.needsPermissionSetup) {
            const isPermissionGranted = fileInfo.permissionStatus === 'granted';
            const warningIcon = isPermissionGranted ? '✓' : '❗';
            const buttonClass = isPermissionGranted ? 'google-drive-button drive-completed' : 'google-drive-button';
            const buttonStyle = isPermissionGranted ?
                'background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: 1px solid #28a745;' : '';

            googleDriveButton = `<button type="button" class="${buttonClass}" data-index="${index}" title="Управление разрешениями Google Drive" style="${buttonStyle}">
                <span class="drive-text">Google Drive</span>
                <span class="drive-warning" style="${isPermissionGranted ? 'color: white; font-size: 16px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.3);' : ''}">${warningIcon}</span>
            </button>`;
        }

        attachmentItem.innerHTML = `
            <div class="attachment-info">
                <span class="attachment-icon ${statusClass}" title="${this.getStatusTitle(statusClass)}">${statusIcon}</span>
                <div class="attachment-details">
                    <span class="attachment-name ${fileTypeClass}" title="${fileInfo.originalName}">${fileInfo.originalName}</span>
                    <div class="attachment-meta">
                        <span class="attachment-size">${this.formatFileSize(fileInfo.size)}</span>
                    </div>
                    <div class="upload-progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <span class="progress-text">0%</span>
                    </div>
                </div>
            </div>
            <div class="attachment-actions">
                ${googleDriveButton}
                <button type="button" class="remove-attachment" data-index="${index}" title="Удалить">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" transform="rotate(45 12 12)"/>
                    </svg>
                </button>
            </div>
        `;

        // Bind remove button
        const removeBtn = attachmentItem.querySelector('.remove-attachment');
        removeBtn.addEventListener('click', () => {
            this.removeEmailAttachment(index, attachmentsList);
        });

        // Bind Google Drive permissions management - unified with createAttachmentDisplay logic
        const googleDriveBtn = attachmentItem.querySelector('.google-drive-button');
        if (googleDriveBtn) {
            googleDriveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('🔧 Google Drive button clicked for file:', fileInfo.originalName);

                // Check if file has driveFileId (already uploaded)
                if (fileInfo.driveFileId) {
                    this.showDrivePermissionsModal(fileInfo.driveFileId, index);
                } else if (fileInfo.uploadStatus === 'uploading') {
                    this.showToast('❗ Дождитесь завершения загрузки для настройки разрешений', 'warning');
                } else {
                    this.showToast('❗ Файл еще не загружен на Google Drive', 'warning');
                }
            });
        }

        console.log('📦 Appending attachment item to list...', {
            attachmentItem: !!attachmentItem,
            attachmentsList: !!attachmentsList,
            innerHTML: attachmentItem.innerHTML.substring(0, 100) + '...'
        });
        
        attachmentsList.appendChild(attachmentItem);
        
        console.log('✅ File displayed immediately:', fileInfo.originalName);
        console.log('📊 Current attachments list state:', {
            childrenCount: attachmentsList.children.length,
            visible: attachmentsList.style.display !== 'none',
            parentVisible: attachmentsList.parentElement?.style.display !== 'none'
        });
        
        // Force display update
        attachmentsList.style.display = 'block';
        attachmentsList.style.visibility = 'visible';
        
        // Force parent container to be visible
        const attachmentsContainer = attachmentsList.closest('.attachments-container');
        if (attachmentsContainer) {
            attachmentsContainer.style.display = 'block';
            console.log('📋 Forced attachments container visibility');
        }
    }

    // Start background uploads (non-blocking)
    async startBackgroundUploads(fileInfoArray, attachmentsList) {
        console.log('🚀 Starting background uploads for', fileInfoArray.length, 'files');
        
        // Basic validation for critical errors only
        const files = fileInfoArray.map(item => item.file);
        const validation = this.fileManager.validateFiles(files);
        if (validation.errors && validation.errors.length > 0) {
            // Only show critical errors (not size-related ones)
            const criticalErrors = validation.errors.filter(error => 
                !error.includes('превышает лимит') && !error.includes('слишком большой')
            );
            if (criticalErrors.length > 0) {
                this.showToast(`Внимание: ${criticalErrors.join(', ')}`, 'warning');
            }
        }
        
        try {
            // Start all uploads in parallel
            const uploadPromises = fileInfoArray.map(async (item) => {
                const { fileInfo, fileIndex, file } = item;
                
                try {
                    // Update progress to show upload started
                    this.updateFileProgress(fileIndex, 5, 'Начинаем загрузку...');
                    
                    // For Google Drive files (large files OR routed due to cumulative size), upload ONLY to Google Drive
                    if (fileInfo.isGoogleDriveFile && this.googleDriveClient) {
                        console.log(`📤 Starting Google Drive upload for ${file.name}`);
                        await this.startGoogleDriveUpload(file, fileIndex, fileInfo);
                        // Do NOT upload to Supabase for Google Drive files
                        return;
                    }
                    
                    // Upload to Supabase Storage (ONLY for files routed to Supabase based on cumulative size)
                    const uploadResult = await this.fileManager.uploadFiles([file], {
                        folderPath: `email-campaigns/${Date.now()}`,
                        getPublicUrl: false,
                        onProgress: (progress) => {
                            this.updateFileProgress(fileIndex, progress, 'Загружаем в хранилище...');
                        }
                    });
                    
                    if (uploadResult.successful.length > 0) {
                        const uploadedFile = uploadResult.successful[0];
                        
                        // Update file info with upload result
                        Object.assign(fileInfo, uploadedFile);
                        fileInfo.tempFile = null;
                        fileInfo.uploadStatus = 'uploaded';

                        // Update display to show completion
                        this.updateFileDisplayAfterUpload(fileIndex, uploadedFile);

                        // Trigger validation since upload status changed
                        this.validateEmailForm();
                        
                        console.log(`✅ File uploaded successfully: ${file.name}`);
                    } else if (uploadResult.failed.length > 0) {
                        throw new Error(uploadResult.failed[0].error);
                    }
                    
                } catch (error) {
                    console.error(`❌ Upload failed for ${file.name}:`, error);
                    this.updateFileDisplayAfterError(fileIndex, error);
                }
            });
            
            // Wait for all uploads to complete
            await Promise.allSettled(uploadPromises);
            
            console.log('🎯 All background uploads completed');
            
        } catch (error) {
            console.error('❌ Background upload error:', error);
            this.showToast(`Ошибка загрузки файлов: ${error.message}`, 'error');
        }
    }

    // Update file progress during upload
    updateFileProgress(fileIndex, progress, statusText) {
        console.log(`📊 updateFileProgress called: fileIndex=${fileIndex}, progress=${progress}%, status="${statusText}"`);
        
        const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
        if (attachmentItem) {
            console.log('✅ Found attachment item for fileIndex:', fileIndex);
            
            const progressFill = attachmentItem.querySelector('.progress-fill');
            const progressText = attachmentItem.querySelector('.progress-text');
            const storageType = attachmentItem.querySelector('.storage-type');
            const progressContainer = attachmentItem.querySelector('.upload-progress-container');
            
            console.log('🔍 Progress elements found:', {
                progressFill: !!progressFill,
                progressText: !!progressText,
                storageType: !!storageType,
                progressContainer: !!progressContainer
            });
            
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
                console.log(`🔄 Updated progress fill to ${progress}%`);
            }
            if (progressText) {
                progressText.textContent = `${Math.round(progress)}%`;
                console.log(`🔄 Updated progress text to ${Math.round(progress)}%`);
            }
            if (storageType) {
                storageType.textContent = statusText;
                console.log(`🔄 Updated storage type to "${statusText}"`);
            }
        } else {
            console.error(`❌ No attachment item found for fileIndex: ${fileIndex}`);
        }
    }

    // Update file display after successful upload
    updateFileDisplayAfterUpload(fileIndex, uploadedFile) {
        const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
        if (attachmentItem) {
            // Remove progress bar
            const progressContainer = attachmentItem.querySelector('.upload-progress-container');
            if (progressContainer) progressContainer.remove();
            
            // Update icon and status
            const attachmentIcon = attachmentItem.querySelector('.attachment-icon');
            const storageType = attachmentItem.querySelector('.storage-type');
            
            if (uploadedFile.isLocalFallback) {
                if (attachmentIcon) {
                    attachmentIcon.textContent = '💾';
                    attachmentIcon.className = 'attachment-icon status-local';
                }
                if (storageType) storageType.textContent = 'Локальное хранение';
            } else {
                if (attachmentIcon) {
                    attachmentIcon.textContent = '🔗';
                    attachmentIcon.className = 'attachment-icon status-link';
                }
                if (storageType) storageType.textContent = 'Supabase Storage';
            }
            
            // Timestamp display removed per user request
        }
    }

    // Update file display after upload error
    updateFileDisplayAfterError(fileIndex, error) {
        const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
        if (attachmentItem) {
            // Remove progress bar
            const progressContainer = attachmentItem.querySelector('.upload-progress-container');
            if (progressContainer) progressContainer.remove();
            
            // Update icon and status to show error
            const attachmentIcon = attachmentItem.querySelector('.attachment-icon');
            const storageType = attachmentItem.querySelector('.storage-type');
            
            if (attachmentIcon) {
                attachmentIcon.textContent = '❌';
                attachmentIcon.className = 'attachment-icon status-error';
            }
            if (storageType) storageType.textContent = `Ошибка: ${error.message}`;
        }
    }

    // Remove email attachment with Supabase Storage cleanup
    async removeEmailAttachment(index, attachmentsList) {
        if (index >= this.currentEmailCampaign.attachments.length) return;
        
        const attachment = this.currentEmailCampaign.attachments[index];
        
        try {
            // Delete file from Google Drive if it exists
            if (attachment.driveFileId && this.googleDriveClient) {
                console.log(`🗑️ Deleting file from Google Drive: ${attachment.driveFileId}`);
                try {
                    await this.googleDriveClient.deleteFile(attachment.driveFileId);
                    console.log(`✅ File deleted from Google Drive: ${attachment.driveFileId}`);
                } catch (driveError) {
                    console.warn('⚠️ Could not delete file from Google Drive:', driveError.message);
                    // Continue with other deletions even if Drive deletion fails
                }
            }
            
            // Delete file from Supabase Storage if it exists
            if (attachment.bucket && attachment.filePath && this.fileManager) {
                console.log(`🗑️ Deleting file from storage: ${attachment.filePath}`);
                await this.fileManager.deleteFile(attachment.bucket, attachment.filePath);
                console.log(`✅ File deleted from storage: ${attachment.filePath}`);
            }
        } catch (error) {
            console.warn('⚠️ Could not delete file from storage:', error.message);
            // Continue with removal from UI even if storage deletion fails
        }
        
        // Remove from attachments array
        this.currentEmailCampaign.attachments.splice(index, 1);
        
        // Rebuild attachments list with updated indices
        this.rebuildAttachmentsList(attachmentsList);

        // CRITICAL FIX: Reset file input value to allow re-uploading the same file
        const fileInput = document.getElementById('emailAttachments');
        if (fileInput) {
            fileInput.value = '';
            console.log('✅ File input value reset - same files can now be re-uploaded');
        }

        // Trigger validation after file removal
        this.validateEmailForm();

        this.showToast('Файл удален', 'success');
    }

    // Rebuild attachments list display
    rebuildAttachmentsList(attachmentsList) {
        attachmentsList.innerHTML = '';
        this.currentEmailCampaign.attachments.forEach((attachment, newIndex) => {
            this.createAttachmentDisplay(attachment, newIndex, attachmentsList);
        });
        
        // Manage has-files class and controls visibility based on file count
        const controls = document.querySelector('.attachments-controls');
        if (this.currentEmailCampaign.attachments.length > 0) {
            attachmentsList.classList.add('has-files');
            if (controls) controls.style.display = 'block';
        } else {
            attachmentsList.classList.remove('has-files');
            if (controls) controls.style.display = 'none';
        }
        console.log(`🔄 Rebuilt attachments list: ${this.currentEmailCampaign.attachments.length} files, has-files: ${attachmentsList.classList.contains('has-files')}`);
    }


    // Show loading state during file upload
    showFileUploadLoading(attachmentsList, fileCount) {
        // Don't clear existing files - just add loading indicator
        const loadingElement = document.createElement('div');
        loadingElement.className = 'file-upload-loading';
        loadingElement.innerHTML = `
            <div class="upload-spinner"></div>
            <div class="upload-progress">
                <p>Загрузка ${fileCount} файлов в Supabase Storage...</p>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        `;
        attachmentsList.appendChild(loadingElement);
        console.log('⏳ Added loading indicator without clearing existing files');
    }

    // Hide loading state
    hideFileUploadLoading(attachmentsList) {
        const loadingElement = attachmentsList.querySelector('.file-upload-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    // Create attachment display element
    createAttachmentDisplay(fileInfo, index, attachmentsList) {
        console.log('🎨 createAttachmentDisplay started');
        console.log('📋 Parameters:', { fileInfo: fileInfo.originalName, index, attachmentsList: !!attachmentsList });
        console.log('📁 Full fileInfo:', fileInfo);
        
        const attachmentItem = document.createElement('div');
        attachmentItem.className = 'attachment-item';
        attachmentItem.setAttribute('data-file-path', fileInfo.filePath);
        
        console.log('📦 Created attachment item element:', attachmentItem);
        
        // Determine file icon based on type and status
        let statusIcon = '📎'; // Default
        let statusClass = 'status-normal';
        let storageInfo = '';
        
        // Check for already uploaded Google Drive files first
        if (fileInfo.driveFileId) {
            statusIcon = '☁️'; // Cloud icon for Google Drive files
            statusClass = 'status-drive-completed';
            storageInfo = ''; // No storage label for clean look
            // Keep existing permission setup flags as-is
        } else if (fileInfo.isLocalFallback || fileInfo.bucket === 'local-fallback') {
            statusIcon = '💾'; // Local storage icon
            statusClass = 'status-local';
            storageInfo = ''; // Keep clean look
        } else if (fileInfo.isGoogleDriveFile || fileInfo.needsPermissionSetup) {
            // Google Drive files (either large files or routed due to cumulative size)
            statusIcon = '☁️'; // Cloud icon for Google Drive files
            statusClass = 'status-cloud';
            storageInfo = ''; // Keep clean look
            // Mark as requiring permission setup only if not already set
            if (!fileInfo.hasOwnProperty('needsPermissionSetup')) {
                fileInfo.needsPermissionSetup = true;
                fileInfo.permissionStatus = 'pending';
            }
        } else {
            // Regular files - no storage info for clean look
            storageInfo = '';
        }
        
        // Upload info removed per user request - no timestamps shown
            
        // File type detection for better display
        const fileExtension = fileInfo.originalName.split('.').pop()?.toLowerCase();
        const fileTypeClass = this.getFileTypeClass(fileExtension);
            
        // Create Google Drive button if needed (for files that need permissions)
        let googleDriveButton = '';
        if (fileInfo.needsPermissionSetup) {
            const isPermissionGranted = fileInfo.permissionStatus === 'granted';
            const warningIcon = isPermissionGranted ? '✓' : '❗';
            const buttonClass = isPermissionGranted ? 'google-drive-button drive-completed' : 'google-drive-button';
            const buttonStyle = isPermissionGranted ?
                'background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: 1px solid #28a745;' : '';

            googleDriveButton = `<button type="button" class="${buttonClass}" data-index="${index}" title="Управление разрешениями Google Drive" style="${buttonStyle}">
                <span class="drive-text">Google Drive</span>
                <span class="drive-warning" style="${isPermissionGranted ? 'color: white; font-size: 16px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.3);' : ''}">${warningIcon}</span>
            </button>`;
        }

        attachmentItem.innerHTML = `
            <div class="attachment-info">
                <span class="attachment-icon ${statusClass}" title="${this.getStatusTitle(statusClass)}">${statusIcon}</span>
                <div class="attachment-details">
                    <span class="attachment-name ${fileTypeClass}" title="${fileInfo.originalName}">${fileInfo.originalName}</span>
                    <div class="attachment-meta">
                        <span class="attachment-size">${this.formatFileSize(fileInfo.size)}</span>
                    </div>
                </div>
            </div>
            <div class="attachment-actions">
                ${googleDriveButton}
                <button type="button" class="remove-attachment" data-index="${index}" title="Удалить">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" transform="rotate(45 12 12)"/>
                    </svg>
                </button>
            </div>
        `;

        // Bind buttons
        const removeBtn = attachmentItem.querySelector('.remove-attachment');
        const googleDriveBtn = attachmentItem.querySelector('.google-drive-button');

        removeBtn.addEventListener('click', () => {
            this.removeEmailAttachment(index, attachmentsList);
        });

        // Bind Google Drive permissions management if button exists
        if (googleDriveBtn) {
            googleDriveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('🔧 Google Drive button clicked for file:', fileInfo.originalName);

                // Check if file has driveFileId (already uploaded)
                if (fileInfo.driveFileId) {
                    this.showDrivePermissionsModal(fileInfo.driveFileId, index);
                } else {
                    this.showToast('❗ Файл еще не загружен на Google Drive', 'warning');
                }
            });
        }

        attachmentsList.appendChild(attachmentItem);
    }

    // Update existing file display without creating duplicate
    updateExistingFileDisplay(fileIndex, fileInfo, attachmentsList) {
        console.log(`🔄 Updating existing file display for index ${fileIndex}: ${fileInfo.originalName}`);
        
        // Find the existing attachment item in the DOM
        const existingItem = attachmentsList.children[fileIndex];
        if (!existingItem) {
            console.warn(`⚠️ Could not find existing attachment item at index ${fileIndex}`);
            return;
        }
        
        // Update the storage info and status
        const storageType = existingItem.querySelector('.storage-type');
        if (storageType) {
            if (fileInfo.isLocalFallback) {
                storageType.textContent = 'Локальное хранение';
            } else {
                storageType.textContent = 'Supabase Storage';
            }
        }
        
        // Update icon if needed
        const attachmentIcon = existingItem.querySelector('.attachment-icon');
        if (attachmentIcon) {
            if (fileInfo.isLocalFallback) {
                attachmentIcon.textContent = '💾';
                attachmentIcon.className = 'attachment-icon status-local';
            } else {
                attachmentIcon.textContent = '🔗';
                attachmentIcon.className = 'attachment-icon status-link';
            }
        }
        
        // Timestamp display removed per user request
        
        console.log(`✅ Updated display for existing file: ${fileInfo.originalName}`);
    }

    // Helper methods for better file display
    getFileTypeClass(extension) {
        if (!extension) return 'file-type-generic';
        
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const docTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
        const codeTypes = ['js', 'html', 'css', 'json', 'xml'];
        const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
        
        if (imageTypes.includes(extension)) return 'file-type-image';
        if (docTypes.includes(extension)) return 'file-type-document';
        if (codeTypes.includes(extension)) return 'file-type-code';
        if (archiveTypes.includes(extension)) return 'file-type-archive';
        
        return 'file-type-generic';
    }
    
    getStatusTitle(statusClass) {
        switch(statusClass) {
            case 'status-local': return 'Файл сохранен локально в браузере';
            case 'status-cloud': return 'Файл будет загружен в Google Drive';
            case 'status-warning': return 'Большой файл';
            case 'status-link': return 'Файл с публичной ссылкой';
            default: return 'Обычный файл';
        }
    }
    
    getFileSizeWarning(size) {
        if (size > 25 * 1024 * 1024) {
            return '<span class="size-warning">Автозагрузка в Google Drive</span>';
        } else if (size > 10 * 1024 * 1024) {
            return '<span class="size-caution">Большой файл</span>';
        }
        return '';
    }

    // Preview attachment with support for local and cloud files
    async previewAttachment(index) {
        const attachment = this.currentEmailCampaign.attachments[index];
        if (!attachment) return;
        
        try {
            // Handle local files differently
            if (attachment.isLocalFallback || attachment.bucket === 'local-fallback') {
                // Get file data from local storage
                const fileData = await this.fileManager.getLocalFile(attachment.filePath);
                if (!fileData) {
                    throw new Error('Локальный файл не найден');
                }
                
                // Create blob URL for preview
                const blob = new Blob([fileData.data], { type: attachment.mimeType });
                const blobUrl = URL.createObjectURL(blob);
                
                // Open preview in new window
                const previewWindow = window.open(blobUrl, '_blank', 'width=800,height=600');
                
                // Clean up blob URL after window is closed
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 60000); // 1 minute timeout
                
            } else {
                // Get signed URL for cloud files
                const signedUrlResult = this.fileManager.getFileUrl(
                    attachment.bucket, 
                    attachment.filePath, 
                    3600 // 1 hour
                );
                
                if (!signedUrlResult || !signedUrlResult.signedUrl) {
                    throw new Error('Не удалось получить ссылку на файл');
                }
                
                // Open preview in new window
                window.open(signedUrlResult.signedUrl, '_blank', 'width=800,height=600');
            }
            
        } catch (error) {
            console.error('❌ Preview error:', error);
            this.showToast(`Не удалось открыть предпросмотр: ${error.message}`, 'error');
        }
    }

    // Format file size for display
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }


    // Get permission description for tooltip
    getPermissionDescription(permissionType, emailAddress) {
        switch (permissionType) {
            case 'link':
                return 'всем по ссылке';
            case 'email':
                return `${emailAddress}`;
            default:
                return 'настроены';
        }
    }


    // Save email campaign and continue to step 2
    async saveEmailCampaignAndContinue() {
        // Get button reference and store original text for error handling
        const nextBtn = document.getElementById('nextToStep2');
        const originalText = nextBtn.innerHTML;

        try {
            console.log('💾 Saving email campaign and continuing to step 2...');
            console.log('🔍 Auth client debug:', {
                exists: !!window.gymnastikaAuth,
                isInitialized: window.gymnastikaAuth?.isInitialized(),
                originalTextExists: !!originalText
            });
            
            // Initialize auth client if needed
            if (!window.gymnastikaAuth) {
                throw new Error('Auth client not available');
            }

            if (!window.gymnastikaAuth.isInitialized()) {
                console.log('🔐 Initializing auth client...');
                await window.gymnastikaAuth.initialize();
            }
            
            // Show loading state
            nextBtn.disabled = true;
            nextBtn.innerHTML = `
                <svg class="animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="15 3" stroke-width="2"/>
                </svg>
                Сохранение...
            `;

            // Save campaign to database
            const savedCampaign = await window.gymnastikaAuth.saveEmailCampaign(this.currentEmailCampaign);
            console.log('✅ Email campaign saved:', savedCampaign);

            // Store campaign ID for later use
            this.currentEmailCampaignId = savedCampaign.id;

            // Save session state for persistence across page refresh
            this.saveEmailSessionState({
                step: 2,
                campaignId: savedCampaign.id,
                subject: this.currentEmailCampaign.subject,
                body: this.currentEmailCampaign.body,
                attachments: this.currentEmailCampaign.attachments || []
            });

            // Proceed to step 2
            this.showEmailStep2();

            // Show success notification
            this.showSuccess('Письмо сохранено! Теперь выберите получателей.');

        } catch (error) {
            console.error('❌ Failed to save email campaign:', error);
            this.showError(`Ошибка сохранения письма: ${error.message}`);
            
            // Restore button state
            const nextBtn = document.getElementById('nextToStep2');
            nextBtn.disabled = false;
            nextBtn.innerHTML = originalText;
        }
    }

    // Show email step 2 (recipient selection)
    showEmailStep2() {
        console.log('📧 Showing email step 2...');
        
        const step1 = document.getElementById('emailStep1');
        const step2 = document.getElementById('emailStep2');
        const progressStep1 = document.querySelector('[data-step="1"]');
        const progressStep2 = document.querySelector('[data-step="2"]');

        if (step1) step1.classList.remove('active');
        if (step2) step2.classList.add('active');
        if (progressStep1) progressStep1.classList.remove('active');
        if (progressStep2) progressStep2.classList.add('active');

        // Load contacts for recipient selection
        this.loadEmailContacts();

        console.log('✅ Email step 2 activated');
    }

    // Load contacts for email recipients selection
    async loadEmailContacts() {
        console.log('📧 Loading email contacts...');
        
        const loadingState = document.getElementById('emailContactsLoading');
        const emptyState = document.getElementById('emailContactsEmpty');
        const selectionState = document.getElementById('emailContactsSelection');

        // Show loading state
        if (loadingState) loadingState.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        if (selectionState) selectionState.classList.add('hidden');

        try {
            // Initialize selected contacts array
            this.selectedEmailContacts = [];

            // Get contacts from cache first
            let contacts = this.getCacheData('parsing_results');
            
            // If no cache, load from database
            if (!contacts || contacts.length === 0) {
                console.log('📧 No cached contacts, loading from database...');
                
                // Wait for Supabase client
                if (!this.supabase) {
                    let attempts = 0;
                    while (!this.supabase && attempts < 50) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                    }
                }

                if (this.supabase) {
                    const { data, error } = await this.supabase
                        .from('parsing_results')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(1000);

                    if (!error && data) {
                        contacts = data;
                        // Update cache
                        this.setCacheData('parsing_results', contacts);
                    }
                }
            }

            // Filter only contacts with emails
            const emailContacts = contacts ? contacts.filter(contact => contact.email && contact.email !== 'N/A') : [];
            
            if (emailContacts.length === 0) {
                // Show empty state
                if (loadingState) loadingState.classList.add('hidden');
                if (emptyState) emptyState.classList.remove('hidden');
                return;
            }

            // Display contacts with checkboxes
            this.displayEmailContacts(emailContacts);
            
            // Hide loading, show selection
            if (loadingState) loadingState.classList.add('hidden');
            if (selectionState) selectionState.classList.remove('hidden');

            console.log(`✅ Loaded ${emailContacts.length} email contacts for selection`);

        } catch (error) {
            console.error('❌ Failed to load email contacts:', error);
            
            // Show empty state on error
            if (loadingState) loadingState.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
        }
    }

    // Display contacts with checkboxes for selection
    displayEmailContacts(contacts) {
        const tableBody = document.getElementById('emailContactsTableBody');
        if (!tableBody) return;

        // Clear existing content
        tableBody.innerHTML = '';

        // Add each contact as table row with checkbox
        contacts.forEach((contact, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="checkbox-column">
                    <label class="contact-checkbox-label">
                        <input type="checkbox" class="contact-checkbox" data-contact-id="${contact.id || index}" data-email="${contact.email}">
                        <span class="checkbox-custom"></span>
                    </label>
                </td>
                <td>${contact.organization_name || 'N/A'}</td>
                <td class="email-cell">${contact.email}</td>
                <td>${contact.description ? (contact.description.length > 50 ? contact.description.substring(0, 50) + '...' : contact.description) : 'N/A'}</td>
                <td>${contact.website ? `<a href="${contact.website}" target="_blank" class="website-link">${contact.website}</a>` : 'N/A'}</td>
                <td>${contact.country || 'N/A'}</td>
            `;
            tableBody.appendChild(row);
        });

        // Bind checkbox events
        this.bindEmailContactsSelection();
    }

    // Bind email contacts selection logic
    bindEmailContactsSelection() {
        console.log('📧 Binding email contacts selection...');

        const selectAllCheckbox = document.getElementById('selectAllEmailContacts');
        const contactCheckboxes = document.querySelectorAll('.contact-checkbox');
        const selectedCount = document.getElementById('selectedContactsCount');

        // Select all checkbox logic
        if (selectAllCheckbox) {
            // Update select-all checkbox styling based on state
            const updateSelectAllStyling = () => {
                const selectAllLabel = selectAllCheckbox.closest('.checkbox-label');
                if (selectAllLabel) {
                    selectAllLabel.classList.remove('checked', 'indeterminate');
                    if (selectAllCheckbox.checked) {
                        selectAllLabel.classList.add('checked');
                    } else if (selectAllCheckbox.indeterminate) {
                        selectAllLabel.classList.add('indeterminate');
                    }
                }
            };

            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                contactCheckboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
                this.updateSelectedEmailContacts();
                updateSelectAllStyling();
            });

            selectAllCheckbox.addEventListener('focus', () => {
                const selectAllLabel = selectAllCheckbox.closest('.checkbox-label');
                if (selectAllLabel) selectAllLabel.classList.add('focused');
            });

            selectAllCheckbox.addEventListener('blur', () => {
                const selectAllLabel = selectAllCheckbox.closest('.checkbox-label');
                if (selectAllLabel) selectAllLabel.classList.remove('focused');
            });
        }

        // Individual checkbox logic
        contactCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedEmailContacts();

                // Update select all checkbox state
                const checkedCount = document.querySelectorAll('.contact-checkbox:checked').length;
                const totalCount = contactCheckboxes.length;

                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = checkedCount === totalCount;
                    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;

                    // Update select-all checkbox styling
                    const selectAllLabel = selectAllCheckbox.closest('.checkbox-label');
                    if (selectAllLabel) {
                        selectAllLabel.classList.remove('checked', 'indeterminate');
                        if (selectAllCheckbox.checked) {
                            selectAllLabel.classList.add('checked');
                        } else if (selectAllCheckbox.indeterminate) {
                            selectAllLabel.classList.add('indeterminate');
                        }
                    }
                }
            });
        });

        console.log('✅ Email contacts selection bound');
    }

    // Update selected email contacts array and counter
    updateSelectedEmailContacts() {
        const selectedCheckboxes = document.querySelectorAll('.contact-checkbox:checked');
        const selectedCount = document.getElementById('selectedContactsCount');
        
        // Update selected contacts array
        this.selectedEmailContacts = [];
        selectedCheckboxes.forEach(checkbox => {
            this.selectedEmailContacts.push({
                id: checkbox.dataset.contactId,
                email: checkbox.dataset.email
            });
        });

        // Update counter display
        const count = this.selectedEmailContacts.length;
        if (selectedCount) {
            selectedCount.textContent = `${count} выбрано`;
        }

        console.log(`📧 Selected ${count} contacts for email campaign`);
    }

    // Start parsing process
    async startParsing(params) {
        try {
            // 1. Create task in database with 'pending' status
            const taskData = {
                taskName: params.taskName,
                searchQuery: params.searchQuery,
                websiteUrl: params.websiteUrl,
                type: params.websiteUrl ? 'url-parsing' : 'ai-search',
                categoryId: params.categoryId
            };

            const taskResponse = await fetch('/api/parsing-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    userId: this.currentUser?.id,
                    taskData: taskData
                })
            });

            if (!taskResponse.ok) {
                throw new Error('Failed to create task in database');
            }

            const createdTask = await taskResponse.json();
            this.currentTaskId = createdTask.id;
            console.log('✅ Task created with status: pending, ID:', this.currentTaskId);
            console.log('🔄 Background Worker will pick up and execute this task automatically');

            // 2. Show visual feedback - task sent to server
            const submitBtn = document.querySelector('.submit-btn');
            const progressBar = document.getElementById('modernProgressBar');
            const progressDesc = document.getElementById('progressDescription');

            if (submitBtn) submitBtn.style.display = 'none';
            if (progressBar) progressBar.classList.add('active');
            if (progressDesc) progressDesc.classList.add('active');

            // 3. Show initial progress state - waiting for Background Worker
            this.updateModernProgress({
                stage: 'initializing',
                current: 0,
                total: 100,
                message: 'Задача отправлена на сервер... Ожидание Background Worker...'
            });

            // 4. Real-time subscription will handle all progress updates from Background Worker
            // No need to execute pipeline here - Background Worker does everything!

        } catch (error) {
            console.error('❌ Task creation error:', error);
            this.showError('Ошибка создания задачи: ' + error.message);
            this.resetParsingUI();
        }
    }

    // Start URL parsing process (direct web scraping without AI/Google Maps)
    async startUrlParsing(params) {
        try {
            // 1. Create task in database with 'pending' status
            const taskData = {
                taskName: params.taskName,
                websiteUrl: params.websiteUrl,
                type: 'url-parsing',
                categoryId: params.categoryId
            };

            const taskResponse = await fetch('/api/parsing-tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    userId: this.currentUser?.id,
                    taskData: taskData
                })
            });

            if (!taskResponse.ok) {
                throw new Error('Failed to create task in database');
            }

            const createdTask = await taskResponse.json();
            this.currentTaskId = createdTask.id;
            console.log('✅ URL parsing task created with status: pending, ID:', this.currentTaskId);
            console.log('🔄 Background Worker will pick up and execute this task automatically');

            // 2. Show visual feedback - task sent to server
            const submitBtn = document.querySelector('#urlParsingForm .submit-btn');
            const progressBar = document.getElementById('modernProgressBar');
            const progressDesc = document.getElementById('progressDescription');

            if (submitBtn) submitBtn.style.display = 'none';
            if (progressBar) progressBar.classList.add('active');
            if (progressDesc) progressDesc.classList.add('active');

            // 3. Show initial progress state - waiting for Background Worker
            this.updateModernProgress({
                stage: 'initializing',
                current: 0,
                total: 100,
                message: 'Задача отправлена на сервер... Ожидание Background Worker...'
            });

            // 4. Real-time subscription will handle all progress updates from Background Worker
            // No need to execute pipeline here - Background Worker does everything!

        } catch (error) {
            console.error('❌ URL parsing task creation error:', error);
            this.showError('Ошибка создания задачи: ' + error.message);
            this.resetParsingUI();
        }
    }

    // Show progress
    showProgress(message, percentage) {
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressContainer && progressBar && progressText) {
            progressContainer.classList.remove('hidden');
            progressBar.style.width = percentage + '%';
            progressText.textContent = message;
        }
    }

    // Update progress
    updateProgress(progress) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar && progressText && progress) {
            progressBar.style.width = (progress.percentage || 0) + '%';
            progressText.textContent = progress.stage || 'Обработка...';
        }
    }

    // Hide progress
    hideProgress() {
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
    }

    // Update modern progress bar based on pipeline stage
    updateModernProgress(progress) {
        if (!progress || !progress.stage) return;

        // Calculate percentage from progress.current and progress.total
        const percentage = progress.total > 0
            ? Math.round((progress.current / progress.total) * 100)
            : 0;

        // Stage mapping for visual indicators (AI Search has more stages)
        const stageMapping = {
            'initializing': 0,
            'query-generation': 1,
            'apify-search': 2,
            'aggregation': 2, // Same as apify-search visually
            'web-scraping': 3,
            'filtering': 3, // Same as web-scraping visually
            'relevance': 3, // Same as web-scraping visually
            'complete': 4
        };

        // Description for each stage
        const stageDescriptions = {
            'initializing': 'Инициализация парсинга...',
            'query-generation': 'Генерация поисковых запросов с помощью ИИ',
            'apify-search': 'Поиск организаций в Google Maps',
            'aggregation': 'Обработка и дедупликация результатов',
            'web-scraping': 'Извлечение контактных данных с веб-сайтов',
            'filtering': 'Фильтрация результатов по контактам',
            'relevance': 'Сортировка по релевантности',
            'complete': '✅ Парсинг завершен успешно!'
        };

        const stageIndex = stageMapping[progress.stage];
        const fill = document.getElementById('progressFill');
        const stages = document.querySelectorAll('.progress-stage');
        const progressDesc = document.getElementById('progressDescription');

        // Update fill width using calculated percentage
        if (fill) {
            fill.style.width = percentage + '%';
        }

        // Update stage states if we have stage mapping
        if (stageIndex !== undefined) {
            stages.forEach((stage, idx) => {
                stage.classList.remove('active', 'completed');
                if (idx < stageIndex) {
                    stage.classList.add('completed');
                } else if (idx === stageIndex) {
                    stage.classList.add('active');
                }
            });
        }

        // Update progress description text
        if (progressDesc) {
            const description = stageDescriptions[progress.stage] || progress.message || 'Обработка...';
            progressDesc.textContent = description;
        }

        console.log(`📊 Progress: ${progress.stage} → ${percentage}% (${progress.current}/${progress.total})`);
    }

    // Reset parsing UI after completion or error
    resetParsingUI() {
        // ✅ FIX: Reset both AI Search and URL Parsing submit buttons
        const aiSearchBtn = document.querySelector('#parsingForm .submit-btn');
        const urlParsingBtn = document.querySelector('#urlParsingForm .submit-btn');
        const progressBar = document.getElementById('modernProgressBar');
        const progressDesc = document.getElementById('progressDescription');
        const progressFill = document.getElementById('progressFill');

        // Show both submit buttons
        if (aiSearchBtn) {
            aiSearchBtn.style.display = 'block';
            console.log('✅ AI Search submit button shown');
        }
        if (urlParsingBtn) {
            urlParsingBtn.style.display = 'block';
            console.log('✅ URL Parsing submit button shown');
        }

        // Hide and reset progress bar
        if (progressBar) {
            progressBar.classList.remove('active');
            console.log('✅ Progress bar hidden');

            // Reset all stage visual states
            const allStages = progressBar.querySelectorAll('.progress-stage');
            allStages.forEach(stage => {
                stage.classList.remove('active', 'completed');
            });
        }

        // Reset progress fill width
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        // Reset progress description
        if (progressDesc) {
            progressDesc.textContent = 'Нажмите "Начать парсинг" для запуска процесса';
            progressDesc.classList.remove('active');
        }

        console.log('🔄 Parsing UI reset complete');
    }

    // Update task progress in database
    async updateTaskProgress(progress) {
        if (!this.currentTaskId) return;

        try {
            const stageMapping = {
                'initializing': 'initializing',
                'query-generation': 'query-generation',
                'apify-search': 'apify-search',
                'aggregation': 'aggregation',
                'web-scraping': 'web-scraping',
                'filtering': 'filtering',
                'relevance': 'relevance',
                'complete': 'complete'
            };

            const stageToPercent = {
                'initializing': 0,
                'query-generation': 25,
                'apify-search': 50,
                'aggregation': 50,
                'web-scraping': 75,
                'filtering': 75,
                'relevance': 75,
                'complete': 100
            };

            await fetch(`/api/parsing-tasks/${this.currentTaskId}/progress`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    stage: stageMapping[progress.stage] || progress.stage,
                    current: stageToPercent[progress.stage] || progress.current || 0,
                    total: 100,
                    message: progress.message || ''
                })
            });
        } catch (error) {
            console.warn('⚠️ Failed to update task progress:', error.message);
            // Don't throw - progress update failure shouldn't stop parsing
        }
    }

    // Check for active parsing tasks and restore UI state
    async checkAndRestoreActiveTask() {
        try {
            if (!this.currentUser) return;

            // Get active tasks (running or pending)
            const response = await fetch(`/api/parsing-tasks/active?userId=${this.currentUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });

            if (!response.ok) return;

            const activeTasks = await response.json();
            if (!activeTasks || activeTasks.length === 0) {
                // ✅ No active tasks - ensure UI is clean
                this.resetParsingUI();
                return;
            }

            // Get the most recent active task
            const activeTask = activeTasks[0];
            
            // ✅ Check if task is actually recent (within last 30 minutes)
            const taskTime = new Date(activeTask.created_at).getTime();
            const now = Date.now();
            const thirtyMinutes = 30 * 60 * 1000;
            
            if (now - taskTime > thirtyMinutes) {
                console.log('⏰ Active task is too old (>30min), not restoring UI');
                // Task is too old, likely stuck - don't restore UI
                this.resetParsingUI();
                return;
            }

            this.currentTaskId = activeTask.id;
            console.log('🔄 Restoring active parsing task:', activeTask.id);

            // ✅ FIX: Use specific selectors for both buttons
            const aiSearchBtn = document.querySelector('#parsingForm .submit-btn');
            const urlParsingBtn = document.querySelector('#urlParsingForm .submit-btn');
            const progressBar = document.getElementById('modernProgressBar');
            const progressDesc = document.getElementById('progressDescription');

            // Hide both submit buttons
            if (aiSearchBtn) {
                aiSearchBtn.style.display = 'none';
                console.log('✅ AI Search button hidden for active task');
            }
            if (urlParsingBtn) {
                urlParsingBtn.style.display = 'none';
                console.log('✅ URL Parsing button hidden for active task');
            }
            
            // Show progress bar
            if (progressBar) {
                progressBar.classList.add('active');
                console.log('✅ Progress bar activated for active task');
            }
            if (progressDesc) {
                progressDesc.classList.add('active');
            }

            // Restore progress state from DB
            if (activeTask.progress && activeTask.current_stage) {
                this.updateModernProgress({
                    stage: activeTask.current_stage,
                    current: activeTask.progress.current || 0,
                    total: activeTask.progress.total || 100,
                    message: activeTask.progress.message || 'Продолжение парсинга...'
                });
            }

            console.log('✅ Active task restored successfully');

        } catch (error) {
            console.warn('⚠️ Failed to restore active task:', error.message);
            // Ensure clean UI if restore fails
            this.resetParsingUI();
        }
    }

    /**
     * Setup hybrid task monitoring (real-time + polling fallback)
     */
    async setupTaskMonitoring() {
        try {
            if (!this.currentUser) {
                console.log('⚠️ No user session - skipping task monitoring');
                return;
            }

            console.log('🔄 Setting up hybrid task monitoring system...');

            // Try to setup real-time subscription (if Realtime is enabled in Supabase)
            await this.setupTaskSubscription();

            // Always start polling fallback (works even if Realtime is disabled)
            this.startTaskPolling();

            console.log('✅ Hybrid task monitoring active (real-time + polling)');

        } catch (error) {
            console.error('❌ Failed to setup task monitoring:', error);
        }
    }

    /**
     * Setup real-time subscription for parsing tasks (if enabled)
     */
    async setupTaskSubscription() {
        try {
            console.log('📡 Attempting real-time subscription setup...');

            // Unsubscribe from previous subscription if exists
            if (this.taskSubscription) {
                await this.supabase.removeChannel(this.taskSubscription);
                this.taskSubscription = null;
            }

            // Create new real-time subscription
            this.taskSubscription = this.supabase
                .channel(`parsing_tasks_${this.currentUser.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'parsing_tasks',
                    filter: `user_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    console.log('📨 Real-time event received:', payload.new);
                    this.handleTaskUpdate(payload.new);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Real-time subscription active');
                    } else if (status === 'CLOSED') {
                        console.warn('⚠️ Real-time subscription closed, relying on polling');
                    } else {
                        console.log('📡 Subscription status:', status);
                    }
                });

        } catch (error) {
            console.warn('⚠️ Real-time subscription failed, relying on polling:', error.message);
        }
    }

    /**
     * Start polling fallback for task updates
     */
    startTaskPolling() {
        // Stop existing polling if any
        if (this.taskPollingInterval) {
            clearInterval(this.taskPollingInterval);
            this.taskPollingInterval = null;
        }

        console.log('🔄 Starting polling fallback (checks every 5 seconds)');

        // Poll every 5 seconds
        this.taskPollingInterval = setInterval(async () => {
            try {
                // Only poll if there's an active task
                if (!this.currentTaskId) {
                    // Check if there's an active task we don't know about
                    await this.checkForActiveTask();
                    return;
                }

                // Fetch current task status
                const response = await fetch(`/api/parsing-tasks/${this.currentTaskId}`, {
                    headers: {
                        'Authorization': `Bearer ${await this.getAuthToken()}`
                    }
                });

                if (!response.ok) {
                    console.warn(`⚠️ Task ${this.currentTaskId} not found, stopping polling`);
                    this.currentTaskId = null;
                    this.lastTaskStatus = null;
                    return;
                }

                const task = await response.json();

                // Check if status changed
                if (task.status !== this.lastTaskStatus) {
                    console.log(`🔔 Polling detected status change: ${this.lastTaskStatus} → ${task.status}`);
                    await this.handleTaskUpdate(task);
                }

            } catch (error) {
                console.error('❌ Polling error:', error.message);
            }
        }, 5000);
    }

    /**
     * Check for active tasks that we might not know about
     */
    async checkForActiveTask() {
        try {
            const response = await fetch(`/api/parsing-tasks/active?userId=${this.currentUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });

            if (!response.ok) return;

            const activeTasks = await response.json();
            if (activeTasks && activeTasks.length > 0) {
                const task = activeTasks[0];
                console.log(`🔍 Polling found active task: ${task.id}`);
                this.currentTaskId = task.id;
                this.lastTaskStatus = task.status;
                await this.handleTaskUpdate(task);
            }
        } catch (error) {
            // Silent fail - this is just a background check
        }
    }

    /**
     * Stop task polling
     */
    stopTaskPolling() {
        if (this.taskPollingInterval) {
            console.log('⏸️ Stopping task polling');
            clearInterval(this.taskPollingInterval);
            this.taskPollingInterval = null;
        }
    }

    /**
     * Handle real-time task updates
     */
    async handleTaskUpdate(task) {
        try {
            console.log('🔄 Handling task update:', task.id, 'status:', task.status);

            // Track current task ID and status for polling
            this.currentTaskId = task.id;
            this.lastTaskStatus = task.status;

            // Update progress bar for running tasks
            if (task.status === 'running' && task.progress) {
                this.updateModernProgress({
                    stage: task.current_stage || 'processing',
                    current: task.progress.current || 0,
                    total: task.progress.total || 100,
                    message: task.progress.message || 'Обработка...'
                });
            }

            // Handle completed tasks
            if (task.status === 'completed') {
                await this.handleTaskCompletion(task);
                // Stop polling after completion
                this.stopTaskPolling();
                this.currentTaskId = null;
                this.lastTaskStatus = null;
            }

            // Handle failed tasks
            if (task.status === 'failed') {
                this.resetParsingUI();
                this.showNotification('Парсинг не удался', task.error_message || 'Неизвестная ошибка', 'error');
                // Stop polling after failure
                this.stopTaskPolling();
                this.currentTaskId = null;
                this.lastTaskStatus = null;
            }

        } catch (error) {
            console.error('❌ Error handling task update:', error);
        }
    }

    /**
     * Handle task completion
     */
    async handleTaskCompletion(task) {
        try {
            console.log('🎉 Task completed:', task.id);

            // Reset UI
            this.resetParsingUI();

            // Get final results from task
            const finalResults = task.final_results;

            if (!finalResults || !finalResults.results) {
                console.warn('⚠️ No results in completed task');
                this.showNotification('Парсинг завершен', 'Результаты не найдены', 'warning');
                return;
            }

            const results = finalResults.results;
            const resultCount = results.length;

            console.log(`📊 Saving ${resultCount} results to database...`);

            // Save results to database
            await this.saveResultsToDatabase(task, results);

            // Show completion notification
            this.showNotification(
                'Парсинг завершен успешно!',
                `Найдено ${resultCount} результатов с контактными данными`,
                'success'
            );

            // Refresh UI tables
            await this.loadHistoryData();
            await this.loadContactsData();

            console.log('✅ Task completion handled successfully');

        } catch (error) {
            console.error('❌ Error handling task completion:', error);
            this.showNotification('Ошибка сохранения результатов', error.message, 'error');
        }
    }

    /**
     * Save parsing results to database
     */
    async saveResultsToDatabase(task, results) {
        try {
            if (!results || results.length === 0) {
                console.log('⚠️ No results to save');
                return;
            }

            console.log(`💾 Saving ${results.length} results for task ${task.id}...`);

            // Get Supabase auth user ID for RLS policy
            const supabaseUserId = (await this.supabase.auth.getUser()).data.user?.id;

            // Get task data from task object
            const taskData = task.task_data || {};
            const taskName = taskData.taskName || task.task_name || 'Неизвестная задача';
            const originalQuery = taskData.searchQuery || taskData.originalQuery || 'Не указан';

            // Prepare records matching the actual parsing_results table schema
            const records = results.map(result => ({
                user_id: supabaseUserId,
                task_name: taskName,
                original_query: originalQuery,
                organization_name: result.organizationName || result.name || 'Неизвестно',
                email: result.email || null,
                description: result.description || null,
                country: result.country || 'Не определено',
                source_url: result.website || result.url || result.sourceUrl || 'https://unknown.com',
                website: result.website || null,
                all_emails: result.all_emails || (result.email ? [result.email] : []),
                page_title: result.pageTitle || result.title || null,
                has_contact_info: !!(result.email || result.phone),
                scraping_error: result.error || null,
                error_type: result.errorType || null
            }));

            // Insert in batches of 100 to avoid Supabase limits
            const batchSize = 100;
            let insertedCount = 0;

            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);

                const { data, error } = await this.supabase
                    .from('parsing_results')
                    .insert(batch);

                if (error) {
                    console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error);
                    throw error;
                }

                insertedCount += batch.length;
                console.log(`✅ Inserted batch: ${insertedCount}/${records.length}`);
            }

            console.log(`✅ Successfully saved ${insertedCount} results to database`);

        } catch (error) {
            console.error('❌ Error saving results to database:', error);
            throw error;
        }
    }

    // View results modal
    viewResults(results) {
        const modal = document.getElementById('resultsModal');
        const tableBody = document.getElementById('resultsTableBody');
        const tableContainer = document.getElementById('resultsTableContainer');
        const emptyState = document.getElementById('resultsEmptyState');
        const resultsCount = document.getElementById('resultsCount');
        
        if (!modal || !tableBody) return;

        // Update count
        if (resultsCount) {
            resultsCount.textContent = `Найдено результатов: ${results.length}`;
        }

        // Clear previous results
        tableBody.innerHTML = '';

        if (results && results.length > 0) {
            // Show table, hide empty state
            if (tableContainer) tableContainer.classList.remove('hidden');
            if (emptyState) emptyState.classList.add('hidden');
            
            // Populate table with results
            results.forEach((result, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${result.organizationName || 'N/A'}</td>
                    <td>${result.email || 'N/A'}</td>
                    <td>${result.description ? (result.description.length > 100 ? result.description.substring(0, 100) + '...' : result.description) : 'N/A'}</td>
                    <td>${result.website ? `<a href="${result.website}" target="_blank">${result.website}</a>` : 'N/A'}</td>
                    <td>${result.country || 'N/A'}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            // Show empty state, hide table
            if (tableContainer) tableContainer.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
        }

        // Show modal
        modal.classList.remove('hidden');
        
        // Hide progress
        this.hideProgress();
    }

    // Close results modal
    closeResults() {
        const modal = document.getElementById('resultsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Setup Telegram settings
    async setupTelegramSettings() {
        await this.loadTelegramSettings();
        this.bindTelegramSettings();
    }

    // Load Telegram settings
    async loadTelegramSettings() {
        try {
            let telegramConnection = null;
            
            // Try to load from Supabase if user is authenticated
            if (window.gymnastikaAuth && window.gymnastikaAuth.isAuthenticated()) {
                telegramConnection = await window.gymnastikaAuth.getTelegramConnection();
                console.log('🔄 Loading Telegram settings from Supabase');
            }
            
            // Fallback to localStorage if no Supabase data
            if (!telegramConnection) {
                const token = localStorage.getItem('telegramBotToken');
                const botName = localStorage.getItem('telegramBotName');
                const chatId = localStorage.getItem('telegramChatId');
                
                if (token) {
                    telegramConnection = {
                        token: token,
                        botName: botName,
                        chatId: chatId,
                        connectedAt: null
                    };
                    console.log('🔄 Loading Telegram settings from localStorage');
                }
            }
            
            // Update settings and UI if connection found
            if (telegramConnection) {
                this.settings.telegramBotToken = telegramConnection.token;
                this.settings.telegramBotName = telegramConnection.botName;
                this.settings.telegramChatId = telegramConnection.chatId || '';
                
                // Fill input fields
                const tokenInput = document.getElementById('telegramBotToken');
                if (tokenInput) {
                    tokenInput.value = telegramConnection.token;
                }
                
                const chatIdInput = document.getElementById('telegramChatId');
                if (chatIdInput) {
                    chatIdInput.value = telegramConnection.chatId || '';
                }
                
                // Update connection status UI
                if (telegramConnection.botName) {
                    this.updateTelegramConnectionStatus(true, telegramConnection.botName);
                }
                
                console.log(`✅ Telegram settings loaded: ${telegramConnection.botName || 'Bot connected'}`);
            } else {
                // No connection found
                this.settings.telegramBotToken = '';
                this.settings.telegramBotName = '';
                this.settings.telegramChatId = '';
                
                const tokenInput = document.getElementById('telegramBotToken');
                if (tokenInput) {
                    tokenInput.value = '';
                }
                
                const chatIdInput = document.getElementById('telegramChatId');
                if (chatIdInput) {
                    chatIdInput.value = '';
                }
                
                this.updateTelegramConnectionStatus(false);
                console.log('ℹ️ No Telegram connection found');
            }
            
        } catch (error) {
            console.error('❌ Error loading Telegram settings:', error);
            
            // Fallback to localStorage on error
            const token = localStorage.getItem('telegramBotToken');
            if (token) {
                this.settings.telegramBotToken = token;
                const tokenInput = document.getElementById('telegramBotToken');
                if (tokenInput) {
                    tokenInput.value = token;
                }
            }
        }
    }

    // Save Telegram settings
    async saveTelegramSettings() {
        const tokenInput = document.getElementById('telegramBotToken');
        if (!tokenInput || !tokenInput.value.trim()) {
            this.showError('Введите токен Telegram бота');
            return;
        }

        const token = tokenInput.value.trim();
        const chatIdInput = document.getElementById('telegramChatId');
        const chatId = chatIdInput ? chatIdInput.value.trim() : '';
        
        // Validate token format first
        if (!this.validateTelegramToken(token)) {
            this.showError('Неверный формат токена Telegram бота');
            return;
        }

        try {
            // Test connection first to get bot name
            const response = await fetch('/api/telegram/bot/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            
            if (!data.ok) {
                this.showError('Неверный токен или бот недоступен');
                return;
            }

            const botName = data.result.first_name || data.result.username;
            
            // Save to Supabase if user is authenticated
            if (window.gymnastikaAuth && window.gymnastikaAuth.isAuthenticated()) {
                await window.gymnastikaAuth.saveTelegramConnection(token, botName, chatId);
                console.log('✅ Telegram connection saved to Supabase');
            } else {
                // Fallback to localStorage for non-authenticated users
                localStorage.setItem('telegramBotToken', token);
                localStorage.setItem('telegramBotName', botName);
                localStorage.setItem('telegramChatId', chatId);
            }

            // Update settings object
            this.settings.telegramBotToken = token;
            this.settings.telegramBotName = botName;
            this.settings.telegramChatId = chatId;
            
            // Update UI status
            this.updateTelegramConnectionStatus(true, botName);
            
            // Show notification settings after successful save
            this.updateNotificationSettingsVisibility();
            
            this.showSuccess(`Telegram бот подключен: ${botName}`);
            
        } catch (error) {
            console.error('❌ Save Telegram settings error:', error);
            this.showError('Ошибка при сохранении настроек Telegram');
        }
    }

    // Test Telegram connection
    async testTelegramConnection() {
        const token = this.settings.telegramBotToken;
        if (!token) {
            this.showError('Введите токен Telegram бота');
            return;
        }

        try {
            const response = await fetch('/api/telegram/bot/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            
            if (data.ok) {
                this.showSuccess(`Соединение установлено! Бот: ${data.result.first_name}`);
                this.updateTelegramConnectionStatus(true, data.result.first_name);
            } else {
                this.showError('Неверный токен или бот недоступен');
                this.updateTelegramConnectionStatus(false);
            }
        } catch (error) {
            console.error('❌ Telegram test error:', error);
            this.showError('Ошибка подключения к Telegram API');
            this.updateTelegramConnectionStatus(false);
        }
    }

    // Test Telegram connection with dynamic button status indication
    async testTelegramConnectionDynamic() {
        const token = this.settings.telegramBotToken || document.getElementById('telegramBotToken')?.value;
        const dynamicTestBtn = document.getElementById('dynamicTestConnection');
        
        if (!token) {
            this.showError('Введите токен Telegram бота');
            return;
        }

        if (!dynamicTestBtn) return;

        // Set loading state
        dynamicTestBtn.setAttribute('data-status', 'loading');
        dynamicTestBtn.querySelector('.test-text').textContent = 'Тестирование...';

        try {
            const response = await fetch('/api/telegram/bot/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            
            if (data.ok) {
                // Success state
                dynamicTestBtn.setAttribute('data-status', 'success');
                dynamicTestBtn.querySelector('.test-text').textContent = `Успешно: ${data.result.first_name}`;
                this.showSuccess(`Соединение установлено! Бот: ${data.result.first_name}`);
                this.updateTelegramConnectionStatus(true, data.result.first_name);
            } else {
                // Error state
                dynamicTestBtn.setAttribute('data-status', 'error');
                dynamicTestBtn.querySelector('.test-text').textContent = 'Неверный токен';
                this.showError('Неверный токен или бот недоступен');
                this.updateTelegramConnectionStatus(false);
            }
        } catch (error) {
            console.error('❌ Telegram test error:', error);
            // Error state
            dynamicTestBtn.setAttribute('data-status', 'error');
            dynamicTestBtn.querySelector('.test-text').textContent = 'Ошибка подключения';
            this.showError('Ошибка подключения к Telegram API');
            this.updateTelegramConnectionStatus(false);
        }

        // Reset to default state after 3 seconds
        setTimeout(() => {
            dynamicTestBtn.setAttribute('data-status', 'default');
            dynamicTestBtn.querySelector('.test-text').textContent = 'Тест подключения';
        }, 3000);
    }

    // Validate Telegram token format
    validateTelegramToken(token) {
        // Telegram bot token format: nnnnnnnnnn:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        const tokenPattern = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
        return tokenPattern.test(token);
    }
    
    // Validate Telegram Chat ID format
    validateTelegramChatId(chatId) {
        if (!chatId || chatId.trim() === '') {
            return false;
        }
        
        chatId = chatId.trim();
        
        // Valid formats:
        // 1. User ID: positive number (123456789)
        // 2. Group ID: negative number (-1001234567890)  
        // 3. Channel username: @channel_name
        const userIdPattern = /^\d{5,12}$/;           // User ID: 5-12 digits
        const groupIdPattern = /^-\d{10,13}$/;        // Group ID: negative, 10-13 digits
        const channelPattern = /^@[a-zA-Z0-9_]{5,32}$/; // Channel: @username, 5-32 chars
        
        return userIdPattern.test(chatId) || 
               groupIdPattern.test(chatId) || 
               channelPattern.test(chatId);
    }

    // Bind Telegram settings events
    bindTelegramSettings() {
        const saveBtn = document.getElementById('saveTelegramSettings');
        const testBtn = document.getElementById('testTelegramConnection');
        const tokenInput = document.getElementById('telegramBotToken');
        const chatIdInput = document.getElementById('telegramChatId');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTelegramSettings());
        }

        if (testBtn) {
            testBtn.addEventListener('click', () => this.testTelegramConnection());
        }

        if (tokenInput) {
            // Remove readonly on focus/click to prevent autofill issues
            tokenInput.addEventListener('focus', (e) => {
                e.target.removeAttribute('readonly');
            });
            
            tokenInput.addEventListener('click', (e) => {
                e.target.removeAttribute('readonly');
            });
            
            tokenInput.addEventListener('input', (e) => {
                const token = e.target.value;
                const isValid = this.validateTelegramToken(token);
                
                // Update settings object with current token value
                this.settings.telegramBotToken = token;
                
                if (token && !isValid) {
                    e.target.classList.add('invalid');
                } else {
                    e.target.classList.remove('invalid');
                }
                
                // Show/hide dynamic test button based on input
                const testWrapper = document.getElementById('testConnectionWrapper');
                if (testWrapper) {
                    if (token.trim().length > 0) {
                        testWrapper.style.display = 'block';
                    } else {
                        testWrapper.style.display = 'none';
                        // Reset button state when hiding
                        const testBtn = document.getElementById('dynamicTestConnection');
                        if (testBtn) {
                            testBtn.setAttribute('data-status', 'default');
                            testBtn.querySelector('.test-text').textContent = 'Тест подключения';
                        }
                    }
                }
            });
        }

        // Bind ChatID input events
        if (chatIdInput) {
            chatIdInput.addEventListener('input', (e) => {
                const chatId = e.target.value.trim();
                const isValid = this.validateTelegramChatId(chatId);
                
                // Update settings object with current ChatID value
                this.settings.telegramChatId = chatId;
                
                // Visual validation feedback
                if (chatId && !isValid) {
                    e.target.classList.add('invalid');
                } else {
                    e.target.classList.remove('invalid');
                }
                
                console.log('💬 ChatID updated:', chatId || '(empty)', isValid ? '✅' : '❌');
            });
        }

        // Bind toggle password visibility switch
        const toggleSwitch = document.getElementById('toggleTokenVisibility');
        if (toggleSwitch && tokenInput) {
            toggleSwitch.addEventListener('click', () => {
                const isPassword = tokenInput.type === 'password';
                tokenInput.type = isPassword ? 'text' : 'password';
                
                // Update toggle switch appearance based on current state
                if (tokenInput.type === 'text') {
                    // Password is visible, switch ON
                    toggleSwitch.classList.add('active');
                } else {
                    // Password is hidden, switch OFF
                    toggleSwitch.classList.remove('active');
                }
            });
        }
        
        // Bind dynamic test connection button
        const dynamicTestBtn = document.getElementById('dynamicTestConnection');
        if (dynamicTestBtn) {
            dynamicTestBtn.addEventListener('click', () => this.testTelegramConnectionDynamic());
        }
        
        // Bind notification settings toggle
        this.bindNotificationSettings();
    }

    // Bind notification settings events
    bindNotificationSettings() {
        // Bind parsing notification toggle
        const parseNotificationToggle = document.getElementById('parseNotificationToggle');
        if (parseNotificationToggle) {
            parseNotificationToggle.addEventListener('click', () => {
                const isActive = parseNotificationToggle.classList.contains('active');
                
                // Toggle active state
                if (isActive) {
                    parseNotificationToggle.classList.remove('active');
                    console.log('📱 Parse notifications disabled');
                } else {
                    parseNotificationToggle.classList.add('active');
                    console.log('📱 Parse notifications enabled');
                }
                
                // Save notification preference and show toast
                this.saveNotificationPreference('parseNotifications', !isActive);
                
                // Show success toast notification
                const settingName = !isActive ? 'включены' : 'отключены';
                this.showSuccess(`Уведомления парсинга ${settingName}`);
            });
        }
        
        // Bind test notification button
        const testNotificationBtn = document.getElementById('testNotificationBtn');
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('click', () => this.sendTestNotification());
        }
    }

    // Save notification preference (placeholder)
    saveNotificationPreference(key, value) {
        // Store in localStorage as placeholder
        localStorage.setItem(`telegram_${key}`, value);
        console.log(`💾 Notification preference saved: ${key} = ${value}`);
    }

    // Show success message
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Show error message
    showError(message) {
        this.showNotification(message, 'error');
    }

    // Show toast notification (alias for showNotification)
    showToast(message, type) {
        this.showNotification(message, type);
    }

    // Show notification using toast system
    showNotification(titleOrMessage, messageOrType, type) {
        // Handle both 2-param and 3-param calls
        let title, message, notificationType;

        if (type !== undefined) {
            // 3 parameters: title, message, type
            title = titleOrMessage;
            message = messageOrType;
            notificationType = type;
        } else {
            // 2 parameters: message, type
            title = null;
            message = titleOrMessage;
            notificationType = messageOrType;
        }

        // Get toast container
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${notificationType}`;

        // Create toast content with icon
        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';

        // Create icon
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.textContent = notificationType === 'success' ? '✓' : notificationType === 'error' ? '✕' : 'i';

        // Create message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'toast-message';

        // Add title if provided
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.style.fontWeight = 'bold';
            titleEl.style.marginBottom = '4px';
            titleEl.textContent = title;
            messageContainer.appendChild(titleEl);
        }

        // Add message
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageContainer.appendChild(messageEl);

        // Assemble toast
        toastContent.appendChild(icon);
        toastContent.appendChild(messageContainer);
        toast.appendChild(toastContent);
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Hide toast after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    // Send Telegram parsing completion notification
    async sendTelegramParsingNotification(data) {
        try {
            // Check if parsing notifications are enabled
            const notificationsEnabled = localStorage.getItem('telegram_parseNotifications') === 'true';
            console.log('📱 Notification settings check:', {
                notificationsEnabled,
                hasToken: !!this.settings.telegramBotToken,
                hasChatId: !!this.settings.telegramChatId,
                chatId: this.settings.telegramChatId
            });
            
            if (!notificationsEnabled) {
                console.log('📱 Telegram parsing notifications are disabled - enable them in settings');
                return;
            }

            // Check if Telegram bot is configured (both token and ChatID required)
            if (!this.settings.telegramBotToken) {
                console.log('📱 Telegram bot token not configured - skipping notification');
                return;
            }
            
            if (!this.settings.telegramChatId) {
                console.log('📱 Telegram Chat ID not configured - skipping notification');
                return;
            }
            
            const targetChatId = this.settings.telegramChatId;
            console.log('📱 Using target chat ID:', targetChatId);

            console.log('📱 Sending Telegram parsing completion notification...');

            // Format notification message
            const message = this.formatTelegramNotificationMessage(data);

            // Send notification to Telegram
            const response = await fetch('/api/telegram/bot/sendMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: this.settings.telegramBotToken,
                    chatId: targetChatId,
                    message: message,
                    parseMode: 'HTML'
                })
            });

            if (!response.ok) {
                throw new Error(`Telegram API error: ${response.status}`);
            }

            const result = await response.json();
            if (result.ok) {
                console.log('✅ Telegram notification sent successfully');
            } else {
                console.error('❌ Telegram notification failed:', result.description);
            }

        } catch (error) {
            console.error('❌ Failed to send Telegram notification:', error);
        }
    }

    // Format Telegram notification message
    formatTelegramNotificationMessage(data) {
        const {
            originalQuery,
            taskName,
            queryInfo,
            results,
            totalResultsWithContact,
            timestamp
        } = data;

        // Extract AI generated queries (first 3)
        const aiQueries = queryInfo?.queries ? queryInfo.queries.slice(0, 3) : [];
        const resultCount = results?.length || 0;
        const emailCount = results?.filter(r => r.email).length || 0;

        // Format date
        const date = new Date(timestamp || Date.now());
        const formattedDate = date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Create beautiful HTML message
        let message = `🎉 <b>Парсинг завершен успешно!</b>\n\n`;
        
        message += `📋 <b>Название задачи:</b> ${taskName || 'Без названия'}\n`;
        message += `🔍 <b>Ваш запрос:</b> ${originalQuery}\n\n`;
        
        message += `🤖 <b>ИИ сгенерировал запросы:</b>\n`;
        if (aiQueries.length > 0) {
            aiQueries.forEach((query, index) => {
                message += `   ${index + 1}. "${query}"\n`;
            });
        } else {
            message += `   Информация недоступна\n`;
        }
        
        message += `\n📊 <b>Результаты поиска:</b>\n`;
        message += `   • Всего найдено: <b>${resultCount}</b> организаций\n`;
        message += `   • С email адресами: <b>${emailCount}</b> контактов\n`;
        message += `   • Добавлено в базу: <b>${resultCount}</b> записей\n\n`;
        
        message += `🕐 <b>Время завершения:</b> ${formattedDate}\n\n`;
        message += `✅ Все данные успешно сохранены в вашу базу данных!`;

        return message;
    }

    // Send test notification with sample data
    async sendTestNotification() {
        try {
            console.log('🧪 Testing notification system...');
            
            // Validate required settings
            const tokenInput = document.getElementById('telegramBotToken');
            const chatIdInput = document.getElementById('telegramChatId');
            const token = tokenInput?.value || this.settings.telegramBotToken;
            const chatId = chatIdInput?.value || this.settings.telegramChatId;
            
            // Check if all required fields are filled
            if (!token) {
                this.showError('Введите API Token бота перед тестированием');
                tokenInput?.focus();
                return;
            }
            
            if (!chatId) {
                this.showError('Введите Chat ID перед тестированием');
                chatIdInput?.focus();
                return;
            }
            
            // Check if settings are saved (current values match stored values)
            const settingsChanged = token !== this.settings.telegramBotToken || 
                                  chatId !== this.settings.telegramChatId;
            
            if (settingsChanged) {
                this.showError('Сначала сохраните настройки, затем тестируйте уведомления');
                return;
            }
            
            // Check if notifications are enabled
            const notificationsEnabled = localStorage.getItem('telegram_parseNotifications') === 'true';
            if (!notificationsEnabled) {
                this.showError('Включите уведомления парсинга перед тестированием');
                return;
            }
            
            // Create sample test data
            const testNotificationData = {
                originalQuery: "гимнастика центры Дубай (тест)",
                taskName: `Тестовое уведомление ${new Date().toLocaleTimeString()}`,
                queryInfo: [
                    { query: "гимнастика центры Дубай ОАЭ", language: "ru", region: "AE" },
                    { query: "художественная гимнастика Дубай", language: "ru", region: "AE" },
                    { query: "тренировки гимнастика Дубай", language: "ru", region: "AE" }
                ],
                results: [
                    { email: "test1@gymnastic.ae" },
                    { email: "test2@dances.ae" },
                    { email: null },
                    { email: "test3@sports.ae" },
                    { email: null }
                ],
                timestamp: new Date().toISOString()
            };
            
            // Disable the button and show loading state
            const testBtn = document.getElementById('testNotificationBtn');
            if (testBtn) {
                testBtn.disabled = true;
                testBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="animate-spin">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                    </svg>
                    Отправка...
                `;
            }
            
            // Send test notification using existing notification system
            await this.sendTelegramParsingNotification(testNotificationData);
            
            // Show success message
            this.showSuccess('Тестовое уведомление отправлено!');
            console.log('✅ Test notification sent successfully');
            
        } catch (error) {
            console.error('❌ Test notification failed:', error);
            this.showError(`Ошибка отправки тестового уведомления: ${error.message}`);
        } finally {
            // Restore button state
            const testBtn = document.getElementById('testNotificationBtn');
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    Тест уведомлений
                `;
            }
        }
    }

    // Handle Google OAuth connection
    async handleGoogleConnect() {
        try {
            console.log('🔗 Starting Google OAuth connection...');
            
            // Initialize Google OAuth client if not already done
            if (!window.googleOAuth) {
                console.log('🔧 Initializing Google OAuth client...');
                window.googleOAuth = new GoogleOAuthHybrid();
                await window.googleOAuth.initialize();
            }
            
            // Ensure current user is set (fallback to session check)
            if (!this.currentUser) {
                console.log('⚠️ Current user not set, checking session...');
                const { data: { session }, error } = await this.supabase.auth.getSession();
                if (error) {
                    throw new Error(`Authentication error: ${error.message}`);
                }
                if (!session) {
                    throw new Error('Пользователь не авторизован. Пожалуйста, войдите в систему.');
                }
                this.currentUser = session.user;
                console.log('✅ Current user loaded from session');
            }
            
            // Set current user for OAuth process
            window.googleOAuth.setUser(this.currentUser);
            
            // Start OAuth authentication
            console.log('🚀 Starting OAuth authentication...');
            const result = await window.googleOAuth.authenticate();
            
            if (result.success) {
                console.log('✅ Google OAuth initiated successfully');
                // The user will be redirected to Google for authentication
                // The callback will be handled by the OAuth client
            }
            
        } catch (error) {
            console.error('❌ Google OAuth connection error:', error);
            this.showError(`Ошибка подключения к Google: ${error.message}`);
        }
    }

    // Check Google OAuth connection status
    async checkGoogleConnectionStatus() {
        try {
            console.log('🔍 Checking Google connection status...');
            
            if (!this.currentUser) {
                console.log('❌ No current user, cannot check Google connection');
                return;
            }

            // Initialize Google OAuth client if not already done
            if (!window.googleOAuth) {
                window.googleOAuth = new GoogleOAuthHybrid();
                await window.googleOAuth.initialize();
            }

            // Check if user has active Google integration
            const isConnected = await window.googleOAuth.isConnected(this.currentUser.id);
            
            if (isConnected) {
                console.log('✅ Google account is connected');
                const integration = await window.googleOAuth.getIntegration(this.currentUser.id);
                this.updateGoogleConnectionUI(true, integration);
            } else {
                console.log('❌ Google account is not connected');
                this.updateGoogleConnectionUI(false);
            }
            
        } catch (error) {
            console.error('❌ Error checking Google connection status:', error);
            this.updateGoogleConnectionUI(false);
        }
    }

    // Update Google connection UI
    updateGoogleConnectionUI(isConnected, integration = null) {
        try {
            console.log('🎨 Updating Google connection UI, connected:', isConnected);

            // Update status elements
            const statusText = document.getElementById('googleStatusText');
            const disconnectBtn = document.getElementById('disconnectGoogleBtn');
            
            // Update states
            const notConnectedState = document.getElementById('notConnectedState');
            const connectedState = document.getElementById('connectedState');
            const featuresSection = document.querySelector('.features-section');

            if (isConnected && integration) {
                // Update status to connected
                if (statusText) {
                    statusText.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <circle cx="12" cy="12" r="10" fill="currentColor"/>
                        </svg>
                        Подключено: ${integration.connected_email}
                    `;
                    // Set the color on the parent element since SVG uses currentColor
                    statusText.style.setProperty('color', '#10b981', 'important');
                }
                
                // Show disconnect button
                if (disconnectBtn) {
                    disconnectBtn.style.display = 'inline-flex';
                    disconnectBtn.onclick = () => this.disconnectGoogle();
                }

                // Switch to connected state
                if (notConnectedState) notConnectedState.classList.remove('active');
                if (connectedState) connectedState.classList.add('active');
                
                // Hide features section when connected
                if (featuresSection) featuresSection.style.display = 'none';

                console.log('✅ UI updated to connected state');
            } else {
                // Update status to not connected
                if (statusText) {
                    statusText.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <circle cx="12" cy="12" r="10" fill="currentColor"/>
                        </svg>
                        Не подключено
                    `;
                    // Set the color on the parent element since SVG uses currentColor
                    statusText.style.setProperty('color', '#ef4444', 'important');
                }

                // Hide disconnect button
                if (disconnectBtn) {
                    disconnectBtn.style.display = 'none';
                }

                // Switch to not connected state
                if (notConnectedState) notConnectedState.classList.add('active');
                if (connectedState) connectedState.classList.remove('active');
                
                // Show features section when not connected
                if (featuresSection) featuresSection.style.display = 'block';

                console.log('✅ UI updated to not connected state');
            }

        } catch (error) {
            console.error('❌ Error updating Google connection UI:', error);
        }
    }

    // Update notification settings visibility based on token and ChatID validation
    updateNotificationSettingsVisibility() {
        try {
            const tokenInput = document.getElementById('telegramBotToken');
            const chatIdInput = document.getElementById('telegramChatId');
            const setupForm = document.getElementById('telegramSetupForm');
            const notificationSettings = document.getElementById('telegramNotificationSettings');
            
            const token = tokenInput?.value || this.settings.telegramBotToken;
            const chatId = chatIdInput?.value || this.settings.telegramChatId;
            
            const hasValidToken = token && this.validateTelegramToken(token);
            const hasValidChatId = chatId && this.validateTelegramChatId(chatId);
            
            // Show notifications only if BOTH token and ChatID are valid
            const shouldShowNotifications = hasValidToken && hasValidChatId;
            
            if (setupForm) {
                setupForm.style.display = shouldShowNotifications ? 'none' : 'block';
            }
            if (notificationSettings) {
                notificationSettings.style.display = shouldShowNotifications ? 'block' : 'none';
            }
            
            console.log(`🎨 Notification visibility: ${shouldShowNotifications ? 'SHOW' : 'HIDE'} (token: ${hasValidToken ? '✅' : '❌'}, chatId: ${hasValidChatId ? '✅' : '❌'})`);
            
        } catch (error) {
            console.error('❌ Error updating notification settings visibility:', error);
        }
    }

    // Update Telegram connection status
    updateTelegramConnectionStatus(isConnected, botName = null) {
        try {
            console.log('🎨 Updating Telegram connection status, connected:', isConnected);

            const statusText = document.getElementById('telegramStatusText');
            const disconnectBtn = document.getElementById('disconnectTelegramBtn');

            if (isConnected && botName) {
                // Update status to connected
                if (statusText) {
                    statusText.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <circle cx="12" cy="12" r="10" fill="currentColor"/>
                        </svg>
                        Подключен: ${botName}
                    `;
                    statusText.style.color = '#10b981';
                }
                
                // Show disconnect button
                if (disconnectBtn) {
                    disconnectBtn.style.display = 'inline-flex';
                    disconnectBtn.onclick = () => this.disconnectTelegram();
                }

                console.log('✅ Telegram bot connected:', botName);
            } else {
                // Update status to not connected
                if (statusText) {
                    statusText.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <circle cx="12" cy="12" r="10" fill="currentColor"/>
                        </svg>
                        Не подключен
                    `;
                    statusText.style.color = '#ef4444';
                }

                // Hide disconnect button
                if (disconnectBtn) {
                    disconnectBtn.style.display = 'none';
                }

                console.log('✅ Telegram bot disconnected');
            }

        } catch (error) {
            console.error('❌ Error updating Telegram connection status:', error);
        }
    }

    // Disconnect Telegram bot
    async disconnectTelegram() {
        try {
            // Remove from Supabase if user is authenticated
            if (window.gymnastikaAuth && window.gymnastikaAuth.isAuthenticated()) {
                await window.gymnastikaAuth.removeTelegramConnection();
                console.log('✅ Telegram connection removed from Supabase');
            } else {
                // Remove from localStorage for non-authenticated users
                localStorage.removeItem('telegramBotToken');
                localStorage.removeItem('telegramBotName');
                localStorage.removeItem('telegramChatId');
            }
            
            // Clear settings object
            this.settings.telegramBotToken = '';
            this.settings.telegramBotName = '';
            this.settings.telegramChatId = '';
            
            // Clear input fields
            const tokenInput = document.getElementById('telegramBotToken');
            if (tokenInput) {
                tokenInput.value = '';
            }
            
            const chatIdInput = document.getElementById('telegramChatId');
            if (chatIdInput) {
                chatIdInput.value = '';
            }
            
            // Update status UI
            this.updateTelegramConnectionStatus(false);
            
            this.showSuccess('Telegram бот отключен');
        } catch (error) {
            console.error('❌ Error disconnecting Telegram:', error);
            this.showError('Ошибка при отключении Telegram бота');
        }
    }

    // 📅 Sort contacts by date (newest first by default)
    sortContactsByDate(contacts, direction = 'desc') {
        console.log(`🔄 Sorting contacts by date: ${direction} (${direction === 'desc' ? 'newest first' : 'oldest first'})`);
        
        return contacts.sort((a, b) => {
            // Get dates, fallback to created_at or current date
            const dateA = new Date(a.parsing_timestamp || a.created_at || new Date());
            const dateB = new Date(b.parsing_timestamp || b.created_at || new Date());
            
            // Sort based on direction
            if (direction === 'desc') {
                return dateB - dateA; // Newest first (descending)
            } else {
                return dateA - dateB; // Oldest first (ascending) 
            }
        });
    }

    // 📅 Toggle date sort direction (desc ⇄ asc)
    toggleDateSort() {
        this.dateSortDirection = this.dateSortDirection === 'desc' ? 'asc' : 'desc';
        console.log(`🔄 Date sort toggled to: ${this.dateSortDirection} (${this.dateSortDirection === 'desc' ? 'newest first' : 'oldest first'})`);
        
        // Update the sort icon in the UI
        const sortIcon = document.getElementById('dateSortIcon');
        if (sortIcon) {
            sortIcon.textContent = this.dateSortDirection === 'desc' ? '↓' : '↑';
        }
    }

    // Disconnect Google account
    async disconnectGoogle() {
        try {
            console.log('🔌 Disconnecting Google account...');
            
            if (!this.currentUser) {
                throw new Error('No current user found');
            }

            if (!window.googleOAuth) {
                window.googleOAuth = new GoogleOAuthHybrid();
                await window.googleOAuth.initialize();
            }

            await window.googleOAuth.disconnect(this.currentUser.id);
            this.updateGoogleConnectionUI(false);
            
            console.log('✅ Google account disconnected successfully');
            this.showNotification('Google аккаунт отключен', 'success');
            
        } catch (error) {
            console.error('❌ Error disconnecting Google account:', error);
            this.showError(`Ошибка отключения Google: ${error.message}`);
        }
    }
    
    // Start Google Drive upload for large files with progress tracking
    async startGoogleDriveUpload(file, fileIndex, fileInfo) {
        try {
            console.log(`📤 Starting Google Drive upload for ${file.name}`);
            
            // Initialize Google Drive client if needed
            if (!this.googleDriveClient.isAuthenticated) {
                await this.googleDriveClient.initialize();
            }
            
            // Upload file with progress callback
            const uploadResult = await this.googleDriveClient.uploadFile(file, this.currentUser.id, {
                onProgress: (progressData) => {
                    console.log(`📊 Upload progress: ${progressData.progress}% for ${progressData.fileName}`);
                    
                    // Update file info with progress
                    fileInfo.driveUploadProgress = progressData.progress;
                    this.updateFileProgressDisplay(fileIndex, progressData.progress);
                }
            });
            
            // Update file info with Google Drive data
            fileInfo.uploadStatus = 'completed';
            fileInfo.driveFileId = uploadResult.fileId;
            fileInfo.driveUrl = uploadResult.driveUrl;
            fileInfo.driveShareUrl = uploadResult.shareUrl;
            fileInfo.driveUploadProgress = 100;
            
            // Update UI to show completed upload
            this.updateFileDisplayAfterDriveUpload(fileIndex, uploadResult);
            
            console.log(`✅ Google Drive upload completed for ${file.name}`);
            this.showToast(`📤 Файл "${file.name}" загружен на Google Drive`, 'success');
            
        } catch (error) {
            console.error(`❌ Google Drive upload failed for ${file.name}:`, error);
            fileInfo.uploadStatus = 'failed';
            fileInfo.uploadError = error.message;

            // Trigger validation since upload status changed
            this.validateEmailForm();
            
            // Update UI to show error
            this.updateFileDisplayAfterError(fileIndex, error);
            this.showToast(`Ошибка загрузки "${file.name}" на Google Drive: ${error.message}`, 'error');
        }
    }
    
    // Show attachments container
    showAttachmentsContainer(attachmentsList) {
        console.log('🎨 showAttachmentsContainer called with:', {
            attachmentsList: !!attachmentsList,
            hasChildren: attachmentsList?.children?.length || 0
        });
        
        // Show the has-files class to display attachments container
        const emailForm = document.querySelector('.email-compose-form');
        console.log('🔍 Found email form:', !!emailForm);
        
        if (emailForm) {
            emailForm.classList.add('has-files');
            console.log('👁️ Added has-files class to show attachments container');
            
            // Force display of attachments list
            const attachmentsListElement = emailForm.querySelector('.attachments-list');
            console.log('🔍 Found attachments list element:', !!attachmentsListElement);
            
            if (attachmentsListElement) {
                attachmentsListElement.style.display = 'block';
                console.log('📋 Set attachments list display to block');
            }
        } else {
            console.error('❌ Cannot find .email-form element');
        }
        
        // Show controls if they exist
        const controls = document.querySelector('.attachments-controls');
        if (controls) {
            controls.style.display = 'flex';
            console.log('🎛️ Shown attachments controls');
        }
        
        // Force container visibility
        if (attachmentsList) {
            attachmentsList.style.display = 'block';
            attachmentsList.style.visibility = 'visible';
            console.log('📦 Forced attachments list visibility');
        }
    }
    
    // Update file progress display during Google Drive upload
    updateFileProgressDisplay(fileIndex, progress) {
        console.log(`📊 updateFileProgressDisplay called: fileIndex=${fileIndex}, progress=${progress}%`);

        const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
        if (attachmentItem) {
            console.log('✅ Found attachment item for fileIndex:', fileIndex);

            // Find existing progress elements
            const progressContainer = attachmentItem.querySelector('.upload-progress-container');
            const progressFill = attachmentItem.querySelector('.progress-fill');
            const progressText = attachmentItem.querySelector('.progress-text');

            console.log('🔍 Progress elements found:', {
                container: !!progressContainer,
                fill: !!progressFill,
                text: !!progressText
            });

            // Update existing progress bar
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
                console.log(`🔄 Updated progress fill to ${progress}%`);
            }

            if (progressText) {
                progressText.textContent = `${progress}%`;
                console.log(`🔄 Updated progress text to ${progress}%`);
            }

            // Update storage type text during upload
            const storageType = attachmentItem.querySelector('.storage-type');
            if (storageType && progress < 100) {
                storageType.textContent = `Загружается... ${progress}%`;
                console.log(`🔄 Updated storage type to "Загружается... ${progress}%"`);
            }

        } else {
            console.error('❌ Could not find attachment item for fileIndex:', fileIndex);
        }
    }
    
    // Update file display after successful Google Drive upload
    updateFileDisplayAfterDriveUpload(fileIndex, uploadResult) {
        console.log('🔄 updateFileDisplayAfterDriveUpload called:', { fileIndex, uploadResult });

        // CRITICAL: Mark file as needing permission setup since it's now on Google Drive
        const fileInfo = this.currentEmailCampaign.attachments[fileIndex];
        if (fileInfo) {
            fileInfo.needsPermissionSetup = true;
            fileInfo.permissionStatus = 'pending';
            console.log('🔐 Marked Google Drive file as needing permissions:', fileInfo.originalName);

            // Trigger validation since this file now needs permissions
            this.validateEmailForm();
        }
        
        const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
        console.log('📋 Found attachment item:', !!attachmentItem);
        
        if (attachmentItem) {
            // Remove upload progress container completely
            const progressContainer = attachmentItem.querySelector('.upload-progress-container');
            if (progressContainer) {
                progressContainer.remove();
                console.log('🗑️ Removed upload progress container');
            }
            
            // Update attachment icon to cloud
            const attachmentIcon = attachmentItem.querySelector('.attachment-icon');
            if (attachmentIcon) {
                attachmentIcon.textContent = '☁️';
                attachmentIcon.className = 'attachment-icon status-drive-completed';
                attachmentIcon.title = 'Загружено на Google Drive';
                console.log('☁️ Updated attachment icon to cloud');
            }
            
            // Update or create Google Drive button to be functional after upload
            let googleDriveBtn = attachmentItem.querySelector('.google-drive-button');
            if (googleDriveBtn) {
                // Remove the old event listener and add new one with actual file ID
                const newGoogleDriveBtn = googleDriveBtn.cloneNode(true);
                googleDriveBtn.parentNode.replaceChild(newGoogleDriveBtn, googleDriveBtn);
                googleDriveBtn = newGoogleDriveBtn;

                console.log('✅ Updated existing Google Drive button');
            } else {
                // Create Google Drive button if it didn't exist (for files originally <25MB)
                const actionsContainer = attachmentItem.querySelector('.attachment-actions');
                if (actionsContainer) {
                    const googleDriveButtonHTML = `<button type="button" class="google-drive-button drive-completed" data-index="${fileIndex}" title="Управление разрешениями Google Drive">
                        <span class="drive-text">Google Drive</span>
                        <span class="drive-warning">❗</span>
                    </button>`;
                    actionsContainer.insertAdjacentHTML('afterbegin', googleDriveButtonHTML);
                    googleDriveBtn = actionsContainer.querySelector('.google-drive-button');

                    console.log('✅ Created new Google Drive button for uploaded file');
                }
            }

            // Add permission management click handler with real file ID
            if (googleDriveBtn) {
                googleDriveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('🔧 Google Drive button clicked for uploaded fileId:', uploadResult.fileId);
                    this.showDrivePermissionsModal(uploadResult.fileId, fileIndex);
                });

                // Update button appearance to indicate it's now functional
                googleDriveBtn.classList.add('drive-completed');

                console.log('✅ Google Drive button is now functional for permissions');
            }

            // Clear storage type text since Google Drive info is now in the button
            const storageType = attachmentItem.querySelector('.storage-type');
            if (storageType) {
                storageType.textContent = 'Загружено';
                storageType.classList.add('upload-completed');
                console.log('📝 Updated storage type to show completion');
            }
            
            // Store Drive file info for later use
            attachmentItem.setAttribute('data-drive-file-id', uploadResult.fileId);
            attachmentItem.setAttribute('data-drive-url', uploadResult.driveUrl);

            // Debug: Check if remove button still exists
            const removeButton = attachmentItem.querySelector('.remove-attachment');
            const attachmentActions = attachmentItem.querySelector('.attachment-actions');
            console.log('🔍 After update - HTML structure check:', {
                hasRemoveButton: !!removeButton,
                hasAttachmentActions: !!attachmentActions,
                attachmentHTML: attachmentItem.innerHTML.length > 500 ?
                    attachmentItem.innerHTML.substring(0, 500) + '...' : attachmentItem.innerHTML
            });

            console.log('✅ File display updated successfully after Google Drive upload');
        } else {
            console.error('❌ Could not find attachment item for fileIndex:', fileIndex);
        }
    }
    
    // Show Google Drive permissions modal
    showDrivePermissionsModal(fileId, fileIndex) {
        console.log('📋 Opening Drive permissions modal for fileId:', fileId);

        // Get current attachment data to check existing permissions
        const attachment = this.currentEmailCampaign.attachments[fileIndex];
        const currentPermissionType = attachment?.permissionType || 'link'; // Default to 'link'
        const currentPermissionEmail = attachment?.permissionEmail || '';

        console.log('📊 Current permissions:', { permissionType: currentPermissionType, permissionEmail: currentPermissionEmail });

        // Create modal HTML
        const modalHTML = `
            <div id="drive-permissions-modal" class="modal-overlay">
                <div class="modal-content drive-permissions-modal" style="background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90vw; margin: auto; position: relative;">
                    <div class="modal-header" style="background: linear-gradient(135deg, var(--bg-white) 0%, var(--bg-lavender) 100%); padding: 1.5rem 2rem 1rem; border-bottom: 1px solid var(--border-light); border-radius: 12px 12px 0 0;">
                        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-dark); margin: 0;">🔐 Управление разрешениями Google Drive</h3>
                        <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer; position: absolute; top: 1rem; right: 1.5rem; transition: color 0.2s ease;">×</button>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem 2rem;">
                        <p style="margin-bottom: 1.5rem; color: var(--text-dark); font-weight: 500;">Выберите уровень доступа к файлу:</p>
                        <div class="permission-options" style="display: flex; flex-direction: column; gap: 1rem;">
                            <label class="permission-option" style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; padding: 1rem; border: 2px solid var(--border-light); border-radius: 8px; transition: all 0.2s ease; background: transparent;">
                                <input type="radio" name="permission" value="link" ${currentPermissionType === 'link' ? 'checked' : ''} style="margin-top: 0.25rem; transform: scale(1.2);">
                                <div style="flex: 1;">
                                    <div class="permission-label" style="font-weight: 600; color: var(--text-dark); margin-bottom: 0.25rem;">
                                        🔗 <strong>По ссылке</strong> - все, у кого есть ссылка, могут просматривать
                                    </div>
                                    <small style="color: var(--text-muted);">Файл доступен всем пользователям по ссылке</small>
                                </div>
                            </label>
                            <label class="permission-option" style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; padding: 1rem; border: 2px solid var(--border-light); border-radius: 8px; transition: all 0.2s ease; background: transparent;">
                                <input type="radio" name="permission" value="email" ${currentPermissionType === 'email' ? 'checked' : ''} style="margin-top: 0.25rem; transform: scale(1.2);">
                                <div style="flex: 1;">
                                    <div class="permission-label" style="font-weight: 600; color: var(--text-dark); margin-bottom: 0.25rem;">
                                        📧 <strong>Для конкретного email</strong> - доступ для определенного пользователя
                                    </div>
                                    <small style="color: var(--text-muted); display: block; margin-bottom: 0.5rem;">Доступ для указанных email адресов</small>
                                </div>
                            </label>
                        </div>
                        <div class="email-input" style="display: ${currentPermissionType === 'email' ? 'block' : 'none'}; margin-top: 1rem;">
                            <input type="email" id="permission-email" placeholder="Введите email адрес" class="form-control" value="${currentPermissionEmail}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-light); border-radius: 6px; font-size: 0.875rem; background: white;">
                        </div>
                    </div>
                    <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1.5rem 2rem; border-top: 1px solid var(--border-light); background: transparent;">
                        <button class="secondary-btn" onclick="this.closest('.modal-overlay').remove()" style="padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; background: var(--bg-light); color: var(--text-dark); border: 1px solid var(--border-light);">Отмена</button>
                        <button class="primary-btn" onclick="window.platform.applyDrivePermissions('${fileId}', ${fileIndex})" style="padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; background: var(--primary); color: white; border: none;">Применить</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Handle permission type change
        const permissionRadios = document.querySelectorAll('input[name="permission"]');
        const emailInput = document.querySelector('.email-input');
        const permissionOptions = document.querySelectorAll('.permission-option');

        // Add hover effects and initial selection styles
        permissionOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');

            // Set initial selected state
            if (radio.checked) {
                option.style.borderColor = 'var(--primary)';
                option.style.backgroundColor = 'var(--bg-lavender)';
            }

            // Add hover effects
            option.addEventListener('mouseenter', () => {
                if (!radio.checked) {
                    option.style.borderColor = 'var(--primary-light)';
                    option.style.backgroundColor = 'var(--bg-light)';
                }
            });

            option.addEventListener('mouseleave', () => {
                if (!radio.checked) {
                    option.style.borderColor = 'var(--border-light)';
                    option.style.backgroundColor = 'transparent';
                }
            });
        });

        permissionRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                // Update visual states for all options
                permissionOptions.forEach(option => {
                    const optionRadio = option.querySelector('input[type="radio"]');
                    if (optionRadio.checked) {
                        option.style.borderColor = 'var(--primary)';
                        option.style.backgroundColor = 'var(--bg-lavender)';
                    } else {
                        option.style.borderColor = 'var(--border-light)';
                        option.style.backgroundColor = 'transparent';
                    }
                });

                // Handle email input visibility
                if (radio.value === 'email') {
                    emailInput.style.display = 'block';
                    const emailField = emailInput.querySelector('input');
                    if (emailField) emailField.focus();
                } else {
                    emailInput.style.display = 'none';
                }
            });
        });
    }
    
    // Apply Google Drive permissions
    async applyDrivePermissions(fileId, fileIndex) {
        try {
            console.log('🔒 Applying Drive permissions for fileId:', fileId);
            
            const selectedPermission = document.querySelector('input[name="permission"]:checked').value;
            const emailAddress = document.getElementById('permission-email')?.value;
            
            console.log('📝 Permission settings:', { selectedPermission, emailAddress });
            
            let permissionOptions = {
                permissionType: selectedPermission
            };
            
            if (selectedPermission === 'email' && emailAddress) {
                permissionOptions.emailAddress = emailAddress;
            }
            
            // Call Google Drive client to set permissions
            await this.googleDriveClient.setFilePermissions(fileId, permissionOptions);

            // Save permissions in attachment data (similar to saveFilePermissions method)
            const attachment = this.currentEmailCampaign.attachments[fileIndex];
            if (attachment) {
                attachment.permissionType = selectedPermission;
                attachment.permissionStatus = 'granted';
                attachment.permissionEmail = selectedPermission === 'email' ? emailAddress : '';

                // Trigger validation since permission status changed
                this.validateEmailForm();

                console.log('💾 Permissions saved to attachment:', {
                    permissionType: attachment.permissionType,
                    permissionStatus: attachment.permissionStatus,
                    permissionEmail: attachment.permissionEmail
                });
            }

            // Update UI to show permission status - find Google Drive button
            const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
            if (attachmentItem) {
                const googleDriveBtn = attachmentItem.querySelector('.google-drive-button');
                if (googleDriveBtn) {
                    const driveWarning = googleDriveBtn.querySelector('.drive-warning');
                    if (driveWarning) {
                        driveWarning.textContent = '✓'; // Change from ❗ to ✓
                        driveWarning.style.color = 'white'; // White color for better contrast
                        driveWarning.style.fontSize = '16px'; // Make it bigger
                        driveWarning.style.fontWeight = 'bold'; // Make it bolder
                        driveWarning.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)'; // Add shadow for visibility
                        googleDriveBtn.title = `Google Drive: ${this.getPermissionDescription(selectedPermission, emailAddress)}`;
                        googleDriveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                        googleDriveBtn.style.color = 'white';
                        googleDriveBtn.style.border = '1px solid #28a745';

                        console.log('✅ Google Drive button updated with permission status');
                    }
                }
            }

            // Update send button state to check if all files have permissions

            // Close modal
            document.getElementById('drive-permissions-modal').remove();

            this.showToast('Разрешения Google Drive успешно обновлены', 'success');
            
        } catch (error) {
            console.error('❌ Error applying Drive permissions:', error);
            this.showToast(`Ошибка обновления разрешений: ${error.message}`, 'error');
        }
    }
    
    // Update file display after upload error
    updateFileDisplayAfterError(fileIndex, error) {
        const attachmentItem = document.querySelector(`[data-file-index="${fileIndex}"]`);
        if (attachmentItem) {
            // Remove progress bar
            const progressBar = attachmentItem.querySelector('.drive-progress-bar');
            if (progressBar) progressBar.remove();
            
            // Add error message
            const fileInfo = attachmentItem.querySelector('.file-info');
            if (fileInfo) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'upload-error';
                errorDiv.innerHTML = `<span class="error-text">❌ Ошибка загрузки: ${error.message}</span>`;
                fileInfo.appendChild(errorDiv);
            }
            
            // Update status icon
            const statusIcon = attachmentItem.querySelector('.file-icon');
            if (statusIcon) {
                statusIcon.textContent = '❌';
                statusIcon.classList.add('status-error');
            }
        }
    }
}

// Global platform instance
let platform = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Prevent double initialization
        if (window.platform) {
            console.log('⚠️ Platform already initialized, skipping duplicate init');
            return;
        }

        console.log('🌟 DOM loaded, initializing platform...');
        platform = new GymnastikaPlatform();
        await platform.init();

        // Make platform accessible globally after successful initialization
        window.platform = platform;
        console.log('✅ Platform exposed globally as window.platform');
        
        // Handle browser back/forward navigation
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && ['parsing', 'database', 'email', 'settings'].includes(hash)) {
                platform.showSection(hash);
            }
        });
        
        // Initialize section from URL hash
        const initialHash = window.location.hash.replace('#', '');
        if (initialHash && ['parsing', 'database', 'email', 'settings'].includes(initialHash)) {
            platform.showSection(initialHash);
        }
        
        // Global event listeners
        document.addEventListener('click', (e) => {
            // Close results modal when clicking outside
            if (e.target.id === 'resultsModal') {
                platform.closeResults();
            }
            
            // Close results modal when clicking close button
            if (e.target.classList.contains('close-modal')) {
                platform.closeResults();
            }
        });
        
    } catch (error) {
        console.error('❌ Platform initialization failed:', error);
    }
});

// Global functions for HTML onclick handlers
window.closeResults = () => {
    if (platform) {
        platform.closeResults();
    }
};// Force cache refresh - Mon Sep 29 22:05:49 +05 2025
