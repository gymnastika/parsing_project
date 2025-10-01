/**
 * Google Drive Client - для автоматической загрузки больших файлов
 * 
 * Функции:
 * - Загрузка файлов > 25 МБ на Google Drive через REST API
 * - Управление разрешениями доступа к файлам
 * - Прогресс-индикаторы загрузки  
 * - Интеграция с существующим GoogleOAuthHybrid для токенов
 * - Использует готовые OAuth токены без дополнительной авторизации
 */
class GoogleDriveClient {
    constructor(options = {}) {
        this.config = {
            // Параметры загрузки
            chunkSize: options.chunkSize || 8 * 1024 * 1024, // 8MB chunks
            maxRetries: options.maxRetries || 3,
            
            // UI настройки
            showProgress: options.showProgress !== false,
            
            debug: options.debug || false
        };
        
        // Состояние авторизации (будет получено от GoogleOAuthHybrid)
        this.isAuthenticated = false;
        this.accessToken = null;
        this.currentUser = null;
        
        // Активные загрузки
        this.uploads = new Map();
        this.uploadCounter = 0;
        
        this.log('🔧 GoogleDriveClient initialized');
    }
    
    /**
     * Инициализация с использованием существующих OAuth токенов
     */
    async initialize() {
        try {
            this.log('🔄 Initializing GoogleDriveClient with existing OAuth tokens...');
            
            // Проверяем наличие GoogleOAuthHybrid
            if (!window.googleOAuth) {
                throw new Error('GoogleOAuthHybrid not found. User must authenticate first.');
            }
            
            this.log('✅ GoogleDriveClient initialized (will use existing OAuth tokens)');
            return true;
            
        } catch (error) {
            console.error('❌ GoogleDriveClient initialization failed:', error);
            throw new Error(`GoogleDriveClient initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Получение токена доступа от GoogleOAuthHybrid
     */
    async getAccessToken(userId) {
        try {
            if (!window.googleOAuth) {
                throw new Error('GoogleOAuthHybrid not initialized. User must authenticate first.');
            }
            
            // Получаем интеграцию пользователя
            const integration = await window.googleOAuth.getIntegration(userId);
            if (!integration) {
                throw new Error('No Google integration found for user. User must connect Google account first.');
            }
            
            // Проверяем токен на актуальность
            if (integration.expires_at) {
                const expiresAt = new Date(integration.expires_at);
                const now = new Date();
                
                if (expiresAt <= now) {
                    this.log('🔄 Access token expired, refreshing...');
                    // Токен истек, обновляем
                    const refreshedTokens = await window.googleOAuth.refreshAccessToken(userId);
                    this.accessToken = refreshedTokens.access_token;
                } else {
                    this.accessToken = integration.access_token;
                }
            } else {
                this.accessToken = integration.access_token;
            }
            
            if (this.accessToken) {
                this.isAuthenticated = true;
                this.currentUser = userId;
                this.log('✅ Access token obtained successfully');
                return this.accessToken;
            } else {
                throw new Error('No valid access token available');
            }
            
        } catch (error) {
            console.error('❌ Failed to get access token:', error);
            throw new Error(`Failed to get access token: ${error.message}`);
        }
    }
    
    /**
     * Проверка нужна ли загрузка на Google Drive
     */
    shouldUploadToDrive(file) {
        const gmailLimit = 25 * 1024 * 1024; // 25MB
        return file.size > gmailLimit;
    }
    
    /**
     * Загрузка файла на Google Drive
     */
    async uploadFile(file, userId, options = {}) {
        const uploadId = ++this.uploadCounter;
        
        try {
            // Получаем токен доступа от GoogleOAuthHybrid
            await this.getAccessToken(userId);
            
            this.log(`📤 Starting Google Drive upload ${uploadId}: ${file.name}`);
            
            // Создаем запись о загрузке
            const uploadInfo = {
                id: uploadId,
                fileName: file.name,
                fileSize: file.size,
                uploadedBytes: 0,
                startTime: Date.now(),
                status: 'uploading',
                progress: 0,
                onProgress: options.onProgress
            };
            
            this.uploads.set(uploadId, uploadInfo);
            
            // Загружаем файл
            const result = await this.performUpload(file, uploadInfo);
            
            // Устанавливаем разрешения по умолчанию
            await this.setFilePermissions(result.fileId, {
                permissionType: 'restricted', // restricted, link, public
                emailAddress: options.emailAddress
            });
            
            uploadInfo.status = 'completed';
            uploadInfo.endTime = Date.now();
            uploadInfo.duration = uploadInfo.endTime - uploadInfo.startTime;
            
            this.log(`✅ Upload ${uploadId} completed successfully`);
            
            return {
                uploadId,
                fileId: result.fileId,
                fileName: file.name,
                fileSize: file.size,
                driveUrl: `https://drive.google.com/file/d/${result.fileId}/view`,
                shareUrl: result.shareUrl,
                duration: uploadInfo.duration,
                needsPermission: true, // требует настройки разрешений
                permissionStatus: 'restricted'
            };
            
        } catch (error) {
            const uploadInfo = this.uploads.get(uploadId);
            if (uploadInfo) {
                uploadInfo.status = 'failed';
                uploadInfo.error = error.message;
            }
            
            this.log(`❌ Upload ${uploadId} failed:`, error);
            throw error;
        }
    }
    
