import { PropsWithChildren } from 'react';
import { Route, Routes } from 'react-router-dom';

import { Login } from './Login';
import { LOGIN_CONTINUE_PATH, LOGOUT_PATH, LOGOUT_SESSION_END_PATH } from './login-library';
import { LoginContinue } from './LoginContinue';
import { Logout } from './Logout';
import { SessionEnd } from './SessionEnd';

export function AuthenticationRoutes(props: PropsWithChildren) {
  return (
    <Routes>
      <Route element={<LoginContinue />} path={LOGIN_CONTINUE_PATH} />
      <Route element={<Logout />} path={LOGOUT_PATH}></Route>
      <Route element={<SessionEnd />} path={LOGOUT_SESSION_END_PATH}></Route>
      <Route element={<Login>{props.children}</Login>} path="*"></Route>
    </Routes>
  );
}
