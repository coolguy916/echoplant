// SerialCommunicator.js
const { SerialPort, ReadlineParser } = require('serialport');

class SerialCommunicator {
    constructor(config, dbInstance, windowInstance) {
        this.config = {
            portPath: null,
            baudRate: 9600,
            dataType: 'json-object',
            lineDelimiter: '\r\n',
            csvDelimiter: ',',
            fieldMapping: [],
            dbTableName: null,
            requiredFields: [],
            fieldsToEncrypt: [],
            autoReconnect: true,          // Enable/disable auto-reconnection
            reconnectDelay: 3000,         // Delay between reconnection attempts (ms)
            maxReconnectAttempts: 10,     // Maximum reconnection attempts
            connectionTimeout: 5000,      // Connection timeout (ms)
            portScanInterval: 15000,      // Interval to scan for better ports (ms)
            enableDynamicPortSwitching: true, // Enable automatic switching to potential ports

            ...config
        };
        this.db = dbInstance;
        this.mainWindow = windowInstance;
        this.arduinoPort = null;
        this.parser = null;
        this.isConnecting = false;
        this.isIntentionallyDisconnected = false;  // Track if disconnect was intentional
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.connectionCheckInterval = null;
        this.portScanTimer = null;              // Timer for periodic port scanning
        this.lastDataReceived = Date.now();
        this.currentPortPath = null;            // Track current connected port
        this.isConnectedToPotentialPort = false; // Track if connected to ideal port
        
        // Connection states
        this.connectionStates = {
            DISCONNECTED: 'disconnected',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            RECONNECTING: 'reconnecting',
            SWITCHING_PORTS: 'switching_ports',
            ERROR: 'error'
        };
        this.currentState = this.connectionStates.DISCONNECTED;
    }

    setMainWindow(windowInstance) {
        this.mainWindow = windowInstance;
    }

    // Get current connection status
    getStatus() {
        return {
            state: this.currentState,
            isConnected: this.isConnected(),
            port: this.getPortInfo(),
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.config.maxReconnectAttempts,
            autoReconnect: this.config.autoReconnect,
            lastDataReceived: this.lastDataReceived,
            isConnectedToPotentialPort: this.isConnectedToPotentialPort,
            currentPortPath: this.currentPortPath
        };
    }