    /**
     * Проверка токена и его разрешений
     */
    async validateToken() {
        try {
            console.log('🔍 Validating Google access token...');
            
            // Check token info
            const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
            if (!tokenInfoResponse.ok) {
                throw new Error(`Token validation failed: ${tokenInfoResponse.statusText}`);
            }
            
            const tokenInfo = await tokenInfoResponse.json();
            console.log('📊 Token info:', {
                scope: tokenInfo.scope,
                audience: tokenInfo.audience,
                expires_in: tokenInfo.expires_in,
                user_id: tokenInfo.user_id
            });
            
            // Check if Drive scope is present
            const hasDriveScope = tokenInfo.scope && (
                tokenInfo.scope.includes('https://www.googleapis.com/auth/drive.file') ||
                tokenInfo.scope.includes('https://www.googleapis.com/auth/drive')
            );
            
            if (!hasDriveScope) {
                console.error('❌ Missing Google Drive scope in token:', tokenInfo.scope);
                throw new Error('Google Drive access not granted. Please reconnect your Google account.');
            }
            
            console.log('✅ Token validation successful - Drive access confirmed');
            return true;
            
        } catch (error) {
            console.error('❌ Token validation failed:', error);
            throw new Error(`Token validation failed: ${error.message}`);
        }
    }
    
    /**
     * Выполнение загрузки файла
     */
    async performUpload(file, uploadInfo) {
        const metadata = {
            name: file.name,
            description: `Прикрепленный файл из GYMNASTIKA Platform - ${new Date().toLocaleString('ru-RU')}`
        };
        
        // Try to validate token, but continue if validation fails (token might still work)
        try {
            await this.validateToken();
        } catch (validationError) {
            console.warn('⚠️ Token validation failed, but continuing with upload attempt:', validationError.message);
            // Continue anyway - the token might still be valid, just network issues during validation
        }
        
        // DEBUG: Always use simple upload first to test API access
        // TODO: Re-enable resumable upload after fixing 403 error
        console.log(`🔧 Using simple upload for debugging: ${file.name} (${this.formatFileSize(file.size)})`);
        return this.simpleUpload(file, metadata, uploadInfo);
    }
    
    /**
     * Real-time upload using XMLHttpRequest with progress tracking
     */
    async realTimeUpload(file, metadata, uploadInfo) {
        try {
            console.log('🚀 Starting real-time upload for:', file.name, 'Size:', this.formatFileSize(file.size));
            
            // File size check for upload method
            if (file.size > 5 * 1024 * 1024) { // > 5MB - use resumable
                return this.resumableUploadWithProgress(file, metadata, uploadInfo);
            } else {
                return this.multipartUploadWithProgress(file, metadata, uploadInfo);
            }
            
        } catch (error) {
            console.error('💥 Error in real-time upload:', error);
            throw error;
        }
    }

    /**
     * Multipart upload with XMLHttpRequest progress for files < 5MB
     */
    async multipartUploadWithProgress(file, metadata, uploadInfo) {
        return new Promise((resolve, reject) => {
            console.log('📤 Starting multipart upload with real-time progress...');
            
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";
            
            // Read file as ArrayBuffer first
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const fileData = reader.result;
                    const base64Data = this.arrayBufferToBase64(fileData);
                    
                    // Create multipart body
                    const body = delimiter + 
                        'Content-Type: application/json\r\n\r\n' +
                        JSON.stringify(metadata) + delimiter +
                        'Content-Type: ' + file.type + '\r\n' +
                        'Content-Transfer-Encoding: base64\r\n\r\n' +
                        base64Data + close_delim;
                    
                    // Create XMLHttpRequest for real progress tracking
                    const xhr = new XMLHttpRequest();
                    
                    // Track upload progress
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const percentComplete = (e.loaded / e.total) * 100;
                            uploadInfo.progress = Math.round(percentComplete);
                            uploadInfo.uploadedBytes = e.loaded;
                            this.updateProgress(uploadInfo);
                            console.log(`📊 Real-time progress: ${percentComplete.toFixed(1)}%`);
                        }
                    });
                    
