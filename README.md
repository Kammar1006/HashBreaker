# HashBreaker
HashBreaker is a web-based application designed to perform brute-force and dictionary attacks on password hashes. It supports multiple user roles (Anonymous, Authenticated, Admin), each with customizable permissions and attack parameters. This application is perfect for testing password strength and analyzing hash vulnerabilities.

## Features
### 1. Brute-force Attack:
- Generate and test password combinations based on user-defined length constraints.
- Maximum length is configurable per user role.
Dictionary Attack:

### 2. Test a hash against pre-loaded password dictionaries.
- Admins can upload new dictionaries directly through the app.

### 3. User Management:
- Support for three roles: Anonymous, Authenticated users, and Admins.
- Each role has configurable permissions and limits.

### 4. Database Integration:
- Store user data in a MySQL database for user authentication and role-based access control.

## Project Structure
```
HashBreaker/
├── backend/
│   ├── dictionaries/       # Pre-loaded password dictionaries
│   │   ├── rocky_top100.txt
│   │   └── test.txt
│   ├── db.js               # Database connection setup
│   ├── server.js           # Main server logic
│   └── strings_analyzer.js # Helper functions for hash analysis
├── frontend/
│   ├── js/
│   │   ├── index.js        # Client-side JavaScript for main functionality
│   │   └── login.js        # Client-side JavaScript for login functionality
│   ├── index.html          # Main UI for hash analysis
│   └── login.html          # Login page
├── .gitignore              # Ignored files (e.g., node_modules)
├── package.json            # Node.js dependencies
├── package-lock.json       # Dependency lock file
├── README.md               # This documentation
├── settings.json           # Application configuration
├── hidden.json             # Sensitive information (DB credentials)
└── users.sql               # SQL file to set up the users table
```

## Prerequisites
- Node.js (v16+ recommended)
- MySQL Server

## How to Set Up and Run

### 1. Clone the Repository:
```
git clone <repository_url>
cd HashBreaker
```

### 2.Install Dependencies:
```
npm install
```

### 3. Set Up Database:
- Create hidden.json and add the following fields with your database credentials
```
{
  "db_host": "localhost",
  "db_user": "your_db_user",
  "db_pass": "your_db_password",
  "db_dbname": "your_db_name",
  "db_port": 3306
}
```

- Create the database and set up the users table using users.sql script.

### 4. Configure Settings:

- Open settings.json to customize the application behavior (more below).

### 5. Start the Application:
```
npm start
```
The server will start on: http://localhost:8005.

## Usage
### 1. Open the app in your browser: http://localhost:8005.
### 2. Use the login page (login.html) to authenticate users or proceed as an Anonymous user.
### 3. Navigate to the main interface (index.html) to:
- Perform a brute-force attack by specifying a hash and password length.
- Use a dictionary to find a password corresponding to a hash.

## Configuration Options
```settings.json```

This file allows customization of server behavior and user roles.
### 1. Global Settings:

- port: Port number for the application.
- db_on: Enable or disable database functionality.
- cookie: Set the session cookie name.

### 2.  Role-Based Settings:
#### anonim, auth, and admin sections define the permissions and limits for each role:
- bruteforce_attack: Enable/disable brute-force attacks.
- bruteforce_max_len: Maximum password length for brute-force attacks.
- dictionary_attack: Enable/disable dictionary-based hash attacks.
- dictionary_upload: Allow or disallow dictionary uploads (admin-only by default).

### Notes and Limitations
- Ensure the hidden.json file is secured and not exposed to unauthorized users.
- Dictionaries should be uploaded as plain text files with one password per line.
- Only Admin users are allowed to upload new dictionaries.