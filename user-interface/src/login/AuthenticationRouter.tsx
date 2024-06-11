import { PropsWithChildren } from 'react';
import { Route, Routes } from 'react-router-dom';
import Login from './Login';
import { Logout } from './Logout';
import { LOGIN_CONTINUE_PATH, LOGOUT_PATH, LOGOUT_SESSION_END_PATH } from './login-helpers';
import { LoginContinue } from './LoginContinue';
import { SessionEnd } from './SessionEnd';

export function AuthenticationRouter(props: PropsWithChildren) {
  return (
    <Routes>
      <Route path={LOGIN_CONTINUE_PATH} element={<LoginContinue />} />
      <Route path={LOGOUT_PATH} element={<Logout />}></Route>
      <Route path={LOGOUT_SESSION_END_PATH} element={<SessionEnd />}></Route>
      <Route path="*" element={<Login>{props.children}</Login>}></Route>
    </Routes>
  );
}
