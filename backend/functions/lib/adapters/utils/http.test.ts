const fetchSpy = jest
  .spyOn(global, 'fetch')
  .mockImplementation((_url: string, { method: string, headers: {}, body: string }) => {
    // has to return a Promise<Response>
    return;
  });
