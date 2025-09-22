// GYMNASTIKA RG Club UAE - Main Platform Script
class GymnastikaPlatform {
    constructor() {
        this.currentSection = 'parsing';
        this.currentUser = null;
        this.apifyClient = null;
        this.openaiClient = null;
        this.pipelineOrchestrator = null;
        this.supabase = null;
        this.telegramSettingsBound = false;
        this.navigationBound = false;
        this.adaptiveLoader = null;
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

            // Start fast loading process (max 1.5 seconds)
            const loadingPromise = this.fastLoader.start();
            
            // Initialize components in parallel
            await this.initializeSystemComponents();
            
            // Wait for fast loading to complete
            await loadingPromise;

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
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const username = document.getElementById('registerUsername').value;
                const firstName = document.getElementById('firstName').value;
                const lastName = document.getElementById('lastName').value;
                const secretCode = document.getElementById('secretCode').value;
                
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

    // Register user
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

            // Use the auth client's register method
            const result = await window.gymnastikaAuth.register({
                email,
                password,
                username,
                firstName,
                lastName,
                secretCode
            });

            console.log('✅ Registration successful');
            if (result.needsConfirmation) {
                this.showSuccess('Регистрация успешна! Проверьте email для подтверждения.');
            } else {
                this.showSuccess('Регистрация и вход выполнены успешно!');
                // Auto-login on successful registration
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showError('Ошибка регистрации: ' + error.message);
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

            // Initialize Pipeline Orchestrator
            if (window.PipelineOrchestrator && this.apifyClient && this.openaiClient) {
                this.pipelineOrchestrator = new window.PipelineOrchestrator(
                    this.apifyClient,
                    this.openaiClient,
                    this.supabase
                );
                console.log('📊 Pipeline orchestrator initialized');
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
            
            // Initialize parsing form
            this.bindParsingForm();
            
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
            
            // Bind email form validation
            this.bindEmailForm();
            
            // Check Google connection status
            this.checkGoogleConnectionStatus();
            
            // Bind completion modal events
            this.bindCompletionModal();
            
            // Force hide completion modal on startup
            this.hideCompletionModal();
            
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
    showSection(sectionName) {
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
        this.loadSectionData(sectionName);
        
        // 🔧 FIX: Auto-activate default tabs when entering sections
        if (sectionName === 'parsing') {
            console.log('🔄 Auto-activating AI search tab for parsing section');
            // Small delay to ensure UI is ready
            setTimeout(() => {
                this.switchTab('ai-search');
            }, 100);
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
                default:
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

            // Get all parsing results grouped by task_name for user's original design
            const { data: results, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .order('parsing_timestamp', { ascending: false });

            console.log('📊 Background history sync result:', { data: results?.length, error: error });

            if (error) throw error;

            let freshHistoryData = [];
            if (results && results.length > 0) {
                console.log(`🔄 Background sync found ${results.length} parsing records`);
                
                // Group results by task_name (user's original design)
                const taskGroups = this.groupResultsByTaskName(results);
                console.log(`📊 Background sync grouped into ${taskGroups.length} tasks`);
                
                // Transform to format expected by displayHistory method
                freshHistoryData = taskGroups.map(group => ({
                    task_name: group.task_name,
                    search_query: group.original_query || 'Unknown Query',
                    total_results: group.total_results,
                    contacts_count: group.contacts_count,
                    latest_date: group.latest_date
                }));
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

    // View results for a specific task (user's original functionality)
    async viewTaskResults(taskName) {
        try {
            console.log(`👁 Viewing results for task: ${taskName}`);
            
            if (!this.supabase) {
                console.error('❌ Supabase client not available');
                return;
            }

            // Get all results for this task
            const { data: results, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .eq('task_name', taskName)
                .order('parsing_timestamp', { ascending: false });

            if (error) {
                console.error('❌ Error fetching task results:', error);
                this.showError('Ошибка загрузки результатов');
                return;
            }

            console.log(`🔍 Found ${results?.length || 0} results for task: ${taskName}`);

            if (results && results.length > 0) {
                this.viewResults(results);
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

            // Load all necessary fields for contacts
            console.log('🔍 Background sync loading contacts from Supabase...');
            const { data: contacts, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .limit(10);

            console.log('📊 Background contacts sync result:', { data: contacts?.length, error: error });

            if (error) throw error;

            let freshContactsData = [];
            if (contacts && contacts.length > 0) {
                console.log(`🔄 Background sync found ${contacts.length} contacts`);
                
                // Filter contacts that have email addresses
                const contactsWithEmail = contacts.filter(contact => 
                    contact.email && contact.email.trim() !== ''
                );
                
                console.log(`📧 Background sync: ${contactsWithEmail.length} contacts with email`);
                
                if (contactsWithEmail.length > 0) {
                    // Normalize contact data to ensure consistent field names
                    freshContactsData = contactsWithEmail.map(contact => ({
                        ...contact,
                        organization_name: contact.organization_name || 'Неизвестная организация',
                        description: contact.description || 'Описание отсутствует'
                    }));
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
            
            row.innerHTML = `
                <td class="date-cell">${formattedDate}<br>${formattedTime}</td>
                <td class="task-name-cell">${task.task_name || 'Без названия'}</td>
                <td class="query-cell">${task.search_query || 'Не указан'}</td>
                <td class="count-cell">${task.total_results || 0}</td>
                <td class="contacts-cell">${task.contacts_count || 0}</td>
                <td class="actions-cell">
                    <button class="btn-eye-original" onclick="platform.viewTaskResults('${task.task_name}')" title="Посмотреть результаты">👁</button>
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

    // View task results - shows modal with parsing results
    async viewTaskResults(taskName) {
        console.log('👁️ Viewing task results for:', taskName);
        
        try {
            if (!this.supabase) {
                console.error('❌ Supabase client not initialized');
                return;
            }

            // Load all results for this task
            const { data: results, error } = await this.supabase
                .from('parsing_results')
                .select('*')
                .eq('task_name', taskName)
                .order('parsing_timestamp', { ascending: false });

            if (error) throw error;

            if (!results || results.length === 0) {
                alert('Результаты не найдены для данной задачи');
                return;
            }

            console.log(`📊 Found ${results.length} results for task: ${taskName}`);
            this.showResultsModal(taskName, results);
            
        } catch (error) {
            console.error('❌ Error loading task results:', error);
            alert('Ошибка загрузки результатов');
        }
    }

    // Show task menu - context menu for task actions
    showTaskMenu(taskName) {
        console.log('📋 Showing task menu for:', taskName);
        // TODO: Implement task menu (export, delete task, etc.)
        alert(`Меню задачи: ${taskName}`);
    }

    // Show results modal - displays parsing results in modal window
    showResultsModal(taskName, results) {
        console.log('🖼️ Showing results modal for task:', taskName, 'with', results.length, 'results');
        
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

            await this.startParsing({ taskName, searchQuery });
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

    // Bind logout button (already bound in bindAuthEvents, this is redundant)
    bindLogoutButton() {
        // Removed duplicate logout binding to prevent conflicts
        console.log('🔗 Logout button already bound in bindAuthEvents()');
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

        // Validation function
        const validateEmailForm = () => {
            const subject = emailSubject.value.trim();
            const body = emailBody.value.trim();
            
            // Check if both required fields are filled
            const isValid = subject.length > 0 && body.length > 0;
            
            // Update button state
            nextToStep2Btn.disabled = !isValid;
            
            // Update campaign data
            this.currentEmailCampaign.subject = subject;
            this.currentEmailCampaign.body = body;
            
            console.log(`📧 Email form validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
            
            return isValid;
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
            
            if (validateEmailForm()) {
                await this.saveEmailCampaignAndContinue();
            } else {
                this.showError('Пожалуйста, заполните заголовок и текст письма');
            }
        });

        // Initial validation
        validateEmailForm();
    }

    // Handle email attachments
    handleEmailAttachments(files, attachmentsList) {
        console.log('📎 Processing email attachments:', files.length);
        
        // Clear current attachments
        this.currentEmailCampaign.attachments = [];
        attachmentsList.innerHTML = '';

        Array.from(files).forEach((file, index) => {
            // Store file information
            const fileInfo = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };
            
            this.currentEmailCampaign.attachments.push(fileInfo);

            // Create attachment display element
            const attachmentItem = document.createElement('div');
            attachmentItem.className = 'attachment-item';
            attachmentItem.innerHTML = `
                <div class="attachment-info">
                    <span class="attachment-name">${file.name}</span>
                    <span class="attachment-size">${this.formatFileSize(file.size)}</span>
                </div>
                <button type="button" class="remove-attachment" data-index="${index}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" transform="rotate(45 12 12)"/>
                    </svg>
                </button>
            `;

            // Bind remove button
            const removeBtn = attachmentItem.querySelector('.remove-attachment');
            removeBtn.addEventListener('click', () => {
                this.removeEmailAttachment(index, attachmentsList);
            });

            attachmentsList.appendChild(attachmentItem);
        });

        console.log(`📎 Added ${files.length} attachments to email campaign`);
    }

    // Remove email attachment
    removeEmailAttachment(index, attachmentsList) {
        this.currentEmailCampaign.attachments.splice(index, 1);
        
        // Rebuild attachments list
        attachmentsList.innerHTML = '';
        this.currentEmailCampaign.attachments.forEach((attachment, newIndex) => {
            const attachmentItem = document.createElement('div');
            attachmentItem.className = 'attachment-item';
            attachmentItem.innerHTML = `
                <div class="attachment-info">
                    <span class="attachment-name">${attachment.name}</span>
                    <span class="attachment-size">${this.formatFileSize(attachment.size)}</span>
                </div>
                <button type="button" class="remove-attachment" data-index="${newIndex}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" transform="rotate(45 12 12)"/>
                    </svg>
                </button>
            `;

            const removeBtn = attachmentItem.querySelector('.remove-attachment');
            removeBtn.addEventListener('click', () => {
                this.removeEmailAttachment(newIndex, attachmentsList);
            });

            attachmentsList.appendChild(attachmentItem);
        });
    }

    // Format file size for display
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

        console.log('✅ Email step 2 activated');
    }

    // Start parsing process
    async startParsing(params) {
        if (!this.pipelineOrchestrator) {
            this.showError('Система не готова. Попробуйте позже.');
            return;
        }

        try {
            // Show progress
            this.showProgress('Инициализация поиска...', 0);
            
            // Start pipeline with proper parameters
            const results = await this.pipelineOrchestrator.executePipeline({
                taskName: params.taskName,
                searchQuery: params.searchQuery,
                resultCount: 10 // TESTING: Reduced from 50 to 10 for faster testing
            });

            if (results && results.length > 0) {
                this.showProgress('Поиск завершен!', 100);
                this.viewResults(results);
                
                // Invalidate cache since new parsing results have been added
                this.invalidateCache('parsing_results');
                this.invalidateCache('task_history');
                this.invalidateCache('contacts_data');
                console.log('🔄 Cache invalidated after parsing completion (parsing_results + task_history + contacts_data)');
                
                // Refresh database section if active
                if (this.currentSection === 'database') {
                    await this.loadDatabaseData();
                }
                
                // Send Telegram notification about parsing completion
                const notificationData = {
                    originalQuery: params.searchQuery,
                    taskName: params.taskName,
                    queryInfo: results.queryInfo,
                    results: results.results || results,
                    timestamp: results.timestamp || new Date().toISOString()
                };
                
                // Send notification asynchronously (don't block modal display)
                this.sendTelegramParsingNotification(notificationData).catch(error => {
                    console.log('🔕 Telegram notification failed (non-blocking):', error.message);
                });
                
                // Show completion modal
                this.showCompletionModal();
            } else {
                this.showError('Результаты не найдены');
                this.hideProgress();
            }

        } catch (error) {
            console.error('❌ Parsing error:', error);
            this.showError('Ошибка поиска: ' + error.message);
            this.hideProgress();
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

    // Show notification using toast system
    showNotification(message, type) {
        // Get toast container
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Create toast content with icon
        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';
        
        // Create icon
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'i';
        
        // Create message
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        
        // Assemble toast
        toastContent.appendChild(icon);
        toastContent.appendChild(messageEl);
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
                    statusText.style.color = '#10b981';
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
                    statusText.style.color = '#ef4444';
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
}

// Global platform instance
let platform = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
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
};