import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/store';
import { addUser } from '../store/features/UserSlice';
import Api from '../models/api';

export const Login = () => {
  const firstName = useRef<string>('');
  const lastName = useRef<string>('');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const sendUserName = async () => {
    console.log('sending user names to login endpoint');
    await Api.post('/users/login', { firstName: firstName.current, lastName: lastName.current })
      .then((userDetails) => {
        if (userDetails.body && Array.isArray(userDetails.body)) {
          const userRecord = userDetails.body[0];
          if (
            'professional_id' in userRecord &&
            'first_name' in userRecord &&
            'last_name' in userRecord
          ) {
            dispatch(
              addUser({
                id: userRecord.professional_id as number,
                firstName: (userRecord.first_name as string).trim(),
                lastName: (userRecord.last_name as string).trim(),
              }),
            );
          }
        }
      })
      .then(() => {
        console.log('navigating to cases screen');
        navigate('/cases');
      })
      .catch((e) => {
        console.error(e);
      });
  };

  return (
    <div>
      <label htmlFor="first-name">First name: </label>
      <input id="first-name" onChange={(e) => (firstName.current = e.target.value)}></input>
      <br />
      <label htmlFor="last-name">Last name: </label>
      <input id="last-name" onChange={(e) => (lastName.current = e.target.value)}></input>
      <button onClick={() => sendUserName()}>Get my Cases</button>
    </div>
  );
};

export default Login;
