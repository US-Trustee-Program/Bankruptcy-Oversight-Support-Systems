import { useState } from 'react';
import api from '../models/api';

export const Login = () => {
  const [userId, setUserId] = useState<string>('');

  const sendUserId = (userName: string) => {
    api.post('/login', { userName: userName }).then((res) => {
      (res.body as []).forEach((row) => {});
    });
  };

  return (
    <form className="LoginForm">
      <div>
        <input value={userId} onChange={(e) => sendUserId(e.target.value)}></input>
      </div>
    </form>
  );
};

export default Login;
