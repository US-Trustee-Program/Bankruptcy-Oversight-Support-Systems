import { Express } from 'express';
import basicRoutes from './basic.routes';
import chapterRoutes from './chapter.routes';
import caseRoutes from './case.routes';

export default function loadRoutes(app: Express): void {
  app.use('/cases', caseRoutes);
  app.use('/chapters', chapterRoutes);
  app.use('/', basicRoutes);
}
