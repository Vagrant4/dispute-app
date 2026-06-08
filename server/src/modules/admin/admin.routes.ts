import { Router } from 'express';
import { requireUser } from '../../middleware/requireUser.js';

export const adminRouter = Router();

adminRouter.use(requireUser);

adminRouter.get('/', (_req, res) => {
  res.json({
    message: 'Admin features are reserved for future ClaimProof SG versions.'
  });
});