                    // Handle response
                    xhr.onload = () => {
                        if (xhr.status === 200 || xhr.status === 201) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                console.log('✅ Multipart upload successful:', result.id);
                                resolve({
                                    fileId: result.id,
                                    shareUrl: `https://drive.google.com/file/d/${result.id}/view`
                                });
                            } catch (parseError) {
                                reject(new Error(`Failed to parse response: ${parseError.message}`));
                            }
                        } else {
                            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                        }
                    };
                    
                    xhr.onerror = () => {
                        reject(new Error('Network error during upload'));
                    };
                    
                    // Configure and send request
                    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
                    xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
                    xhr.setRequestHeader('Content-Type', `multipart/related; boundary="${boundary}"`);
                    
                    console.log('📡 Sending XMLHttpRequest with real-time progress tracking...');
                    xhr.send(body);
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Простая загрузка для файлов < 8MB (DEPRECATED - use realTimeUpload)
     */
    async simpleUpload(file, metadata, uploadInfo) {
        console.log('⚠️ Using deprecated simpleUpload - switching to realTimeUpload...');
        return this.realTimeUpload(file, metadata, uploadInfo);
    }

    /**
     * Resumable upload with real-time progress for large files (>5MB)
     */
    async resumableUploadWithProgress(file, metadata, uploadInfo) {
        try {
            console.log('📤 Starting resumable upload with real-time progress...');
            
            // Step 1: Initialize resumable session
            const sessionUri = await this.initiateResumableSession(file, metadata);
            console.log('✅ Resumable session initialized:', sessionUri);
            
            // Step 2: Upload file in chunks with progress tracking
            return this.uploadFileInChunks(file, sessionUri, uploadInfo);
            
        } catch (error) {
            console.error('💥 Error in resumable upload:', error);
            throw error;
        }
    }

    /**
     * Initialize resumable upload session
     */
    async initiateResumableSession(file, metadata) {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': file.type,
                'X-Upload-Content-Length': file.size.toString()
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            throw new Error(`Failed to initiate resumable upload: ${response.status} ${response.statusText}`);
        }

        return response.headers.get('location');
    }

    /**
     * Upload file in chunks using XMLHttpRequest for progress tracking
     */
    async uploadFileInChunks(file, sessionUri, uploadInfo) {
        return new Promise(async (resolve, reject) => {
            try {
                const chunkSize = 10 * 1024 * 1024; // 10MB chunks
                const totalChunks = Math.ceil(file.size / chunkSize);
                let uploadedBytes = 0;
                
                console.log(`📊 File will be uploaded in ${totalChunks} chunks of ${this.formatFileSize(chunkSize)}`);
                
                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    const start = chunkIndex * chunkSize;
                    const end = Math.min(start + chunkSize, file.size);
                    const chunk = file.slice(start, end);
                    
                    console.log(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${start}-${end - 1}/${file.size})`);
                    
                    await this.uploadChunkWithProgress(chunk, start, end - 1, file.size, sessionUri, uploadInfo, (progress) => {
                        // Update overall progress based on chunks + current chunk progress
                        const chunkProgress = (chunkIndex + progress / 100) / totalChunks * 100;
                        uploadInfo.progress = Math.round(chunkProgress);
                        uploadInfo.uploadedBytes = Math.floor(file.size * (chunkProgress / 100));
                        this.updateProgress(uploadInfo);
                    });
                    
                    uploadedBytes = end;
                    
                    // Check if upload is complete
                    if (end === file.size) {
                        console.log('✅ Resumable upload completed successfully');
                        // Get the final response with file info
                        const result = await this.getUploadResult(sessionUri);
                        resolve({
                            fileId: result.id,
                            shareUrl: `https://drive.google.com/file/d/${result.id}/view`
                        });
                        return;
                    }
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Upload single chunk with XMLHttpRequest progress
     */
    uploadChunkWithProgress(chunk, start, end, totalSize, sessionUri, uploadInfo, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track chunk upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const chunkProgress = (e.loaded / e.total) * 100;
                    onProgress(chunkProgress);
                    console.log(`📊 Chunk progress: ${chunkProgress.toFixed(1)}%`);
                }
            });
            
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201 || xhr.status === 308) {
                    resolve();
                } else {
                    reject(new Error(`Chunk upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error('Network error during chunk upload'));
            };
            
            // Configure request
            xhr.open('PUT', sessionUri);
            xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
            xhr.send(chunk);
        });
    }

    /**
     * Get upload result after completion
     */
    async getUploadResult(sessionUri) {
        const response = await fetch(sessionUri, {
            method: 'PUT',
            headers: {
                'Content-Range': `bytes */*`
            }
        });
        
        if (response.ok) {
            return response.json();
        } else {
            throw new Error(`Failed to get upload result: ${response.status}`);
        }
    }

    /**
     * Delete file from Google Drive
     */
    async deleteFile(fileId) {
        try {
            console.log('🗑️ Deleting Google Drive file:', fileId);
            
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (response.status === 204) {
                console.log('✅ File deleted successfully from Google Drive');
                return { success: true };
            } else if (response.status === 403) {
                throw new Error('Insufficient permissions to delete file');
            } else if (response.status === 404) {
                throw new Error('File not found or already deleted');
            } else {
                throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Error deleting Google Drive file:', error);
            throw error;
        }
    }
    
    /**
     * Установка разрешений для файла
     */
    async setFilePermissions(fileId, options = {}) {
        try {
            const permissionType = options.permissionType || 'restricted';
            
            if (permissionType === 'restricted') {
                // Файл доступен только создателю - ничего не делаем
                return { status: 'restricted' };
            }
            
            if (permissionType === 'link') {
                // Доступ по ссылке для всех
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'anyone'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to set permissions: ${response.statusText}`);
                }
                
                return { status: 'link', message: 'Доступ по ссылке предоставлен' };
            }
            
            if (permissionType === 'email' && options.emailAddress) {
                // Доступ для конкретного email
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'user',
                        emailAddress: options.emailAddress
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to set permissions: ${response.statusText}`);
                }
                
                return { status: 'email', message: `Доступ предоставлен ${options.emailAddress}` };
            }
            
        } catch (error) {
            this.log(`❌ Failed to set permissions for file ${fileId}:`, error);
            throw error;
        }
    }
    
    /**
     * Обновление прогресса загрузки
     */
    updateProgress(uploadInfo) {
        if (uploadInfo.onProgress && typeof uploadInfo.onProgress === 'function') {
            uploadInfo.onProgress({
                uploadId: uploadInfo.id,
                fileName: uploadInfo.fileName,
                progress: uploadInfo.progress,
                uploadedBytes: uploadInfo.uploadedBytes,
                totalBytes: uploadInfo.fileSize,
                speed: this.calculateSpeed(uploadInfo)
            });
        }
    }
    
    /**
     * Расчет скорости загрузки
     */
    calculateSpeed(uploadInfo) {
        const elapsed = Date.now() - uploadInfo.startTime;
        if (elapsed < 1000) return 0;
        
        return Math.round((uploadInfo.uploadedBytes / elapsed) * 1000); // bytes per second
    }
    
    /**
     * Запуск симуляции прогресса во время загрузки
     */
    startProgressSimulation(uploadInfo, fileSize) {
        console.log('🎬 Starting progress simulation...');
        
        let currentProgress = uploadInfo.progress || 25; // Start from current progress (25%)
        const targetProgress = 95; // Don't go to 100% yet, save that for completion
        const duration = Math.max(3000, Math.min(10000, fileSize / 1024)); // 3-10 seconds based on file size
        const steps = 50; // Number of progress updates
        const increment = (targetProgress - currentProgress) / steps;
        const interval = duration / steps;
        
        console.log('📊 Progress simulation params:', {
            startProgress: currentProgress,
            targetProgress,
            duration: `${duration}ms`,
            increment: increment.toFixed(2),
            interval: `${interval}ms`
        });
        
        const progressInterval = setInterval(() => {
            if (currentProgress < targetProgress) {
                currentProgress += increment;
                uploadInfo.progress = Math.round(currentProgress);
                uploadInfo.uploadedBytes = Math.floor(fileSize * (currentProgress / 100));
                this.updateProgress(uploadInfo);
                
                // Occasional detailed logging
                if (Math.round(currentProgress) % 10 === 0) {
                    console.log(`📈 Progress simulation: ${Math.round(currentProgress)}%`);
                }
            }
        }, interval);
        
        return {
            interval: progressInterval,
            startTime: Date.now()
        };
    }
    
    /**
     * Остановка симуляции прогресса
     */
    stopProgressSimulation(progressSimulation) {
        if (progressSimulation && progressSimulation.interval) {
            clearInterval(progressSimulation.interval);
            const elapsed = Date.now() - progressSimulation.startTime;
            console.log(`🎬 Progress simulation stopped after ${elapsed}ms`);
        }
    }
    
    /**
     * Чтение файла как ArrayBuffer
     */
    async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Конвертация ArrayBuffer в base64
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Получение статуса загрузки
     */
    getUploadStatus(uploadId) {
        return this.uploads.get(uploadId);
    }
    
    /**
     * Форматирование размера файла
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Логирование
     */
    log(message, ...args) {
        if (this.config.debug) {
            console.log(`[GoogleDriveClient] ${message}`, ...args);
        }
    }
    
    /**
     * Получение конфигурации
     */
    getConfig() {
        return { ...this.config };
    }
}

// Экспорт для использования в других модулях
window.GoogleDriveClient = GoogleDriveClient;