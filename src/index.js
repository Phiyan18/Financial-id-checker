import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import FinancialIdentifierChecker from './App';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <FinancialIdentifierChecker />
  </React.StrictMode>
);
