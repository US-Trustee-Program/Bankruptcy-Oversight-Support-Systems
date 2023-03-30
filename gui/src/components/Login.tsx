import { useState } from 'react';

export const Login = () => {
  const [userId, setUserId] = useState<string>('');

  const sendUserId = (userName: string) => {
    console.log(userName);
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
