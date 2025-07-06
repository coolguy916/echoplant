let dbInstance;

const initializeController = (db) => {
    dbInstance = db;
};

const insertSensorData = async (req, res) => {
    const { user_id, device_id, ph_reading, temperature_reading, moisture_percentage } = req.body;

    try {
        dbInstance.validate(req.body, {
            user_id: ['required'], 
            device_id: ['required']
        });

         const result = await dbInstance.postData('sensor_data', {
            user_id,
            device_id,
            ph_reading: dbInstance.encrypt(String(ph_reading)),
            temperature_reading: dbInstance.encrypt(String(temperature_reading)),
            moisture_percentage: dbInstance.encrypt(String(moisture_percentage))
        });
        
        res.json({ success: true, id: result.insertId, message: "Data received via API and saved." });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

module.exports = {
    initializeController,
    insertSensorData
};