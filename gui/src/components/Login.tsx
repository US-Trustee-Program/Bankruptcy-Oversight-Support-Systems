import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/store';
import { addUser } from '../store/features/UserSlice';
import Api from '../models/api';
import './Login.scss';

export const Login = () => {
  const firstName = useRef<string>('');
  const lastName = useRef<string>('');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const sendUserName = async () => {
    console.log('sending user names to login endpoint');
    await Api.post('/login', {
      first_name: firstName.current,
      last_name: lastName.current,
    })
      .then((userDetails) => {
        if (userDetails) {
          const userRecord = userDetails;
          if (
            'professionalId' in userRecord &&
            'firstName' in userRecord &&
            'lastName' in userRecord
          ) {
            dispatch(
              addUser({
                id: userRecord['professionalId'] as number,
                firstName: (userRecord['firstName'] as string).trim(),
                lastName: (userRecord['lastName'] as string).trim(),
              }),
            );
          }
        }
      })
      .then(() => {
        navigate('/cases');
      })
      .catch((e) => {
        console.error(e);
      });
  };

  return (
    <div className="login-form">
      <div className="row">
        <label htmlFor="first-name">First name: </label>
        <input
          id="first-name"
          data-testid="first-name-input"
          onChange={(e) => (firstName.current = e.target.value)}
        ></input>
      </div>
      <div className="row">
        <label htmlFor="last-name">Last name: </label>
        <input
          id="last-name"
          data-testid="last-name-input"
          onChange={(e) => (lastName.current = e.target.value)}
        ></input>
      </div>
      <div className="row">
        <button data-testid="login-button" onClick={() => sendUserName()}>
          Get my Cases
        </button>
      </div>
    </div>
  );
};

export default Login;
