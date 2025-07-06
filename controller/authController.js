const bcrypt = require('bcryptjs');
let db;

/**
 * Initializes the controller with a database instance.
 * This must be called once when the application starts.
 * @param {object} databaseInstance - The connected database instance.
 */
function initializeController(databaseInstance) {
    db = databaseInstance;
}

/**
 * Handles user login requests.
 * USERS WILL LOGIN WITH EMAIL AND PASSWORD.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
async function login(req, res) {
    // CHANGED: Expect 'email' instead of 'username' for login
    const { email, password } = req.body;

    // VALIDATION: Updated to validate email
    db.validate(req.body, {
        email: ['required', 'email'], // CHANGED
        password: ['required']
    });

    try {
        // FIXED: Find user by 'email' as it should be unique
        const users = await db.getDataByFilters('users', { email });
        const user = users && users.length > 0 ? users[0] : null;

        if (!user) {
            // This generic error is good for security
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const passwordIsValid = await bcrypt.compare(password, user.password);

        if (passwordIsValid) {
            // Success: send back user object without the password
            const { password, ...userWithoutPassword } = user;
            res.status(200).json({ success: true, user: userWithoutPassword });
        } else {
            res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during login.' });
    }
}

/**
 * Handles user registration requests.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
async function register(req, res) {
    // CHANGED: Destructure 'username', 'email', and 'password' from the request
    const { username, email, password } = req.body;

    // VALIDATION: Added validation for all incoming fields
    db.validate(req.body, {
        username: ['required'],
        email: ['required', 'email'], // CHANGED: Email is now required and validated
        password: ['required']
    });

    try {
        // FIXED: Check if a user with that EMAIL already exists
        const existingUsers = await db.getDataByFilters('users', { email });
        if (existingUsers && existingUsers.length > 0) {
            // This error now correctly matches the check
            return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            username,
            email, // ADDED: Save the email to the database
            password: hashedPassword,
        };

        const result = await db.postData('users', newUser);
        
        // CHANGED: Create a user object to send back, matching what the front-end expects.
        // This avoids sending the hashed password back to the client.
        const createdUser = {
            id: result.insertId, // Assuming 'result.insertId' is returned by your db layer
            username: newUser.username,
            email: newUser.email
        };

        // CHANGED: Send the newly created user object in the response
        res.status(201).json({ success: true, user: createdUser });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during registration.' });
    }
}

module.exports = {
    initializeController,
    login,
    register,
};