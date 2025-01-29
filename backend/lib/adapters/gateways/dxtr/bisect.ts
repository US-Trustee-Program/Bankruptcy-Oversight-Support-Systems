const data: Map<number, string> = new Map([
  [1, '2024-12-10'],
  [2, '2024-12-10'],
  [3, '2024-12-10'],
  [4, '2024-12-11'],
  [5, '2024-12-11'],
  [6, '2024-12-11'],
  [7, '2024-12-12'],
  [8, '2024-12-12'],
  [9, '2024-12-12'],
  [10, '2024-12-13'],
  [11, '2024-12-13'],
  [12, '2024-12-13'],
  [13, '2024-12-14'],
  [14, '2024-12-14'],
  [15, '2024-12-14'],
  [16, '2024-12-15'],
  [17, '2024-12-15'],
  [18, '2024-12-15'],
  [19, '2024-12-16'],
  [20, '2024-12-16'],
  [21, '2024-12-17'],
  [22, '2024-12-17'],
  [23, '2024-12-17'],
  [24, '2024-12-19'],
]);

export function findFirstByDate(minTxId: number, maxTxId: number, date: string) {
  if (minTxId === maxTxId) {
    if (data.get(minTxId) === date) {
      return minTxId;
    } else {
      return -1;
    }
  }

  const mid = Math.floor((maxTxId + minTxId) / 2);
  const midDate = data.get(mid);
  if (midDate >= date) {
    return findFirstByDate(minTxId, mid, date);
  } else {
    return findFirstByDate(mid + 1, maxTxId, date);
  }
}

export function findLastByDate(minTxId: number, maxTxId: number, date: string) {
  if (minTxId === maxTxId) {
    if (data.get(minTxId) === date) {
      return minTxId;
    } else {
      return -1;
    }
  }

  const mid = Math.ceil((maxTxId + minTxId) / 2);
  const midDate = data.get(mid);
  if (midDate <= date) {
    return findLastByDate(mid, maxTxId, date);
  } else {
    return findLastByDate(minTxId, mid - 1, date);
  }
}
