import React from 'react';
import './App.css';
import { Header } from './components/Header';

function App() {
  return (
    <>
      <Header />
      <div className="App">
        <h1>Total Active Cases:</h1>
        <p>154,221</p>
      </div>
    </>
  );
}

export default App;
