/**
 * FileManager - Comprehensive file upload and management with Supabase Storage
 * 
 * Features:
 * - File validation (size, type, count)
 * - Supabase Storage integration
 * - Upload progress tracking
 * - Bucket management
 * - Error handling
 * - Security checks
 */
class FileManager {
    constructor(supabaseClient, options = {}) {
        this.supabase = supabaseClient;
        
        // Configuration based on Gmail and Supabase Storage limits
        this.config = {
            // File size limits (Gmail limit: 25MB, but large files auto-upload to Google Drive)
            maxFileSize: options.maxFileSize || 25 * 1024 * 1024, // 25MB (Gmail limit)
            maxTotalSize: options.maxTotalSize || 25 * 1024 * 1024, // 25MB total (Gmail limit)
            maxFileCount: options.maxFileCount || 10, // Recommended limit for Gmail
            
            // Large file handling (files over Gmail limit)
            gmailFileLimit: 25 * 1024 * 1024, // 25MB Gmail limit
            largFileWarningSize: 10 * 1024 * 1024, // 10MB warning threshold
            extremeFileSize: 1024 * 1024 * 1024, // 1GB - refuse files larger than this
            
            // Upload method selection
            standardUploadLimit: 6 * 1024 * 1024, // 6MB - use standard upload
            resumableUploadLimit: 50 * 1024 * 1024 * 1024, // 50GB - use resumable upload
            
            // File type restrictions
            allowedMimeTypes: options.allowedMimeTypes || ['*/*'], // Allow all by default
            blockedMimeTypes: options.blockedMimeTypes || [
                'application/x-executable',
                'application/x-msdownload',
                'application/x-msdos-program'
            ],
            
            // Bucket configuration
            defaultBucket: options.defaultBucket || 'email-attachments',
            bucketConfig: {
                public: false
            },
            
            // Upload settings
            chunkSize: options.chunkSize || 1024 * 1024, // 1MB chunks
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            
            // Security
            generateUniqueNames: options.generateUniqueNames !== false,
            sanitizeFilenames: options.sanitizeFilenames !== false,
            virusScanEnabled: options.virusScanEnabled || false,
            
            debug: options.debug || false
        };
        
        // Upload state tracking
        this.uploads = new Map();
        this.uploadCounter = 0;
        
        this.log('🗂️ FileManager initialized with config:', this.config);
    }

    /**
     * Initialize FileManager and ensure bucket exists
     */
    async initialize() {
        try {
            await this.ensureBucketExists();
            this.log('✅ FileManager initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ FileManager initialization failed:', error);
            throw new Error(`FileManager initialization failed: ${error.message}`);
        }
    }

    /**
     * Ensure the default bucket exists
     */
    async ensureBucketExists() {
        try {
            // Check if bucket exists
            const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
            
            if (listError) {
                console.warn(`⚠️ Cannot list buckets: ${listError.message}`);
                // Try to create bucket anyway - it might just be a permissions issue with listing
                return this.tryCreateBucket();
            }
            
            const bucketExists = buckets.some(bucket => bucket.name === this.config.defaultBucket);
            
            if (!bucketExists) {
                this.log(`📦 Creating bucket: ${this.config.defaultBucket}`);
                return this.tryCreateBucket();
            } else {
                this.log(`✅ Bucket exists: ${this.config.defaultBucket}`);
            }
        } catch (error) {
            console.error('❌ Bucket setup failed:', error);
            // Don't throw error - allow FileManager to work without bucket creation
            console.warn('⚠️ Continuing without bucket verification - uploads may fail');
        }
    }

    async tryCreateBucket() {
        try {
            const { data, error: createError } = await this.supabase.storage.createBucket(
                this.config.defaultBucket,
                this.config.bucketConfig
            );
            
            if (createError) {
                console.warn(`⚠️ Cannot create bucket: ${createError.message}`);
                // Don't throw - bucket might already exist
                return;
            }
            
            this.log(`✅ Bucket created: ${this.config.defaultBucket}`);
        } catch (error) {
            console.warn(`⚠️ Bucket creation failed: ${error.message}`);
            // Continue anyway - bucket might exist
        }
    }

