/**
 * Case Routes are routes that begin with /cases as the root path.
 */

import express from 'express';
import controller from '../adapters/controllers/cases.controller.js';
import makeCallback from './../adapters/express-callback.js';

const router = express.Router();

router.post('/create', makeCallback(controller.createCase));
router.get('', makeCallback(controller.getAllCases));
router.get('/:caseId', makeCallback(controller.getCase));
router.put('/:caseId', makeCallback(controller.updateCase));
router.delete('/:caseId', makeCallback(controller.deleteCase));

export default router;
