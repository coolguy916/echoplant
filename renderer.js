// // const { ipcRenderer } = require('electron');

// async function fetchSensorData() {
//     const response = await ipcRenderer.invoke('get-data-by-filters', 'sensor_data', {});

//     const tbody = document.getElementById('sensor-table-body');
//     tbody.innerHTML = '';

//     if (response.success) {
//         response.data.forEach(row => {
//             const tr = document.createElement('tr');
//             tr.innerHTML = `
//                 <td>${row.id}</td>
//                 <td>${row.user_id}</td>
//                 <td>${row.device_id}</td>
//                 <td>${row.ph_reading}</td>
//                 <td>${row.temperature_reading}</td>
//                 <td>${row.moisture_percentage}</td>
//                 <td>${new Date(row.reading_date).toLocaleString()}</td>
//             `;
//             tbody.appendChild(tr);
//         });
//     } else {
//         tbody.innerHTML = `<tr><td colspan="7">Failed to load data</td></tr>`;
//         console.error(response.error);
//     }
// }

// // Refresh every 5 seconds
// fetchSensorData();
// setInterval(fetchSensorData, 5000);




document.addEventListener('DOMContentLoaded', () => {
    const dbTableBody = document.getElementById('sensor-table-body');
    const serialStatusElement = document.getElementById('serial-status');
    const liveSerialDataContainer = document.getElementById('live-serial-data');

    async function fetchSensorDataFromDB() {
        try {
            const response = await window.api.invoke('get-data-by-filters', 'sensor_data', {}); // Fetch all data
            if (dbTableBody) {
                dbTableBody.innerHTML = ''; // Clear previous data
                if (response.success) {
                    if (response.data.length === 0) {
                        dbTableBody.innerHTML = `<tr><td colspan="7">No sensor data found in database.</td></tr>`;
                    } else {
                        // Display latest data first
                        response.data.sort((a, b) => b.id - a.id).forEach(row => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${row.id !== undefined ? row.id : 'N/A'}</td>
                                <td>${row.user_id !== undefined ? row.user_id : 'N/A'}</td>
                                <td>${row.device_id !== undefined ? row.device_id : 'N/A'}</td>
                                <td>${row.ph_reading !== undefined ? Number(row.ph_reading).toFixed(2) : 'N/A'}</td>
                                <td>${row.temperature_reading !== undefined ? Number(row.temperature_reading).toFixed(2) : 'N/A'}</td>
                                <td>${row.moisture_percentage !== undefined ? Number(row.moisture_percentage).toFixed(2) : 'N/A'}</td>
                                <td>${row.reading_date ? new Date(row.reading_date).toLocaleString() : 'N/A'}</td>
                            `;
                            dbTableBody.appendChild(tr);
                        });
                    }
                } else {
                    dbTableBody.innerHTML = `<tr><td colspan="7" class="error">Failed to load data: ${response.error}</td></tr>`;
                    console.error('DB fetch error:', response.error);
                }
            }
        } catch (error) {
            console.error("Error invoking 'get-data-by-filters':", error);
            if (dbTableBody) dbTableBody.innerHTML = `<tr><td colspan="7" class="error">Error fetching data: ${error.message}</td></tr>`;
        }
    }

    // if (serialStatusElement) {
    //     window.api.receive('serial-port-status', (message) => {
    //         console.log('Serial Port Status:', message);
    //         serialStatusElement.textContent = message;
    //         serialStatusElement.classList.remove('error');
    //     });

    //     window.api.receive('serial-port-error', (errorMessage) => {
    //         console.error('Serial Port Error:', errorMessage);
    //         serialStatusElement.textContent = `Error: ${errorMessage}`;
    //         serialStatusElement.classList.add('error');
    //     });
    // }

    // if (liveSerialDataContainer) {
    //     let firstDataReceived = false;
    //     window.api.receive('serial-data-received', (dataPacket) => {
    //         if (!firstDataReceived) {
    //             liveSerialDataContainer.innerHTML = ''; // Clear "Waiting..."
    //             firstDataReceived = true;
    //         }
    //         console.log('Live Serial Data Received in Renderer:', dataPacket);
    //         const p = document.createElement('p');
    //         p.textContent = `[${dataPacket.timestamp}] ${dataPacket.raw}`;
    //         liveSerialDataContainer.prepend(p);
    //         while (liveSerialDataContainer.childNodes.length > 50) { // Keep last 50 messages
    //             liveSerialDataContainer.removeChild(liveSerialDataContainer.lastChild);
    //         }
    //         fetchSensorDataFromDB();
    //     });
    // }

    fetchSensorDataFromDB(); // Initial load
    setInterval(fetchSensorDataFromDB, 15000); // Refresh DB table periodically (e.g., every 15 seconds)

    window.addEventListener('beforeunload', () => {
        window.api.removeAllListeners('serial-data-received');
        window.api.removeAllListeners('serial-port-status');
        window.api.removeAllListeners('serial-port-error');
    });

    console.log('Renderer.js loaded. API should be available under window.api');
});