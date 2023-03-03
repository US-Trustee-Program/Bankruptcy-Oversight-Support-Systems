import { httpSuccess } from "../utils/http";

const NAMESPACE = 'BASIC-ENDPOINTS-CONTROLLER';

const getHealthCheck = async (httpRequest: Request) => {
  const response = {
    message: 'Health Check OK',
    count: 1,
    body: 'OK',
    success: true,
  };
  return httpSuccess(response);
}

const getHello = async (httpRequest: Request) => {
  const response = {
    message: 'Hello World',
    count: 1,
    body: 'hello',
    success: true,
  };
  return httpSuccess(response);
}

export default { getHealthCheck, getHello };