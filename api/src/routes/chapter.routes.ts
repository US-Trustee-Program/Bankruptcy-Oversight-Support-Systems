/**
 * Chapter Routes are routes that begin with /chapters as the root path.
 */

import express from 'express';
import controller from '../adapters/controllers/chapters.controller.js';
import makeCallback from './../adapters/express-callback.js';

const router = express.Router();

router.get('', makeCallback(controller.getAllChapters));

export default router;
