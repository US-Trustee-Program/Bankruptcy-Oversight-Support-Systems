import { PropsWithChildren } from 'react';
import { Route, Routes } from 'react-router-dom';
import Login from './Login';
import { Logout } from './Logout';
import { LOGOUT_PATH } from './login-helpers';

export function AuthenticationRouter(props: PropsWithChildren) {
  return (
    <Routes>
      <Route path={LOGOUT_PATH} element={<Logout />}></Route>
      <Route path="*" element={<Login>{props.children}</Login>}></Route>
    </Routes>
  );
}
