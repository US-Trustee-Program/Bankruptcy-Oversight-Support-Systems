import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
}

interface UserState {
  user: User;
}

const initialState = {
  user: {
    id: 0,
    firstName: '',
    lastName: '',
  },
} as UserState;

export const UserSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    addUser: (
      state,
      action: PayloadAction<{ id: number; firstName: string; lastName: string }>,
    ) => {
      state.user = {
        id: action.payload.id,
        firstName: action.payload.firstName,
        lastName: action.payload.lastName,
      };
    },
  },
});

export default UserSlice.reducer;
export const { addUser } = UserSlice.actions;
