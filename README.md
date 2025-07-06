# alprog_boncos
This is an Electron application designed to read, store, and visualize sensor data. It features real-time data monitoring, database integration, serial communication capabilities, and a user-friendly dashboard.
# 🌱 Electron Sensor Dashboard

This is an **Electron application** designed to read, store, and visualize sensor data. It features real-time monitoring, database integration, serial communication, and a user-friendly dashboard interface.

---

## 🚀 Features

- **Real-time Sensor Data Monitoring**: Continuously tracks and displays sensor readings.
- **Database Integration**: Stores sensor data in a MySQL database for logging and analysis.
- **Serial Communication**: Interfaces with serial devices like Arduino to receive sensor data.
- **Express.js API**: Robust backend to manage and serve sensor data.
- **Interactive Dashboard**: Intuitive UI to visualize and interact with the data.
- **User Authentication**: Secure login and registration for user management.

---

## 💻 Tech Stack

| Layer         | Technology                                                                 |
|---------------|----------------------------------------------------------------------------|
| **Frontend**  | HTML, CSS, JavaScript, Tailwind CSS, Bootstrap                            |
| **Backend**   | Node.js, Express.js                                                       |
| **Database**  | MySQL with `mysql2` driver                                                |
| **Desktop App** | Electron                                                                |
| **Serial Communication** | `serialport` library                                          |

---

## 📂 File Structure
```bash

alprog_boncos/
│
├── main.js # Main Electron process
├── preload.js # Secure IPC preloader
├── index.html # Login page
├── dashboard.html # Dashboard UI
│
├── controller/
│ └── databaseController.js # Handles DB CRUD operations
│
├── lib/
│ ├── database.js # DB connection and query logic
│ └── serialCommunicator.js # Serial communication logic
│
├── view/ # All UI-related files (HTML, CSS, JS)
├── .env # Environment variables (DB credentials)
├── package.json # Project metadata and dependencies
```

---

## 🔧 Setup and Installation

Follow these steps to set up and run the project:

### 1. Clone the Repository

```bash
git clone https://github.com/coolguy916/alprog_boncos.git
cd alprog_boncos
```
### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up the Database
Ensure you have MySQL running.

Create a database (e.g., sensor_app).

Add your DB config to a .env file:
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=sensor_app
```
### 4. Run the Application
npm start

---

🗃️ Database Schema
| table                 | Description              |
| --------------------- | ------------------------ |
| `user_table`          | Associated user ID       |
| `device_Table`        | Unique device identifier |
| `Sensor_Table`        | pH sensor reading        |

---

📡 API Endpoints
| Method | Endpoint       | Description                      |
| ------ | -------------- | -------------------------------- |
| POST   | `/sensor-data` | Add new sensor data              |
| GET    | `/sensor-data` | Fetch sensor data (with filters) |
| PUT    | `/sensor-data` | Update existing sensor data      |
| DELETE | `/sensor-data` | Delete sensor data               |

🤝 Contributing
@adjip.sp follow for more


