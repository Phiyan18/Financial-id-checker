# Financial ID Validator Pro

A powerful, enterprise-grade web application for validating financial identifiers (ISIN, CUSIP, SEDOL, LEI) with built-in SQL database functionality, advanced analytics, and session management.

## 🚀 Features

### Core Validation
- **ISIN (International Securities Identification Number)** - Validates 12-character alphanumeric codes with checksum verification
- **CUSIP (Committee on Uniform Securities Identification Procedures)** - Validates 9-character US securities identifiers
- **SEDOL (Stock Exchange Daily Official List)** - Validates 7-character UK securities identifiers
- **LEI (Legal Entity Identifier)** - Validates 20-character global legal entity identifiers

### Advanced Features
- ✅ **Real-time Validation** - Instant validation with checksum correction suggestions
- 💾 **SQL Database Integration** - Built-in SQL.js database for persistent data storage
- 📊 **Analytics Dashboard** - Comprehensive statistics and visualizations
- 🔍 **Session Management** - Save, load, and manage multiple validation sessions
- 📁 **CSV Import/Export** - Easy data import and error log export
- 🔎 **Advanced Search & Filtering** - Search records by name, identifier, or error type
- 📈 **Custom SQL Queries** - Execute custom SQL queries on your data
- 🌙 **Dark Mode** - Beautiful dark/light theme toggle
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd financial-id-checker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   - The app will automatically open at `http://localhost:3000`

## 📦 Building for Production

To create an optimized production build:

```bash
npm run build
```

This creates a `build` folder with optimized production files ready for deployment.

## 📖 Usage Guide

### Uploading Data

1. Click on the **Upload** tab
2. Select a CSV file with the following columns:
   - `name` or `entity` - Entity/company name
   - `isin` - ISIN code (optional)
   - `cusip` - CUSIP code (optional)
   - `sedol` - SEDOL code (optional)
   - `lei` - LEI code (optional)

### CSV Format Example

```csv
name,isin,cusip,sedol,lei
Apple Inc.,US0378331005,037833100,2046251,5493000J0Q31P9Q6UY32
Microsoft Corporation,US5949181045,594918104,2588173,5493001KJT9GC1XR1P74
```

### Viewing Results

After uploading, navigate to the **Dashboard** tab to see:
- Total records processed
- Valid records count
- Error records count
- Warnings count
- Processing statistics

### Saving Sessions

1. After processing a file, click **Save to Database**
2. Enter a session name (e.g., "Q4 2024 Validation")
3. The session will be saved with all records and validation results

### Loading Saved Sessions

1. Go to the **Sessions** tab
2. View all saved sessions with their statistics
3. Click the eye icon to load a session
4. Click the trash icon to delete a session

### Database Features

#### Database Overview
- View total records, sessions, and errors
- Export the entire database as a `.db` file

#### Custom SQL Queries
1. Navigate to the **SQL Query** tab
2. Enter your SQL query (e.g., `SELECT * FROM identifiers WHERE status = 'ERROR' LIMIT 10`)
3. Click **Execute Query** to run it
4. View results in a formatted table

#### Available Tables

- **sessions** - Stores validation session metadata
- **identifiers** - Stores all financial identifiers and their validation status
- **validation_errors** - Stores detailed error information
- **audit_log** - Tracks all database operations

### Error Management

1. Navigate to the **Errors** tab to view detailed error information
2. Each error shows:
   - Row number and entity name
   - Field with error
   - Error message
   - Severity level
3. Export error log as CSV using the **Export Errors** button

## 🗄️ Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filename TEXT,
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_records INTEGER,
  valid_records INTEGER,
  error_records INTEGER,
  warnings INTEGER
);
```

### Identifiers Table
```sql
CREATE TABLE identifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  row_num INTEGER,
  entity_name TEXT,
  isin TEXT,
  cusip TEXT,
  sedol TEXT,
  lei TEXT,
  status TEXT,
  error_count INTEGER,
  country_code TEXT,
  issuer_code TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Validation Errors Table
```sql
CREATE TABLE validation_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier_id INTEGER,
  field TEXT,
  error_message TEXT,
  severity TEXT,
  original_value TEXT,
  corrected_value TEXT,
  FOREIGN KEY (identifier_id) REFERENCES identifiers(id)
);
```

## 🎨 Technology Stack

- **React 18.3.1** - UI framework
- **Tailwind CSS 4.1.18** - Styling
- **SQL.js** - In-browser SQLite database
- **Lucide React** - Icon library
- **React Scripts** - Build tooling

## 🔧 Troubleshooting

### Database Initialization Failed

If you see "Database initialization failed. Please refresh the page":

1. **Check Internet Connection** - SQL.js library is loaded from CDN
2. **Clear Browser Cache** - Clear localStorage and refresh
3. **Check Browser Console** - Look for specific error messages
4. **Try Incognito Mode** - Rule out browser extension conflicts

### Storage Quota Exceeded

If you get a storage quota error:

1. Export your database using the **Export Database** button
2. Clear old sessions you no longer need
3. Clear browser localStorage if necessary

### CSV Import Issues

- Ensure your CSV has proper headers (name, isin, cusip, sedol, lei)
- Check that the file is properly formatted (comma-separated)
- Verify file encoding is UTF-8

## 📝 Validation Rules

### ISIN
- Format: 2 letters (country code) + 9 alphanumeric + 1 check digit
- Example: `US0378331005`
- Validates country code and checksum

### CUSIP
- Format: 3 digits + 5 alphanumeric + 1 check digit
- Example: `037833100`
- Validates format and checksum

### SEDOL
- Format: 6 alphanumeric (excluding vowels) + 1 check digit
- Example: `2046251`
- Validates character restrictions and checksum

### LEI
- Format: 18 alphanumeric + 2 check digits
- Example: `5493000J0Q31P9Q6UY32`
- Validates format and checksum using MOD-97 algorithm

## 🔒 Data Privacy

- All data is stored locally in your browser using localStorage
- No data is sent to external servers
- Database can be exported for backup
- Clear browser data to remove all stored information

## 📄 License


This project is private and proprietary.
## Running
<img width="1920" height="1080" alt="Screenshot 2025-12-19 002832" src="https://github.com/user-attachments/assets/117fb867-93f3-4223-8e4f-b970582f7e18" />


