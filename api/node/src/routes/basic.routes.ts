/**
 * Basic Routes is a catchall for routes not caught by more specifically defined routes.
 * This will be used for miscelaneous routes.
 */

import express from 'express';
import controller from '../adapters/controllers/basic.controller.js';
import makeCallback from './../adapters/express-callback.js';

const router = express.Router();

router.get('/', makeCallback(controller.getHello));
router.get('/healthcheck', makeCallback(controller.getHealthCheck));

export default router;
