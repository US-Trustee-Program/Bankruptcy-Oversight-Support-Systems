import { Express } from 'express';
import basicRoutes from './basic.routes.js';
import chapterRoutes from './chapter.routes.js';
import caseRoutes from './case.routes.js';

export default function loadRoutes(app: Express): void {
  app.use('/cases', caseRoutes);
  app.use('/chapters', chapterRoutes);
  app.use('/', basicRoutes);
}
