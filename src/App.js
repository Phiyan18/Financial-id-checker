import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, AlertTriangle, Download, BarChart3, FileText, Search, Filter, TrendingUp, Database, Eye, RefreshCw, Zap, Shield, Calendar, Save, History, Trash2, Plus } from 'lucide-react';

const FinancialIdentifierChecker = () => {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('row');
  const [darkMode, setDarkMode] = useState(false);
  const [processingStats, setProcessingStats] = useState(null);
  
  // Database features
  const [db, setDb] = useState(null);
  const [savedSessions, setSavedSessions] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dbStats, setDbStats] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [customQuery, setCustomQuery] = useState('');

  // Initialize SQL.js database
  useEffect(() => {
    const loadSqlJs = async () => {
      // Check if script is already loaded
      if (window.initSqlJs) {
        initDatabase();
        return;
      }

      // Check if script tag already exists
      const existingScript = document.querySelector('script[src*="sql-wasm.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', initDatabase);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
      script.async = true;
      script.onload = () => initDatabase();
      script.onerror = () => {
        console.error('Failed to load SQL.js library');
        alert('Failed to load database library. Please check your internet connection and refresh the page.');
      };
      document.body.appendChild(script);
    };
    loadSqlJs();
  }, []);

  const initDatabase = async () => {
    try {
      // Wait for SQL.js to be available (with timeout)
      let retries = 0;
      const maxRetries = 50; // 5 seconds max wait
      while (!window.initSqlJs && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (!window.initSqlJs) {
        throw new Error('SQL.js library failed to load. Please refresh the page.');
      }

      const SQL = await window.initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });
      
      // Try to load existing database from storage
      const savedDb = localStorage.getItem('financial_db');
      let database;
      
      if (savedDb) {
        try {
          // Load existing database
          const uint8Array = new Uint8Array(JSON.parse(savedDb));
          database = new SQL.Database(uint8Array);
        } catch (error) {
          console.error('Error loading saved database, creating new one:', error);
          // If loading fails, create a new database
          database = new SQL.Database();
        }
      } else {
        // Create new database
        database = new SQL.Database();
      }
      
      // Create tables
      database.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          filename TEXT,
          upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          total_records INTEGER,
          valid_records INTEGER,
          error_records INTEGER,
          warnings INTEGER
        );
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS identifiers (
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
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS validation_errors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier_id INTEGER,
          field TEXT,
          error_message TEXT,
          severity TEXT,
          original_value TEXT,
          corrected_value TEXT,
          FOREIGN KEY (identifier_id) REFERENCES identifiers(id)
        );
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT,
          session_id INTEGER,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      setDb(database);
      loadSavedSessions(database);
      calculateDbStats(database);
    } catch (error) {
      console.error('Database initialization error:', error);
      alert('Database initialization failed. Please refresh the page.');
    }
  };

  const saveDbToStorage = async (database) => {
    try {
      const data = database.export();
      const array = Array.from(data);
      localStorage.setItem('financial_db', JSON.stringify(array));
    } catch (error) {
      console.error('Error saving database to storage:', error);
      // If storage quota is exceeded, try to clear old data or notify user
      if (error.name === 'QuotaExceededError') {
        alert('Storage quota exceeded. Please clear some data or export your database.');
      }
    }
  };

  const loadSavedSessions = (database) => {
    try {
      const stmt = database.prepare('SELECT * FROM sessions ORDER BY upload_date DESC');
      const sessions = [];
      while (stmt.step()) {
        sessions.push(stmt.getAsObject());
      }
      stmt.free();
      setSavedSessions(sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const calculateDbStats = (database) => {
    try {
      const totalRecords = database.exec('SELECT COUNT(*) as count FROM identifiers')[0]?.values[0][0] || 0;
      const totalSessions = database.exec('SELECT COUNT(*) as count FROM sessions')[0]?.values[0][0] || 0;
      const totalErrors = database.exec('SELECT COUNT(*) as count FROM validation_errors')[0]?.values[0][0] || 0;
      
      setDbStats({
        totalRecords,
        totalSessions,
        totalErrors
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const saveToDatabase = async () => {
    if (!db || !results || !sessionName) {
      alert('Please provide a session name');
      return;
    }

    try {
      // Insert session
      db.run(
        'INSERT INTO sessions (name, filename, total_records, valid_records, error_records, warnings) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionName, file?.name || 'Unknown', results.total, results.valid, results.errors, results.warnings]
      );

      const sessionId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

      // Insert all records
      const allRecords = [...results.validRecords, ...results.errorRecords];
      allRecords.forEach(record => {
        const countryCode = record.metadata?.isin?.countryCode || null;
        const issuerCode = record.metadata?.cusip?.issuerCode || null;
        
        db.run(
          `INSERT INTO identifiers (session_id, row_num, entity_name, isin, cusip, sedol, lei, status, error_count, country_code, issuer_code) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId,
            record.rowNum,
            record.name,
            record.corrected.isin || record.isin || '',
            record.corrected.cusip || record.cusip || '',
            record.corrected.sedol || record.sedol || '',
            record.corrected.lei || record.lei || '',
            record.errors.length > 0 ? 'ERROR' : 'VALID',
            record.errors.length,
            countryCode,
            issuerCode
          ]
        );

        const identifierId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

        // Insert errors for this record
        record.errors.forEach(error => {
          db.run(
            'INSERT INTO validation_errors (identifier_id, field, error_message, severity, original_value, corrected_value) VALUES (?, ?, ?, ?, ?, ?)',
            [
              identifierId,
              error.field,
              error.error,
              error.severity,
              record[error.field.toLowerCase()],
              record.corrected[error.field.toLowerCase()] || null
            ]
          );
        });
      });

      // Insert audit log
      db.run(
        'INSERT INTO audit_log (action, session_id, details) VALUES (?, ?, ?)',
        ['SAVE_SESSION', sessionId, `Saved ${results.total} records`]
      );

      // Save database to persistent storage
      await saveDbToStorage(db);

      loadSavedSessions(db);
      calculateDbStats(db);
      setShowSaveModal(false);
      setSessionName('');
      alert('Session saved successfully!');
    } catch (error) {
      console.error('Error saving to database:', error);
      alert('Error saving session: ' + error.message);
    }
  };

  const loadSession = (sessionId) => {
    try {
      // Load session details
      const sessionStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
      sessionStmt.bind([sessionId]);
      sessionStmt.step();
      const session = sessionStmt.getAsObject();
      sessionStmt.free();

      // Load identifiers
      const identifiersStmt = db.prepare('SELECT * FROM identifiers WHERE session_id = ?');
      identifiersStmt.bind([sessionId]);
      
      const validRecords = [];
      const errorRecords = [];
      
      while (identifiersStmt.step()) {
        const record = identifiersStmt.getAsObject();
        
        // Load errors for this record
        const errorsStmt = db.prepare('SELECT * FROM validation_errors WHERE identifier_id = ?');
        errorsStmt.bind([record.id]);
        const errors = [];
        while (errorsStmt.step()) {
          errors.push(errorsStmt.getAsObject());
        }
        errorsStmt.free();

        const formattedRecord = {
          rowNum: record.row_num,
          name: record.entity_name,
          isin: record.isin,
          cusip: record.cusip,
          sedol: record.sedol,
          lei: record.lei,
          errors: errors.map(e => ({
            field: e.field,
            error: e.error_message,
            severity: e.severity
          })),
          corrected: {},
          metadata: {
            isin: record.country_code ? { countryCode: record.country_code } : {},
            cusip: record.issuer_code ? { issuerCode: record.issuer_code } : {}
          },
          warnings: [],
          crossRefIssues: []
        };

        if (record.status === 'ERROR') {
          errorRecords.push(formattedRecord);
        } else {
          validRecords.push(formattedRecord);
        }
      }
      identifiersStmt.free();

      setResults({
        total: session.total_records,
        valid: session.valid_records,
        errors: session.error_records,
        warnings: session.warnings,
        validRecords,
        errorRecords,
        warningsList: [],
        crossRefList: [],
        identifierStats: {
          isin: validRecords.filter(r => r.isin).length + errorRecords.filter(r => r.isin).length,
          cusip: validRecords.filter(r => r.cusip).length + errorRecords.filter(r => r.cusip).length,
          sedol: validRecords.filter(r => r.sedol).length + errorRecords.filter(r => r.sedol).length,
          lei: validRecords.filter(r => r.lei).length + errorRecords.filter(r => r.lei).length,
        }
      });

      setActiveTab('summary');
      alert(`Loaded session: ${session.name}`);
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Error loading session: ' + error.message);
    }
  };

  const deleteSession = (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      db.run('DELETE FROM validation_errors WHERE identifier_id IN (SELECT id FROM identifiers WHERE session_id = ?)', [sessionId]);
      db.run('DELETE FROM identifiers WHERE session_id = ?', [sessionId]);
      db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
      db.run('INSERT INTO audit_log (action, session_id, details) VALUES (?, ?, ?)', ['DELETE_SESSION', sessionId, 'Session deleted']);
      
      loadSavedSessions(db);
      calculateDbStats(db);
      alert('Session deleted successfully');
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Error deleting session: ' + error.message);
    }
  };

  const executeCustomQuery = () => {
    if (!db || !customQuery) return;

    try {
      const result = db.exec(customQuery);
      setQueryResults(result);
    } catch (error) {
      alert('Query error: ' + error.message);
      setQueryResults(null);
    }
  };

  const exportDatabase = () => {
    if (!db) return;
    
    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_id_database_${new Date().toISOString().split('T')[0]}.db`;
    a.click();
  };

  // Validation functions remain the same
  const validateISIN = (isin) => {
    if (!isin || typeof isin !== 'string') return { valid: false, error: 'Missing or invalid ISIN', severity: 'high' };
    isin = isin.toUpperCase().trim();
    
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
      return { valid: false, error: 'Invalid ISIN format', severity: 'high' };
    }

    const countryCode = isin.substring(0, 2);
    const digits = isin.split('').map(c => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? code - 55 : c;
    }).join('');

    let sum = 0;
    let isOdd = true;
    for (let i = digits.length - 2; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      if (isOdd) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isOdd = !isOdd;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const valid = checkDigit === parseInt(isin[isin.length - 1]);

    return { 
      valid, 
      error: valid ? null : `Invalid checksum`,
      corrected: valid ? null : isin.slice(0, -1) + checkDigit,
      severity: valid ? null : 'medium',
      metadata: { countryCode, type: 'ISIN' }
    };
  };

  const validateCUSIP = (cusip) => {
    if (!cusip || typeof cusip !== 'string') return { valid: false, error: 'Missing or invalid CUSIP', severity: 'high' };
    cusip = cusip.toUpperCase().trim();
    
    if (!/^[0-9]{3}[A-Z0-9]{5}[0-9]$/.test(cusip)) {
      return { valid: false, error: 'Invalid CUSIP format', severity: 'high' };
    }

    let sum = 0;
    for (let i = 0; i < 8; i++) {
      let code = cusip.charCodeAt(i);
      let value = code >= 48 && code <= 57 ? code - 48 : code - 55;
      if (i % 2 === 1) value *= 2;
      sum += Math.floor(value / 10) + (value % 10);
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const valid = checkDigit === parseInt(cusip[8]);

    return { 
      valid, 
      error: valid ? null : `Invalid checksum`,
      corrected: valid ? null : cusip.slice(0, 8) + checkDigit,
      severity: valid ? null : 'medium',
      metadata: { issuerCode: cusip.substring(0, 6), type: 'CUSIP' }
    };
  };

  const validateSEDOL = (sedol) => {
    if (!sedol || typeof sedol !== 'string') return { valid: false, error: 'Missing or invalid SEDOL', severity: 'high' };
    sedol = sedol.toUpperCase().trim();
    
    if (!/^[B-DF-HJ-NP-TV-Z0-9]{6}[0-9]$/.test(sedol)) {
      return { valid: false, error: 'Invalid SEDOL format', severity: 'high' };
    }

    const weights = [1, 3, 1, 7, 3, 9];
    let sum = 0;
    for (let i = 0; i < 6; i++) {
      const code = sedol.charCodeAt(i);
      const value = code >= 48 && code <= 57 ? code - 48 : code - 55;
      sum += value * weights[i];
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const valid = checkDigit === parseInt(sedol[6]);

    return { 
      valid, 
      error: valid ? null : `Invalid checksum`,
      corrected: valid ? null : sedol.slice(0, 6) + checkDigit,
      severity: valid ? null : 'medium',
      metadata: { type: 'SEDOL' }
    };
  };

  const validateLEI = (lei) => {
    if (!lei || typeof lei !== 'string') return { valid: false, error: 'Missing or invalid LEI', severity: 'high' };
    lei = lei.toUpperCase().trim();
    
    if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei)) {
      return { valid: false, error: 'Invalid LEI format', severity: 'high' };
    }

    const rearranged = lei.slice(0, 18) + '00';
    const digits = rearranged.split('').map(c => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? code - 55 : c;
    }).join('');

    let remainder = '';
    for (let i = 0; i < digits.length; i++) {
      remainder += digits[i];
      remainder = (parseInt(remainder) % 97).toString();
    }

    const checkDigits = 98 - parseInt(remainder);
    const expected = checkDigits.toString().padStart(2, '0');
    const valid = lei.slice(18) === expected;

    return { 
      valid, 
      error: valid ? null : `Invalid checksum`,
      corrected: valid ? null : lei.slice(0, 18) + expected,
      severity: valid ? null : 'medium',
      metadata: { louCode: lei.substring(0, 4), type: 'LEI' }
    };
  };

  const processFile = async (uploadedFile) => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const isinIdx = headers.indexOf('isin');
      const cusipIdx = headers.indexOf('cusip');
      const sedolIdx = headers.indexOf('sedol');
      const leiIdx = headers.indexOf('lei');
      const nameIdx = headers.indexOf('name') >= 0 ? headers.indexOf('name') : headers.indexOf('entity');

      const validRecords = [];
      const errorRecords = [];
      const warnings = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record = {
          rowNum: i + 1,
          name: nameIdx >= 0 ? values[nameIdx] : `Row ${i + 1}`,
          isin: isinIdx >= 0 ? values[isinIdx] : '',
          cusip: cusipIdx >= 0 ? values[cusipIdx] : '',
          sedol: sedolIdx >= 0 ? values[sedolIdx] : '',
          lei: leiIdx >= 0 ? values[leiIdx] : '',
          errors: [],
          warnings: [],
          corrected: {},
          metadata: {},
          crossRefIssues: []
        };

        if (record.isin) {
          const result = validateISIN(record.isin);
          if (!result.valid) {
            record.errors.push({ field: 'ISIN', error: result.error, severity: result.severity });
            if (result.corrected) {
              record.corrected.isin = result.corrected;
              record.warnings.push(`ISIN corrected: ${record.isin} → ${result.corrected}`);
            }
          } else {
            record.metadata.isin = result.metadata;
          }
        }

        if (record.cusip) {
          const result = validateCUSIP(record.cusip);
          if (!result.valid) {
            record.errors.push({ field: 'CUSIP', error: result.error, severity: result.severity });
            if (result.corrected) {
              record.corrected.cusip = result.corrected;
              record.warnings.push(`CUSIP corrected: ${record.cusip} → ${result.corrected}`);
            }
          } else {
            record.metadata.cusip = result.metadata;
          }
        }

        if (record.sedol) {
          const result = validateSEDOL(record.sedol);
          if (!result.valid) {
            record.errors.push({ field: 'SEDOL', error: result.error, severity: result.severity });
            if (result.corrected) {
              record.corrected.sedol = result.corrected;
              record.warnings.push(`SEDOL corrected: ${record.sedol} → ${result.corrected}`);
            }
          } else {
            record.metadata.sedol = result.metadata;
          }
        }

        if (record.lei) {
          const result = validateLEI(record.lei);
          if (!result.valid) {
            record.errors.push({ field: 'LEI', error: result.error, severity: result.severity });
            if (result.corrected) {
              record.corrected.lei = result.corrected;
              record.warnings.push(`LEI corrected: ${record.lei} → ${result.corrected}`);
            }
          } else {
            record.metadata.lei = result.metadata;
          }
        }

        if (record.errors.length > 0) {
          errorRecords.push(record);
        } else {
          validRecords.push(record);
        }

        if (record.warnings.length > 0) {
          warnings.push(...record.warnings.map(w => ({ rowNum: record.rowNum, name: record.name, warning: w })));
        }
      }

      const processingTime = Date.now() - startTime;

      setResults({
        total: lines.length - 1,
        valid: validRecords.length,
        errors: errorRecords.length,
        warnings: warnings.length,
        crossRefIssues: 0,
        validRecords,
        errorRecords,
        warningsList: warnings,
        crossRefList: [],
        identifierStats: {
          isin: validRecords.filter(r => r.isin).length + errorRecords.filter(r => r.isin).length,
          cusip: validRecords.filter(r => r.cusip).length + errorRecords.filter(r => r.cusip).length,
          sedol: validRecords.filter(r => r.sedol).length + errorRecords.filter(r => r.sedol).length,
          lei: validRecords.filter(r => r.lei).length + errorRecords.filter(r => r.lei).length,
        }
      });

      setProcessingStats({
        time: processingTime,
        recordsPerSecond: ((lines.length - 1) / (processingTime / 1000)).toFixed(2),
        fileSize: (uploadedFile.size / 1024).toFixed(2) + ' KB'
      });

      setActiveTab('summary');
    } catch (error) {
      alert('Error processing file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      processFile(uploadedFile);
    }
  };

  const downloadErrorLog = () => {
    if (!results) return;
    
    let csv = 'Row,Entity,Field,Error,Severity,Original Value,Corrected Value\n';
    results.errorRecords.forEach(record => {
      record.errors.forEach(err => {
        const original = record[err.field.toLowerCase()];
        const corrected = record.corrected[err.field.toLowerCase()] || 'N/A';
        csv += `${record.rowNum},"${record.name}",${err.field},"${err.error}",${err.severity},${original},${corrected}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredRecords = results ? 
    [...results.validRecords, ...results.errorRecords]
      .filter(record => {
        const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.isin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.cusip.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || 
                            (filterType === 'errors' && record.errors.length > 0) ||
                            (filterType === 'valid' && record.errors.length === 0);
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'row') return a.rowNum - b.rowNum;
        if (sortBy === 'errors') return b.errors.length - a.errors.length;
        return a.name.localeCompare(b.name);
      })
    : [];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50'} transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl overflow-hidden mb-6`}>
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-10 h-10" />
                  <h1 className="text-4xl font-bold">Financial ID Validator Pro</h1>
                </div>
                <p className="text-indigo-100 text-lg">Enterprise SQL Database with Advanced Analytics</p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
            
            {dbStats && (
              <div className="flex gap-4 mt-6">
                <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span className="text-sm">{dbStats.totalRecords} DB Records</span>
                  </div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    <span className="text-sm">{dbStats.totalSessions} Sessions</span>
                  </div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">{dbStats.totalErrors} Total Errors</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <nav className="flex overflow-x-auto">
              {[
                { id: 'upload', label: 'Upload', icon: Upload },
                { id: 'summary', label: 'Dashboard', icon: BarChart3 },
                { id: 'database', label: 'Database', icon: Database },
                { id: 'sessions', label: 'Sessions', icon: History },
                { id: 'query', label: 'SQL Query', icon: Search },
                { id: 'errors', label: 'Errors', icon: XCircle }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-4 font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? `border-b-2 border-indigo-600 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`
                        : `${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'upload' && (
              <div className="space-y-6">
                <div className={`border-2 border-dashed ${darkMode ? 'border-gray-600 hover:border-indigo-500 bg-gray-800' : 'border-gray-300 hover:border-indigo-500 bg-gradient-to-br from-white to-indigo-50'} rounded-2xl p-12 text-center transition-all duration-300`}>
                  <Upload className={`mx-auto h-20 w-20 ${darkMode ? 'text-gray-500' : 'text-indigo-400'} mb-6 animate-bounce`} />
                  <h3 className={`text-2xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Upload Your Data File</h3>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6 text-lg`}>
                    CSV format - Results will be auto-saved to SQL database
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl cursor-pointer hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg font-semibold"
                  >
                    {loading ? 'Processing...' : 'Choose File'}
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'summary' && results && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <Database className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm uppercase mb-2">Total Records</p>
                    <p className="text-4xl font-bold">{results.total}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm uppercase mb-2">Valid</p>
                    <p className="text-4xl font-bold">{results.valid}</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                    <XCircle className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm uppercase mb-2">Errors</p>
                    <p className="text-4xl font-bold">{results.errors}</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
                    <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm uppercase mb-2">Warnings</p>
                    <p className="text-4xl font-bold">{results.warnings}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg font-semibold"
                  >
                    <Save className="w-5 h-5" />
                    Save to Database
                  </button>
                  <button
                    onClick={downloadErrorLog}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Export Errors
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <div className="space-y-6">
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
                  <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Database Overview</h3>
                  
                  {dbStats && (
                    <div className="grid grid-cols-3 gap-6 mb-6">
                      <div className={`${darkMode ? 'bg-gray-700' : 'bg-blue-50'} rounded-lg p-4`}>
                        <Database className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'} mb-2`} />
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Records</p>
                        <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dbStats.totalRecords}</p>
                      </div>
                      <div className={`${darkMode ? 'bg-gray-700' : 'bg-green-50'} rounded-lg p-4`}>
                        <Save className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'} mb-2`} />
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Saved Sessions</p>
                        <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dbStats.totalSessions}</p>
                      </div>
                      <div className={`${darkMode ? 'bg-gray-700' : 'bg-red-50'} rounded-lg p-4`}>
                        <AlertTriangle className={`w-8 h-8 ${darkMode ? 'text-red-400' : 'text-red-600'} mb-2`} />
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Errors</p>
                        <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dbStats.totalErrors}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={exportDatabase}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Export Database (.db file)
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Saved Sessions ({savedSessions.length})
                </h3>
                
                {savedSessions.length === 0 ? (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-xl p-12 text-center`}>
                    <History className={`w-16 h-16 ${darkMode ? 'text-gray-600' : 'text-gray-400'} mx-auto mb-4`} />
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No saved sessions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedSessions.map((session) => (
                      <div key={session.id} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6 shadow-lg`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                              {session.name}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                              <div>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} uppercase`}>File</p>
                                <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{session.filename}</p>
                              </div>
                              <div>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} uppercase`}>Total</p>
                                <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{session.total_records}</p>
                              </div>
                              <div>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} uppercase`}>Valid</p>
                                <p className="font-medium text-green-600">{session.valid_records}</p>
                              </div>
                              <div>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} uppercase`}>Errors</p>
                                <p className="font-medium text-red-600">{session.error_records}</p>
                              </div>
                              <div>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} uppercase`}>Date</p>
                                <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {new Date(session.upload_date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => loadSession(session.id)}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'query' && (
              <div className="space-y-6">
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
                  <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Custom SQL Query
                  </h3>
                  
                  <textarea
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="Enter SQL query... Example: SELECT * FROM identifiers WHERE status = 'ERROR' LIMIT 10"
                    className={`w-full h-32 p-4 ${darkMode ? 'bg-gray-900 text-white border-gray-700' : 'bg-gray-50 border-gray-300'} border rounded-lg font-mono text-sm`}
                  />
                  
                  <div className="flex gap-4 mt-4">
                    <button
                      onClick={executeCustomQuery}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold"
                    >
                      Execute Query
                    </button>
                    <button
                      onClick={() => setCustomQuery('SELECT * FROM identifiers WHERE error_count > 0 LIMIT 20')}
                      className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-all`}
                    >
                      Load Sample Query
                    </button>
                  </div>
                </div>

                {queryResults && (
                  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg overflow-x-auto`}>
                    <h4 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Query Results
                    </h4>
                    {queryResults.map((result, idx) => (
                      <div key={idx} className="mb-6">
                        <table className="w-full text-sm">
                          <thead className={`${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                            <tr>
                              {result.columns.map((col, i) => (
                                <th key={i} className={`px-4 py-2 text-left font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.values.map((row, i) => (
                              <tr key={i} className={`${darkMode ? 'border-gray-700' : 'border-gray-200'} border-t`}>
                                {row.map((cell, j) => (
                                  <td key={j} className={`px-4 py-2 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className={`mt-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {result.values.length} row(s) returned
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'errors' && results && (
              <div className="space-y-4">
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Error Details ({results.errorRecords.length})
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {results.errorRecords.map((record, idx) => (
                    <div key={idx} className={`${darkMode ? 'bg-red-900 bg-opacity-20 border-red-700' : 'bg-red-50 border-red-500'} border-l-4 rounded-xl p-6 shadow-lg`}>
                      <h4 className={`font-bold text-lg ${darkMode ? 'text-red-300' : 'text-red-900'} mb-4`}>
                        Row {record.rowNum}: {record.name}
                      </h4>
                      <div className="space-y-3">
                        {record.errors.map((err, i) => (
                          <div key={i} className={`${darkMode ? 'bg-gray-800 bg-opacity-50' : 'bg-white bg-opacity-50'} rounded-lg p-4`}>
                            <span className={`px-3 py-1 ${darkMode ? 'bg-red-800' : 'bg-red-200'} rounded-lg text-xs font-bold uppercase`}>
                              {err.field}
                            </span>
                            <p className={`mt-2 ${darkMode ? 'text-red-300' : 'text-red-800'}`}>{err.error}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl`}>
            <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Save Session to Database
            </h3>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
              Enter a name for this validation session
            </p>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Q4 2024 Validation"
              className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-900 text-white border-gray-700' : 'bg-gray-50 border-gray-300'} border rounded-lg mb-6`}
            />
            <div className="flex gap-4">
              <button
                onClick={saveToDatabase}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className={`flex-1 px-6 py-3 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-all font-semibold`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialIdentifierChecker;