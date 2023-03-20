import './App.scss';
import { Routes, Route } from 'react-router-dom';
//import { Home } from './components/Home';
import { CaseList } from './components/CaseList';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/cases" element={<CaseList />}></Route>
      </Routes>
      <CaseList></CaseList>
    </div>
  );
}

export default App;