    /**
     * Validate files before upload
     */
    validateFiles(files) {
        const errors = [];
        const fileArray = Array.from(files);
        
        // Check file count
        if (fileArray.length > this.config.maxFileCount) {
            errors.push(`Слишком много файлов. Максимум: ${this.config.maxFileCount}`);
        }
        
        let totalSize = 0;
        let googleDriveFiles = [];
        let warnings = [];
        
        fileArray.forEach((file, index) => {
            // Check for extremely large files (refuse completely)
            if (file.size > this.config.extremeFileSize) {
                errors.push(`Файл "${file.name}" слишком большой (${this.formatFileSize(file.size)}). Максимум: ${this.formatFileSize(this.config.extremeFileSize)}`);
                return;
            }
            
            // Check if file should go to Google Drive
            if (file.size > this.config.gmailFileLimit) {
                // File larger than Gmail limit - will be uploaded to Google Drive
                googleDriveFiles.push(file.name);
                warnings.push(`📤 Файл "${file.name}" (${this.formatFileSize(file.size)}) будет загружен на Google Drive (превышает лимит Gmail ${this.formatFileSize(this.config.gmailFileLimit)})`);
                // Don't add to totalSize since it won't be attached to email directly
                return;
            }
            
            // Check individual file size against Gmail limits (for regular attachments)
            if (file.size > this.config.maxFileSize) {
                errors.push(`Файл "${file.name}" слишком большой. Максимум: ${this.formatFileSize(this.config.maxFileSize)}`);
            }
            
            // Warning for large files that will still be attached directly
            if (file.size > this.config.largFileWarningSize) {
                console.warn(`⚠️ Большой файл: "${file.name}" (${this.formatFileSize(file.size)})`);
            }
            
            // Only add to totalSize if it's a regular attachment (not Google Drive)
            totalSize += file.size;
            
            // Check file type
            if (!this.isFileTypeAllowed(file.type, file.name)) {
                errors.push(`Тип файла "${file.name}" не поддерживается`);
            }
            
            // Check filename
            if (!this.isFilenameValid(file.name)) {
                errors.push(`Недопустимое имя файла: "${file.name}"`);
            }
        });
        
        // Check total size
        if (totalSize > this.config.maxTotalSize) {
            errors.push(`Общий размер файлов слишком большой. Максимум: ${this.formatFileSize(this.config.maxTotalSize)}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            totalSize, // Only includes files that will be direct attachments
            fileCount: fileArray.length,
            googleDriveFiles: googleDriveFiles,
            googleDriveCount: googleDriveFiles.length,
            regularAttachmentCount: fileArray.length - googleDriveFiles.length
        };
    }

    /**
     * Check if file type is allowed
     */
    isFileTypeAllowed(mimeType, filename) {
        // Check blocked types first
        if (this.config.blockedMimeTypes.includes(mimeType)) {
            return false;
        }
        
        // If allowing all types
        if (this.config.allowedMimeTypes.includes('*/*')) {
            return true;
        }
        
        // Check specific allowed types
        return this.config.allowedMimeTypes.some(allowedType => {
            if (allowedType.endsWith('/*')) {
                const category = allowedType.split('/')[0];
                return mimeType.startsWith(category + '/');
            }
            return allowedType === mimeType;
        });
    }

    /**
     * Validate filename
     */
    isFilenameValid(filename) {
        // Basic security checks
        if (!filename || filename.trim() === '') return false;
        if (filename.length > 255) return false;
        
        // Check for dangerous characters
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(filename)) return false;
        
        // Check for reserved names (Windows)
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
        if (reservedNames.test(filename)) return false;
        
        return true;
    }

    /**
     * Upload multiple files
     */
    async uploadFiles(files, options = {}) {
        const uploadId = ++this.uploadCounter;
        const bucket = options.bucket || this.config.defaultBucket;
        const folderPath = options.folderPath || 'attachments';
        
        this.log(`📤 Starting upload ${uploadId} for ${files.length} files`);
        
        // Validate files
        const validation = this.validateFiles(files);
        if (!validation.isValid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Track upload progress
        const uploadState = {
            id: uploadId,
            totalFiles: files.length,
            completedFiles: 0,
            totalSize: validation.totalSize,
            uploadedSize: 0,
            startTime: Date.now(),
            files: [],
            errors: []
        };
        
        this.uploads.set(uploadId, uploadState);
        
        try {
            const uploadPromises = Array.from(files).map(async (file, index) => {
                return this.uploadSingleFile(file, uploadId, bucket, folderPath, options);
            });
            
            // Upload all files in parallel
            const results = await Promise.allSettled(uploadPromises);
            
            // Process results
            const successfulUploads = [];
            const failedUploads = [];
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successfulUploads.push(result.value);
                } else {
                    failedUploads.push({
                        filename: files[index].name,
                        error: result.reason.message
                    });
                }
            });
            
            uploadState.completedFiles = files.length;
            uploadState.endTime = Date.now();
            uploadState.duration = uploadState.endTime - uploadState.startTime;
            
            this.log(`✅ Upload ${uploadId} completed: ${successfulUploads.length} successful, ${failedUploads.length} failed`);
            
            return {
                uploadId,
                successful: successfulUploads,
                failed: failedUploads,
                stats: {
                    totalFiles: files.length,
                    successCount: successfulUploads.length,
                    failureCount: failedUploads.length,
                    totalSize: validation.totalSize,
                    duration: uploadState.duration
                }
            };
            
        } catch (error) {
            this.log(`❌ Upload ${uploadId} failed:`, error);
            throw error;
        } finally {
            // Keep upload record for a while for debugging
            setTimeout(() => this.uploads.delete(uploadId), 300000); // 5 minutes
        }
    }

    /**
     * Upload a single file
     */
    async uploadSingleFile(file, uploadId, bucket, folderPath, options = {}) {
        const filename = this.generateFileName(file.name);
        const filePath = `${folderPath}/${filename}`;
        
        this.log(`📤 Uploading file: ${file.name} -> ${filePath}`);
        
        try {
            let uploadResult;
            let isLocalFallback = false;
            
            try {
                // Try Supabase Storage first
                if (file.size <= this.config.standardUploadLimit) {
                    uploadResult = await this.standardUpload(file, bucket, filePath, options);
                } else {
                    uploadResult = await this.resumableUpload(file, bucket, filePath, uploadId, options);
                }
            } catch (supabaseError) {
                console.warn(`⚠️ Supabase upload failed: ${supabaseError.message}`);
                console.log(`🔄 Falling back to local storage for: ${file.name}`);

                // Fallback to local file storage (pass options for progress tracking)
                uploadResult = await this.localFallbackUpload(file, filePath, options);
                isLocalFallback = true;
            }
            
            // Get public URL if needed (skip for local fallback)
            const publicUrl = (options.getPublicUrl && !isLocalFallback) ? 
                this.supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl : null;
            
            const fileInfo = {
                originalName: file.name,
                filename: filename,
                filePath: filePath,
                bucket: isLocalFallback ? 'local-fallback' : bucket,
                size: file.size,
                mimeType: file.type,
                uploadedAt: new Date().toISOString(),
                publicUrl,
                supabaseData: uploadResult.data,
                isLocalFallback: isLocalFallback
            };
            
            // Update upload progress
            this.updateUploadProgress(uploadId, file.size);
            
            this.log(`✅ File uploaded successfully: ${filename} ${isLocalFallback ? '(local fallback)' : '(Supabase)'}`);
            return fileInfo;
            
        } catch (error) {
            this.log(`❌ File upload failed: ${file.name}`, error);
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
    }

    /**
     * Standard upload for small files with simulated progress
     */
    async standardUpload(file, bucket, filePath, options = {}) {
        // Simulated progress for better UX
        let currentProgress = 10;
        let progressInterval = null;

        // Report initial progress
        if (options.onProgress) {
            options.onProgress(currentProgress);

            // Calculate interval speed based on file size
            // Smaller files = faster progress, larger files = slower progress
            const fileSizeMB = file.size / (1024 * 1024);
            const intervalDuration = Math.max(50, Math.min(200, fileSizeMB * 20)); // 50-200ms

            // Simulate progress from 10% to 90%
            progressInterval = setInterval(() => {
                if (currentProgress < 90) {
                    // Slow down as we approach 90%
                    const increment = currentProgress < 50 ? 8 : (currentProgress < 75 ? 4 : 2);
                    currentProgress = Math.min(90, currentProgress + increment);
                    options.onProgress(currentProgress);
                }
            }, intervalDuration);
        }

        try {
            const { data, error } = await this.supabase.storage
                .from(bucket)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            // Clear simulated progress interval
            if (progressInterval) {
                clearInterval(progressInterval);
            }

            // Report completion progress
            if (options.onProgress) {
                options.onProgress(100);
            }

            if (error) {
                throw error;
            }

            return { data };

        } catch (error) {
            // Clear interval on error
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            throw error;
        }
    }

    /**
     * Resumable upload for large files (placeholder for future implementation)
     */
    async resumableUpload(file, bucket, filePath, uploadId, options = {}) {
        // For now, use standard upload
        // TODO: Implement chunked/resumable upload for large files
        this.log(`⚠️ Large file detected (${this.formatFileSize(file.size)}), using standard upload`);
        return this.standardUpload(file, bucket, filePath, options);
    }

    /**
     * Local fallback upload using browser storage
     */
    async localFallbackUpload(file, filePath) {
        try {
            // Convert file to base64 for storage
            const base64Data = await this.fileToBase64(file);
            
            // Store file data in localStorage (for small files) or IndexedDB (for larger files)
            const fileData = {
                filePath,
                originalName: file.name,
                size: file.size,
                type: file.type,
                data: base64Data,
                uploadedAt: new Date().toISOString()
            };
            
            // Use localStorage for small files (< 1MB), IndexedDB for larger files
            if (file.size < 1024 * 1024) {
                // Small file - use localStorage
                const storageKey = `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
                localStorage.setItem(storageKey, JSON.stringify(fileData));
                this.log(`📁 Stored small file in localStorage: ${file.name}`);
            } else {
                // Larger file - use IndexedDB
                await this.storeInIndexedDB(filePath, fileData);
                this.log(`📁 Stored large file in IndexedDB: ${file.name}`);
            }
            
            return {
                data: {
                    path: filePath,
                    id: filePath,
                    fullPath: filePath
                }
            };
            
        } catch (error) {
            this.log(`❌ Local fallback upload failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Convert file to base64
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Store file in IndexedDB
     */
    async storeInIndexedDB(filePath, fileData) {
        return new Promise((resolve, reject) => {
            // Open IndexedDB
            const request = indexedDB.open('FileManagerDB', 1);
            
            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'filePath' });
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                
                const addRequest = store.put(fileData);
                
                addRequest.onsuccess = () => {
                    resolve();
                };
                
                addRequest.onerror = () => {
                    reject(new Error('Failed to store file in IndexedDB'));
                };
            };
        });
    }

    /**
     * Generate unique filename
     */
    generateFileName(originalName) {
        if (!this.config.generateUniqueNames) {
            return this.config.sanitizeFilenames ? this.sanitizeFilename(originalName) : originalName;
        }
        
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop();
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        const sanitizedBaseName = this.config.sanitizeFilenames ? 
            this.sanitizeFilename(baseName) : baseName;
        
        return `${sanitizedBaseName}_${timestamp}_${random}.${extension}`;
    }

    /**
     * Sanitize filename
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\s+/g, '_')
            .toLowerCase();
    }

    /**
     * Update upload progress
     */
    updateUploadProgress(uploadId, fileSize) {
        const upload = this.uploads.get(uploadId);
        if (upload) {
            upload.completedFiles++;
            upload.uploadedSize += fileSize;
            
            // Call progress callback if provided
            if (upload.onProgress) {
                upload.onProgress({
                    uploadId,
                    progress: (upload.uploadedSize / upload.totalSize) * 100,
                    completedFiles: upload.completedFiles,
                    totalFiles: upload.totalFiles
                });
            }
        }
    }

    /**
     * Get upload progress
     */
    getUploadProgress(uploadId) {
        return this.uploads.get(uploadId);
    }

    /**
     * Delete file from storage
     */
    async deleteFile(bucket, filePath) {
        try {
            if (bucket === 'local-fallback') {
                // Delete from local storage
                await this.deleteFromLocalStorage(filePath);
                this.log(`🗑️ File deleted from local storage: ${filePath}`);
                return { success: true };
            } else {
                // Delete from Supabase Storage
                const { data, error } = await this.supabase.storage
                    .from(bucket)
                    .remove([filePath]);
                    
                if (error) {
                    throw error;
                }
                
                this.log(`🗑️ File deleted from Supabase: ${filePath}`);
                return data;
            }
        } catch (error) {
            this.log(`❌ File deletion failed: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Delete file from local storage
     */
    async deleteFromLocalStorage(filePath) {
        try {
            // Try localStorage first
            const storageKey = `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
            if (localStorage.getItem(storageKey)) {
                localStorage.removeItem(storageKey);
                this.log(`🗑️ Removed from localStorage: ${filePath}`);
                return;
            }
            
            // Try IndexedDB
            await this.deleteFromIndexedDB(filePath);
            this.log(`🗑️ Removed from IndexedDB: ${filePath}`);
            
        } catch (error) {
            this.log(`⚠️ Could not delete from local storage: ${error.message}`);
            // Don't throw - file might not exist or be in different storage
        }
    }

    /**
     * Delete file from IndexedDB
     */
    async deleteFromIndexedDB(filePath) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FileManagerDB', 1);
            
            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                
                const deleteRequest = store.delete(filePath);
                
                deleteRequest.onsuccess = () => {
                    resolve();
                };
                
                deleteRequest.onerror = () => {
                    reject(new Error('Failed to delete file from IndexedDB'));
                };
            };
        });
    }

    /**
     * Get file URL
     */
    getFileUrl(bucket, filePath, expiresIn = 3600) {
        try {
            const { data, error } = this.supabase.storage
                .from(bucket)
                .createSignedUrl(filePath, expiresIn);
                
            if (error) {
                throw error;
            }
            
            return data;
        } catch (error) {
            this.log(`❌ Failed to get file URL: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Get file from local storage (localStorage or IndexedDB)
     */
    async getLocalFile(filePath) {
        try {
            // Try localStorage first (for small files)
            const storageKey = `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const localData = localStorage.getItem(storageKey);
            
            if (localData) {
                const fileData = JSON.parse(localData);
                this.log(`📁 Retrieved file from localStorage: ${filePath}`);
                
                // Convert base64 back to ArrayBuffer for blob creation
                const base64Data = fileData.data.split(',')[1]; // Remove data URL prefix
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                return {
                    data: bytes,
                    originalName: fileData.originalName,
                    size: fileData.size,
                    type: fileData.type,
                    uploadedAt: fileData.uploadedAt
                };
            }
            
            // Try IndexedDB for larger files
            const indexedDBData = await this.getFromIndexedDB(filePath);
            if (indexedDBData) {
                this.log(`📁 Retrieved file from IndexedDB: ${filePath}`);
                
                // Convert base64 back to ArrayBuffer for blob creation
                const base64Data = indexedDBData.data.split(',')[1]; // Remove data URL prefix
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                return {
                    data: bytes,
                    originalName: indexedDBData.originalName,
                    size: indexedDBData.size,
                    type: indexedDBData.type,
                    uploadedAt: indexedDBData.uploadedAt
                };
            }
            
            throw new Error(`File not found in local storage: ${filePath}`);
            
        } catch (error) {
            this.log(`❌ Failed to get local file: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Get file from IndexedDB
     */
    async getFromIndexedDB(filePath) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FileManagerDB', 1);
            
            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['files'], 'readonly');
                const store = transaction.objectStore('files');
                
                const getRequest = store.get(filePath);
                
                getRequest.onsuccess = () => {
                    resolve(getRequest.result);
                };
                
                getRequest.onerror = () => {
                    reject(new Error('Failed to get file from IndexedDB'));
                };
            };
        });
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Debug logging
     */
    log(message, ...args) {
        if (this.config.debug) {
            console.log(`[FileManager] ${message}`, ...args);
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.log('⚙️ Configuration updated:', newConfig);
    }
}

// Export for use in other modules
window.FileManager = FileManager;