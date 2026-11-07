import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './app/App.jsx';
import '../tempPage/styles.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(<App />);
