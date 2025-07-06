// Global variables
let temperatureChart = null;
let dataRefreshInterval = null;
let isElectronApp = typeof window.api !== "undefined";
let isRealtime = true;
const tableName = "sensor_data";
let currentSensor = "all";
let sensorData = {
    temperature: [],
    moisture: [],
    ph: []
};

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", function () {
    try {
        updateConnectionStatus(isElectronApp);
        initializeChart();
        loadInitialData();
        
        if (isElectronApp) {
            setupSerialPortStatusListener(); // Only status, no data processing
            loadDeviceList();
        } else {
            showError("Not running in Electron. Using mock data.");
        }
        
        startDataRefresh();
        
        // Update current time
        setInterval(updateCurrentTime, 1000);
        updateCurrentTime();
    } catch (error) {
        console.error("Error during initialization:", error);
        handleError(error);
    }
});

// Connection status
function updateConnectionStatus(connected) {
    try {
        const statusDot = document.getElementById("connectionStatus");
        const statusText = document.getElementById("connectionText");
        
        if (!statusDot || !statusText) return;
        
        if (connected) {
            statusDot.classList.add("connected");
            statusText.textContent = "Connected";
        } else {
            statusDot.classList.remove("connected");
            statusText.textContent = "Disconnected";
            
            // Handle reconnection logic
            if (isRealtime) {
                setTimeout(() => {
                    statusText.textContent = "Reconnecting...";
                    setTimeout(loadInitialData, 2000);
                }, 5000);
            }
        }
    } catch (error) {
        console.error("Error updating connection status:", error);
    }
}

