import React, { Dispatch, SetStateAction } from 'react';

// <S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
// <S = undefined>(initialState: S): [S | undefined, Dispatch<SetStateAction<S | undefined>>];

function _useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
function _useState<S = undefined>(
  initialState: S,
): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
function _useState<S>(initialValue: S) {
  return React.useState<S>(initialValue);
}

export const useState = _useState;