    // Set connection state and notify renderer
    _setState(newState, message = '') {
        if (this.currentState !== newState) {
            console.log(`Serial state changed: ${this.currentState} -> ${newState}${message ? ': ' + message : ''}`);
            this.currentState = newState;
            this._sendToRenderer('serial-port-status', {
                state: newState,
                message: message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async connect() {
        if (this.isConnecting) {
            console.log('Connection already in progress...');
            return;
        }

        this.isConnecting = true;
        this.isIntentionallyDisconnected = false;
        this._setState(this.connectionStates.CONNECTING, 'Initiating connection...');

        try {
            if (!this.config.portPath) {
                await this._autoDetectAndConnect();
            } else {
                await this._connectToPort(this.config.portPath);
            }
            
            // Start periodic port scanning if enabled
            if (this.config.enableDynamicPortSwitching) {
                this._startPortScanning();
            }
        } catch (error) {
            console.error('Connection failed:', error);
            this._setState(this.connectionStates.ERROR, `Connection failed: ${error.message}`);
            this._sendToRenderer('serial-port-error', `Connection failed: ${error.message}`);
            
            // Start reconnection if auto-reconnect is enabled
            if (this.config.autoReconnect && !this.isIntentionallyDisconnected) {
                this._scheduleReconnection();
            }
        } finally {
            this.isConnecting = false;
        }
    }

    // Start periodic port scanning for better connections
    _startPortScanning() {
        if (this.portScanTimer) {
            clearInterval(this.portScanTimer);
        }

        this.portScanTimer = setInterval(async () => {
            try {
                await this._scanForBetterPort();
            } catch (error) {
                console.error('Error during port scanning:', error);
            }
        }, this.config.portScanInterval);

        console.log(`Port scanning started (interval: ${this.config.portScanInterval}ms)`);
    }

    // Stop port scanning
    _stopPortScanning() {
        if (this.portScanTimer) {
            clearInterval(this.portScanTimer);
            this.portScanTimer = null;
            console.log('Port scanning stopped');
        }
    }

    // Scan for better ports and switch if found
    async _scanForBetterPort() {
        // Don't scan if we're already connected to a potential port or if we're in the middle of connecting
        if (this.isConnectedToPotentialPort || this.isConnecting || !this.isConnected()) {
            return;
        }

        try {
            console.log('Scanning for better Arduino/ESP32 ports...');
            const ports = await SerialPort.list();
            
            // Look for potential ports
            const potentialPorts = ports.filter(p => {
                const manufacturer = (p.manufacturer || '').toLowerCase();
                const vendorId = p.vendorId;

                return manufacturer.includes('arduino') ||
                    manufacturer.includes('esp32') ||
                    manufacturer.includes('silicon labs') ||
                    manufacturer.includes('ch340') ||
                    manufacturer.includes('ftdi') ||
                    manufacturer.includes('prolific') ||
                    vendorId === '10C4' || // Silicon Labs
                    vendorId === '1A86' || // CH340
                    vendorId === '0403' || // FTDI
                    vendorId === '2341';   // Arduino
            });

            // Check if we found a potential port that's different from current
            if (potentialPorts.length > 0) {
                const bestPotentialPort = potentialPorts[0].path;
                
                if (bestPotentialPort !== this.currentPortPath) {
                    console.log(`Better port detected: ${bestPotentialPort} (current: ${this.currentPortPath})`);
                    
                    this._sendToRenderer('serial-port-status', {
                        state: 'better_port_detected',
                        message: `Better port detected: ${bestPotentialPort}`,
                        currentPort: this.currentPortPath,
                        newPort: bestPotentialPort,
                        timestamp: new Date().toISOString()
                    });

                    await this._switchToPort(bestPotentialPort);
                }
            }
        } catch (error) {
            console.error('Error scanning for better ports:', error);
        }
    }

    // Switch to a new port
    async _switchToPort(newPortPath) {
        try {
            console.log(`Switching from ${this.currentPortPath} to ${newPortPath}`);
            this._setState(this.connectionStates.SWITCHING_PORTS, `Switching to better port: ${newPortPath}`);
            
            // Close current connection
            await this._closeConnection();
            
            // Connect to new port
            await this._connectToPort(newPortPath);
            
            this._sendToRenderer('serial-port-switched', {
                oldPort: this.currentPortPath,
                newPort: newPortPath,
                timestamp: new Date().toISOString()
            });
            
            console.log(`Successfully switched to port: ${newPortPath}`);
        } catch (error) {
            console.error(`Failed to switch to port ${newPortPath}:`, error);
            this._sendToRenderer('serial-port-error', `Failed to switch to port ${newPortPath}: ${error.message}`);
            
            // Try to reconnect to original port or find any available port
            if (this.config.autoReconnect && !this.isIntentionallyDisconnected) {
                this._scheduleReconnection();
            }
        }
    }

    // Force reconnection (can be called from renderer)
    async forceReconnect() {
        console.log('Force reconnection requested...');
        this._sendToRenderer('serial-reconnect-status', {
            status: 'manual_reconnect_started',
            message: 'Manual reconnection initiated...'
        });

        // Cancel any existing reconnection timer
        this._cancelReconnection();
        
        // Reset attempts for manual reconnection
        this.reconnectAttempts = 0;
        this.isIntentionallyDisconnected = false;
        
        // Close existing connection if any
        await this._closeConnection();
        
        // Start fresh connection attempt
        await this.connect();
    }

    // Intentional disconnect (stops auto-reconnection)
    async disconnect() {
        console.log('Intentional disconnect requested...');
        this.isIntentionallyDisconnected = true;
        this._cancelReconnection();
        this._stopConnectionMonitoring();
        this._stopPortScanning();
        await this._closeConnection();
        this._setState(this.connectionStates.DISCONNECTED, 'Intentionally disconnected');
    }

    async _autoDetectAndConnect() {
        try {
            console.log('Scanning for Arduino/ESP32 devices...');
            const ports = await SerialPort.list();

            console.log('Available ports:', ports.map(p => ({
                path: p.path,
                manufacturer: p.manufacturer,
                vendorId: p.vendorId,
                productId: p.productId
            })));

            // Look for common Arduino/ESP32 identifiers
            const potentialPorts = ports.filter(p => {
                const manufacturer = (p.manufacturer || '').toLowerCase();
                const vendorId = p.vendorId;

                return manufacturer.includes('arduino') ||
                    manufacturer.includes('esp32') ||
                    manufacturer.includes('silicon labs') ||
                    manufacturer.includes('ch340') ||
                    manufacturer.includes('ftdi') ||
                    manufacturer.includes('prolific') ||
                    vendorId === '10C4' || // Silicon Labs
                    vendorId === '1A86' || // CH340
                    vendorId === '0403' || // FTDI
                    vendorId === '2341';   // Arduino
            });

            if (potentialPorts.length > 0) {
                console.log('Found potential Arduino/ESP32 ports:', potentialPorts);
                this.isConnectedToPotentialPort = true;
                await this._connectToPort(potentialPorts[0].path);
            } else if (ports.length > 0) {
                console.log('No obvious Arduino/ESP32 ports found, trying first available port...');
                this.isConnectedToPotentialPort = false;
                await this._connectToPort(ports[0].path);
            } else {
                throw new Error('No serial ports available');
            }
        } catch (error) {
            console.error('Error during auto-detection:', error);
            throw error;
        }
    }

    async _connectToPort(portPath) {
        return new Promise((resolve, reject) => {
            console.log(`Attempting to connect: ${portPath} @ ${this.config.baudRate} baud.`);
            this._setState(this.connectionStates.CONNECTING, `Connecting to ${portPath}...`);

            // Close existing connection if any
            if (this.arduinoPort && this.arduinoPort.isOpen) {
                this.arduinoPort.close();
            }

            // Create connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.arduinoPort) {
                    this.arduinoPort.close();
                }
                reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
            }, this.config.connectionTimeout);

            this.arduinoPort = new SerialPort({
                path: portPath,
                baudRate: this.config.baudRate,
                autoOpen: false
            });

            // Set up event listeners before opening
            this.arduinoPort.on('open', () => {
                clearTimeout(connectionTimeout);
                console.log(`Port ${portPath} opened successfully.`);
                this.currentPortPath = portPath;
                this._setState(this.connectionStates.CONNECTED, `Connected to ${portPath}`);
                this.reconnectAttempts = 0;
                this.lastDataReceived = Date.now();

                // Set up parser after successful connection
                this.parser = this.arduinoPort.pipe(new ReadlineParser({
                    delimiter: this.config.lineDelimiter
                }));
                this.parser.on('data', data => this._handleData(data));

                // Start connection monitoring
                this._startConnectionMonitoring();

                resolve();
            });

            this.arduinoPort.on('error', (err) => {
                clearTimeout(connectionTimeout);
                console.error(`Serial Error on ${portPath}:`, err.message);
                this._setState(this.connectionStates.ERROR, `Port Error: ${err.message}`);
                this._sendToRenderer('serial-port-error', `Port Error: ${err.message}`);
                this.arduinoPort = null;
                this.currentPortPath = null;
                reject(err);
            });

            this.arduinoPort.on('close', () => {
                clearTimeout(connectionTimeout);
                console.log(`Port ${portPath} closed.`);
                
                if (!this.isIntentionallyDisconnected) {
                    this._setState(this.connectionStates.DISCONNECTED, `Connection lost: ${portPath}`);
                    this._sendToRenderer('serial-connection-lost', {
                        port: portPath,
                        timestamp: new Date().toISOString(),
                        reconnectAttempts: this.reconnectAttempts
                    });
                }

                this.arduinoPort = null;
                this.parser = null;
                this.currentPortPath = null;
                this.isConnectedToPotentialPort = false;
                this._stopConnectionMonitoring();
                this._stopPortScanning();

                // Attempt reconnection if not intentionally closed and auto-reconnect is enabled
                if (this.config.autoReconnect && !this.isIntentionallyDisconnected) {
                    this._scheduleReconnection();
                }
            });

            // Now open the port
            this.arduinoPort.open((err) => {
                if (err) {
                    clearTimeout(connectionTimeout);
                    console.error(`Failed to open port ${portPath}:`, err.message);
                    reject(err);
                }
            });
        });
    }

    _scheduleReconnection() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.log(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached. Stopping auto-reconnection.`);
            this._setState(this.connectionStates.ERROR, `Max reconnection attempts reached (${this.config.maxReconnectAttempts})`);
            this._sendToRenderer('serial-reconnect-status', {
                status: 'max_attempts_reached',
                attempts: this.reconnectAttempts,
                maxAttempts: this.config.maxReconnectAttempts
            });
            return;
        }

        this._setState(this.connectionStates.RECONNECTING, `Reconnecting in ${this.config.reconnectDelay / 1000}s... (Attempt ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);
        
        this._sendToRenderer('serial-reconnect-status', {
            status: 'scheduled',
            attempts: this.reconnectAttempts,
            maxAttempts: this.config.maxReconnectAttempts,
            delay: this.config.reconnectDelay
        });

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
            
            this._sendToRenderer('serial-reconnect-status', {
                status: 'attempting',
                attempts: this.reconnectAttempts,
                maxAttempts: this.config.maxReconnectAttempts
            });
            
            this.connect();
        }, this.config.reconnectDelay);
    }

    _cancelReconnection() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
            console.log('Reconnection timer cancelled');
        }
    }

    _startConnectionMonitoring() {
        // Monitor connection health by checking for regular data
        this.connectionCheckInterval = setInterval(() => {
            const timeSinceLastData = Date.now() - this.lastDataReceived;
            
            // If no data received for more than 30 seconds, consider connection potentially dead
            if (timeSinceLastData > 30000 && this.isConnected()) {
                console.warn(`No data received for ${timeSinceLastData / 1000}s. Connection may be unstable.`);
                this._sendToRenderer('serial-port-error', `No data received for ${Math.floor(timeSinceLastData / 1000)} seconds`);
            }
        }, 10000); // Check every 10 seconds
    }

    _stopConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    async _closeConnection() {
        return new Promise((resolve) => {
            if (this.arduinoPort && this.arduinoPort.isOpen) {
                this.arduinoPort.close(err => {
                    if (err) {
                        console.error('Error closing serial port:', err.message);
                    } else {
                        console.log('Serial port closed successfully.');
                    }
                    this.arduinoPort = null;
                    this.parser = null;
                    this.currentPortPath = null;
                    resolve();
                });
            } else {
                this.arduinoPort = null;
                this.parser = null;
                this.currentPortPath = null;
                resolve();
            }
        });
    }

    _handleData(rawString) {
        const trimmedData = rawString.trim();
        this.lastDataReceived = Date.now(); // Update last data received timestamp
        
        console.log('Serial Raw:', trimmedData);

        this._sendToRenderer('serial-data-received', {
            raw: trimmedData,
            timestamp: new Date().toLocaleTimeString(),
            port: this.currentPortPath
        });

        // Skip empty data
        if (!trimmedData) {
            console.log('Skipping empty data');
            return;
        }

        let parsedData, dataForDb = {};

        try {
            switch (this.config.dataType) {
                case 'json-object':
                    dataForDb = JSON.parse(trimmedData);
                    console.log('Parsed JSON object:', dataForDb);
                    break;

                case 'json-array':
                    parsedData = JSON.parse(trimmedData);
                    if (!Array.isArray(parsedData) || parsedData.length !== this.config.fieldMapping.length) {
                        throw new Error(`Array data mismatch. Expected ${this.config.fieldMapping.length} items, got ${parsedData.length}`);
                    }
                    this.config.fieldMapping.forEach((field, i) => {
                        dataForDb[field] = parsedData[i];
                    });
                    console.log('Parsed JSON array:', dataForDb);
                    break;

                case 'csv':
                    parsedData = trimmedData.split(this.config.csvDelimiter);
                    if (parsedData.length !== this.config.fieldMapping.length) {
                        throw new Error(`CSV data mismatch. Expected ${this.config.fieldMapping.length} items, got ${parsedData.length}`);
                    }
                    this.config.fieldMapping.forEach((field, i) => {
                        const val = parsedData[i].trim();
                        dataForDb[field] = !isNaN(parseFloat(val)) && isFinite(val) && val !== '' ? Number(val) : val;
                    });
                    console.log('Parsed CSV:', dataForDb);
                    break;

                case 'raw':
                    dataForDb = { raw_data: trimmedData, timestamp: new Date().toISOString() };
                    console.log('Raw data stored:', dataForDb);
                    break;

                default:
                    throw new Error(`Unsupported dataType: ${this.config.dataType}`);
            }

            console.log('Processed Data (before validation):', dataForDb);

            // Validate required fields
            if (this.config.requiredFields.length > 0) {
                for (const field of this.config.requiredFields) {
                    if (dataForDb[field] === undefined || dataForDb[field] === null || String(dataForDb[field]).trim() === '') {
                        console.warn(`Data missing required field '${field}', skipping database insert`);
                        return;
                    }
                }
            }

            // Save to Database
            if (this.config.dbTableName && this.db) {
                this._saveToDatabase(dataForDb);
            } else {
                console.log('Database save skipped: no table name or DB instance');
            }

        } catch (err) {
            console.error('Data Handling Error:', err.message);
            console.error('Raw data that caused error:', trimmedData);
            this._sendToRenderer('serial-port-error', `Data Error: ${err.message}`);
        }
    }

    _saveToDatabase(dataForDb) {
        let dataToInsert = { ...dataForDb };

        // Handle encryption if configured
        if (this.db.encrypt && this.config.fieldsToEncrypt && this.config.fieldsToEncrypt.length > 0) {
            console.log('Encrypting fields:', this.config.fieldsToEncrypt);
            for (const field of this.config.fieldsToEncrypt) {
                if (dataToInsert.hasOwnProperty(field) && dataToInsert[field] !== null && dataToInsert[field] !== undefined) {
                    try {
                        dataToInsert[field] = this.db.encrypt(String(dataToInsert[field]));
                        console.log(`Field '${field}' encrypted.`);
                    } catch (encError) {
                        console.error(`Error encrypting field '${field}':`, encError);
                        this._sendToRenderer('serial-port-error', `Encryption Error for ${field}: ${encError.message}`);
                    }
                }
            }
        }

        console.log('Data for DB (final):', dataToInsert);

        this.db.postData(this.config.dbTableName, dataToInsert)
            .then(res => {
                console.log(`DB Insert successful (${this.config.dbTableName}): ID ${res.insertId}`);
                this._sendToRenderer('database-insert-success', {
                    table: this.config.dbTableName,
                    insertId: res.insertId,
                    data: dataForDb,
                    port: this.currentPortPath
                });
            })
            .catch(err => {
                console.error(`DB Insert Error (${this.config.dbTableName}):`, err);
                this._sendToRenderer('serial-port-error', `DB Insert: ${err.message}`);
            });
    }

    // Method to send data to Arduino/ESP32
    sendData(data) {
        if (this.arduinoPort && this.arduinoPort.isOpen) {
            this.arduinoPort.write(data + '\n', (err) => {
                if (err) {
                    console.error('Error sending data:', err);
                    this._sendToRenderer('serial-port-error', `Send Error: ${err.message}`);
                } else {
                    console.log('Data sent:', data);
                    this._sendToRenderer('serial-data-sent', {
                        data: data,
                        port: this.currentPortPath,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        } else {
            console.warn('Cannot send data: port not open');
            this._sendToRenderer('serial-port-error', 'Cannot send data: port not connected');
        }
    }

    // Get connection status
    isConnected() {
        return this.arduinoPort && this.arduinoPort.isOpen;
    }

    // Get current port info
    getPortInfo() {
        if (this.arduinoPort) {
            return {
                path: this.arduinoPort.path,
                baudRate: this.arduinoPort.baudRate,
                isOpen: this.arduinoPort.isOpen,
                isPotentialPort: this.isConnectedToPotentialPort
            };
        }
        return null;
    }

    // Manual method to trigger port scanning
    async scanForBetterPorts() {
        if (this.config.enableDynamicPortSwitching) {
            await this._scanForBetterPort();
        } else {
            console.log('Dynamic port switching is disabled');
        }
    }

    // Enable/disable dynamic port switching
    setDynamicPortSwitching(enabled) {
        this.config.enableDynamicPortSwitching = enabled;
        
        if (enabled && this.isConnected()) {
            this._startPortScanning();
        } else {
            this._stopPortScanning();
        }
        
        console.log(`Dynamic port switching ${enabled ? 'enabled' : 'disabled'}`);
    }

    _sendToRenderer(channel, data) {
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    async close() {
        console.log('SerialCommunicator closing...');
        this.isIntentionallyDisconnected = true;
        this._cancelReconnection();
        this._stopConnectionMonitoring();
        this._stopPortScanning();
        await this._closeConnection();
        this._setState(this.connectionStates.DISCONNECTED, 'SerialCommunicator closed');
    }
}

module.exports = SerialCommunicator;