// Enhanced error handling
function handleError(error) {
    console.error("Dashboard Error:", error);
    
    try {
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
            font-size: 14px;
        `;
        errorDiv.textContent = "Database connection error. Retrying...";
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 5000);
    } catch (e) {
        console.error("Error showing error message:", e);
    }
}

// Error handling
function showError(message) {
    const errorDiv = document.getElementById("errorMessage");
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        setTimeout(() => {
            errorDiv.style.display = "none";
        }, 5000);
    }
}

// Helper function to safely parse numeric values
function safeParseFloat(value, defaultValue = 0) {
    if (value === null || value === undefined || value === "") {
        return defaultValue;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Initialize Chart
function initializeChart() {
    try {
        const ctx = document.getElementById("temperatureChart");
        if (!ctx) {
            console.error("Chart canvas element not found");
            return;
        }
        
        temperatureChart = new Chart(ctx.getContext("2d"), {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Temperature (°C)",
                        data: [],
                        borderColor: "#20c997",
                        backgroundColor: "rgba(32, 201, 151, 0.1)",
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: "#20c997",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: "#f1f3f4" },
                        ticks: {
                            callback: (value) => value + "°C",
                        },
                    },
                    x: {
                        grid: { display: false },
                    },
                },
            },
        });
        
        console.log("Chart initialized successfully");
    } catch (error) {
        console.error("Error initializing chart:", error);
        handleError(error);
    }
}

// Database communication functions
async function fetchSensorData(limit = 10) {
    try {
        const result = await window.api.invoke(
            "get-data-by-filters",
            tableName,
            {},
            {
                limit: limit,
                orderBy: {
                    column: "reading_date",
                    direction: "DESC"
                }
            }
        );

        if (result.success) {
            return result.data;
        } else {
            console.error("Failed to fetch sensor data:", result.error);
            return [];
        }
    } catch (error) {
        console.error("Error fetching sensor data:", error);
        return [];
    }
}

async function fetchChartData() {
    try {
        const days = parseInt(document.getElementById("chartDays")?.value) || 7;
        const deviceId = document.getElementById("deviceFilter")?.value;
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const filters = {};
        
        // Add device filter if selected
        if (deviceId && deviceId !== "") {
            filters.device_id = parseInt(deviceId);
        }

        console.log("Fetching chart data with filters:", filters);
        
        const result = await window.api.invoke(
            "get-data-by-filters",  
            tableName,
            filters,
            {
                orderBy: {
                    column: "reading_date",
                    direction: "ASC" // Changed to ASC for chronological order
                },
                limit: 100 // Increased limit for better chart data
            }
        );

        if (result.success && result.data) {
            console.log("Chart data fetched:", result.data.length, "records");
            return result.data;
        } else {
            console.error("Failed to fetch chart data:", result.error);
            return [];
        }
    } catch (error) {
        console.error("Error fetching chart data:", error);
        return [];
    }
}

// Load initial data
async function loadInitialData() {
    try {
        await loadLatestSensorData();
        await updateChartData();
    } catch (error) {
        console.error("Error loading initial data:", error);
        showError("Failed to load initial data");
        handleError(error);
    }
}

// Load latest sensor data from backend or mock
async function loadLatestSensorData() {
    if (!isElectronApp) {
        // Fallback mock data for browser testing
        updateMetricDisplay("tempValue", "tempTimestamp", 25.4, "°C");
        updateMetricDisplay("moistureValue", "moistureTimestamp", 68, "%");
        updateMetricDisplay("phValue", "phTimestamp", 6.8, "pH");
        return;
    }

    try {
        const options = {
            orderBy: {
                column: "reading_date",
                direction: "DESC",
            },
            limit: 1
        };
        const result = await window.api.invoke('get-data-by-filters', tableName, {}, options);

        if (result.success && result.data && result.data.length > 0) {
            const latest = result.data[0];
            
            // Update temperature
            if (latest.temperature_reading !== null && latest.temperature_reading !== undefined) {
                const tempValue = safeParseFloat(latest.temperature_reading);
                updateMetricDisplay(
                    "tempValue",
                    "tempTimestamp",
                    tempValue,
                    "°C",
                    latest.reading_date
                );
            }
            
            // Update moisture
            if (latest.moisture_percentage !== null && latest.moisture_percentage !== undefined) {
                const moistureValue = safeParseFloat(latest.moisture_percentage);
                updateMetricDisplay(
                    "moistureValue",
                    "moistureTimestamp",
                    moistureValue,
                    "%",
                    latest.reading_date
                );
            }
            
            // Update pH
            if (latest.ph_reading !== null && latest.ph_reading !== undefined) {
                const phValue = safeParseFloat(latest.ph_reading);
                updateMetricDisplay(
                    "phValue",
                    "phTimestamp",
                    phValue,
                    "pH",
                    latest.reading_date
                );
            }
            
            updateConnectionStatus(true);
        } else {
            console.warn("No data or unsuccessful result from get-data-by-filters:", result);
            showError("No recent sensor data available.");
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error("Error loading sensor data:", error);
        showError("Failed to load live sensor data.");
        updateConnectionStatus(false);
        handleError(error);
    }
}

// Update a metric card
function updateMetricDisplay(valueId, timestampId, value, unit, timestamp = null) {
    try {
        const valueElement = document.getElementById(valueId);
        const timestampElement = document.getElementById(timestampId);

        if (valueElement) {
            valueElement.innerHTML = `${value.toFixed(1)}<span class="metric-unit">${unit}</span>`;
        }
        
        if (timestampElement) {
            timestampElement.textContent = `Last updated: ${timestamp
                ? new Date(timestamp).toLocaleString()
                : new Date().toLocaleTimeString()}`;
        }
    } catch (error) {
        console.error("Error updating metric display:", error);
    }
}

// Process database data for charts - Simplified and fixed
function processChartData(data) {
    if (!data || data.length === 0) {
        return { labels: [], temperatures: [] };
    }

    // Group data by date and calculate averages
    const grouped = {};
    
    data.forEach((record) => {
        if (record.temperature_reading === null || record.temperature_reading === undefined) return;
        
        const tempValue = safeParseFloat(record.temperature_reading);
        if (tempValue === 0) return; // Skip zero values if they're invalid
        
        const date = new Date(record.reading_date);
        const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format
        
        if (!grouped[dayKey]) {
            grouped[dayKey] = [];
        }
        grouped[dayKey].push(tempValue);
    });

    // Convert to chart format
    const labels = [];
    const temperatures = [];
    
    // Sort dates and process
    Object.keys(grouped)
        .sort()
        .forEach((dateKey) => {
            const dayData = grouped[dateKey];
            if (dayData.length > 0) {
                const average = dayData.reduce((sum, temp) => sum + temp, 0) / dayData.length;
                
                labels.push(
                    new Date(dateKey).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                    })
                );
                temperatures.push(parseFloat(average.toFixed(1)));
            }
        });

    console.log("Processed chart data:", { labels, temperatures });
    return { labels, temperatures };
}

// Update chart with data from backend or mock
async function updateChartData() {
    const chartCanvas = document.getElementById("temperatureChart");
    const chartLoading = document.getElementById("chartLoading");

    if (!chartCanvas) {
        console.error("Chart canvas not found");
        return;
    }

    // Show loading state
    if (chartLoading) {
        chartLoading.style.display = "flex";
    }
    
    // Hide chart during loading
    chartCanvas.style.display = "none";

    let chartData;
    
    if (!isElectronApp) {
        // Mock chart data for browser
        chartData = {
            labels: ["Jun 17", "Jun 18", "Jun 19", "Jun 20", "Jun 21", "Jun 22", "Jun 23"],
            temperatures: [22.1, 24.3, 23.8, 26.2, 25.7, 27.1, 26.8],
        };
    } else {
        try {
            const rawData = await fetchChartData();
            console.log("Raw chart data:", rawData);
            
            if (rawData && rawData.length > 0) {
                chartData = processChartData(rawData);
            } else {
                console.warn("No chart data available");
                chartData = { labels: [], temperatures: [] };
                showError("No chart data available for the selected range.");
            }
        } catch (error) {
            console.error("Error updating chart:", error);
            showError("Failed to update chart data");
            chartData = { labels: [], temperatures: [] };
            handleError(error);
        }
    }

    // Update chart
    if (temperatureChart && chartData) {
        try {
            temperatureChart.data.labels = chartData.labels;
            temperatureChart.data.datasets[0].data = chartData.temperatures;
            temperatureChart.update('none'); // No animation for better performance
            
            console.log("Chart updated with data:", chartData);
        } catch (error) {
            console.error("Error updating chart display:", error);
        }
    }

    // Hide loading and show chart
    if (chartLoading) {
        chartLoading.style.display = "none";
    }
    chartCanvas.style.display = "block";
}

// Load device list for the filter dropdown
async function loadDeviceList() {
    if (!isElectronApp) return;
    
    try {
        // Get unique device IDs from sensor data
        const result = await window.api.invoke('get-data-by-filters', tableName, {});
        
        if (result.success && result.data) {
            const select = document.getElementById("deviceFilter");
            if (!select) return;
            
            // Clear existing options
            select.innerHTML = '<option value="">All Devices</option>';
            
            // Get unique device IDs
            const deviceIds = [...new Set(result.data
                .map(item => item.device_id)
                .filter(id => id !== null && id !== undefined)
            )].sort();
            
            deviceIds.forEach((deviceId) => {
                const option = document.createElement("option");
                option.value = deviceId;
                option.textContent = `Device ${deviceId}`;
                select.appendChild(option);
            });
            
            console.log("Device list loaded:", deviceIds);
        }
    } catch (error) {
        console.error("Error loading device list:", error);
        showError("Failed to load device list");
    }
}

// Setup Electron-specific listeners for status only (no data processing)
function setupSerialPortStatusListener() {
    try {
        // Only listen for status updates, not data
        window.api.receive("serial-port-status", (status) => {
            console.log("Serial port status:", status);
            updateConnectionStatus(status.includes("Connected") || status.connected);
        });

        window.api.receive("serial-port-error", (error) => {
            console.error("Serial port error:", error);
            showError(`Serial port error: ${error}`);
            updateConnectionStatus(false);
        });
    } catch (error) {
        console.error("Error setting up serial status listener:", error);
    }
}

// Start/reset the data refresh interval
function startDataRefresh() {
    try {
        if (dataRefreshInterval) clearInterval(dataRefreshInterval);
        
        const intervalMs = parseInt(document.getElementById("refreshInterval")?.value) || 10000;
        dataRefreshInterval = setInterval(() => {
            loadLatestSensorData();
            // Also refresh chart data periodically
            if (Math.random() < 0.1) { // 10% chance to refresh chart to avoid too frequent updates
                updateChartData();
            }
        },  1000);//intervalMs);
        
        console.log("Data refresh started with interval:", intervalMs);
    } catch (error) {
        console.error("Error starting data refresh:", error);
    }
}

// Event handlers for settings
function updateRefreshInterval() {
    startDataRefresh();
}

// Event handler for chart filter changes
function updateChartFilters() {
    updateChartData();
}

// Update current time
function updateCurrentTime() {
    try {
        const timeElement = document.getElementById("currentTime");
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleString("en-US");
        }
    } catch (error) {
        console.error("Error updating current time:", error);
    }
}

// Navigation link activity
document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function (e) {
        e.preventDefault();
        document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
        this.classList.add("active");
    });
});

// "Analyse" button functionality
function analyzeMetric(type) {
    try {
        const button = event.target.closest("button");
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>ANALYZING...';
        button.disabled = true;

        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
            
            // Get current value for analysis
            let currentValue = 0;
            let status = "normal";
            let recommendations = "";
            
            switch(type) {
                case 'temperature':
                    const tempElement = document.getElementById("tempValue");
                    if (tempElement) {
                        currentValue = parseFloat(tempElement.textContent);
                        if (currentValue >= 20 && currentValue <= 30) {
                            status = "optimal";
                            recommendations = "Temperature is within ideal range.";
                        } else if (currentValue < 20) {
                            status = "too low";
                            recommendations = "Consider increasing temperature for better growth.";
                        } else {
                            status = "too high";
                            recommendations = "Consider cooling or ventilation to reduce temperature.";
                        }
                    }
                    break;
                case 'moisture':
                    const moistureElement = document.getElementById("moistureValue");
                    if (moistureElement) {
                        currentValue = parseFloat(moistureElement.textContent);
                        if (currentValue >= 30 && currentValue <= 70) {
                            status = "optimal";
                            recommendations = "Moisture level is ideal.";
                        } else if (currentValue < 30) {
                            status = "too dry";
                            recommendations = "Increase watering or humidity.";
                        } else {
                            status = "too wet";
                            recommendations = "Reduce watering and improve drainage.";
                        }
                    }
                    break;
                case 'ph':
                    const phElement = document.getElementById("phValue");
                    if (phElement) {
                        currentValue = parseFloat(phElement.textContent);
                        if (currentValue >= 6.0 && currentValue <= 7.5) {
                            status = "optimal";
                            recommendations = "pH level is within ideal range.";
                        } else if (currentValue < 6.0) {
                            status = "too acidic";
                            recommendations = "Add lime or wood ash to increase pH.";
                        } else {
                            status = "too alkaline";
                            recommendations = "Add sulfur or organic matter to decrease pH.";
                        }
                    }
                    break;
            }
            
            alert(`Analysis for ${type}:\nCurrent reading: ${currentValue.toFixed(1)}\nStatus: ${status}\n\nRecommendations: ${recommendations}`);
        }, 1500);
    } catch (error) {
        console.error("Error analyzing metric:", error);
    }
}

// Cleanup
window.addEventListener("beforeunload", () => {
    try {
        if (dataRefreshInterval) clearInterval(dataRefreshInterval);
        
        if (window.api) {
            window.api.removeAllListeners("serial-port-status");
            window.api.removeAllListeners("serial-port-error");
        }
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
});