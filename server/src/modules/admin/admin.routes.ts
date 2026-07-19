import { Router } from 'express';
import { SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';

export const adminRouter = Router();

adminRouter.use(requireUser);

adminRouter.get('/', (_req, res) => {
  res.json({
    message: 'Admin features are reserved for future ClaimProof SG versions.'
  });
});

adminRouter.get('/metrics', async (_req, res) => {
  const monthlyActiveSince = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const [registeredActiveUsers, monthlyActiveUsers, activeSubscriptions, trialingSubscriptions, activeRevenueRows] =
    await Promise.all([
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          lastSeenAt: { gte: monthlyActiveSince }
        }
      }),
      prisma.userSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.userSubscription.count({ where: { status: SubscriptionStatus.TRIALING } }),
      prisma.userSubscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        select: { monthlyRecurringCents: true, currency: true }
      })
    ]);

  const mrrByCurrency = activeRevenueRows.reduce<Record<string, number>>((summary, row) => {
    summary[row.currency] = (summary[row.currency] ?? 0) + row.monthlyRecurringCents;
    return summary;
  }, {});

  res.json({
    metrics: {
      registeredActiveUsers,
      monthlyActiveUsers,
      activeSubscriptions,
      trialingSubscriptions,
      mrrByCurrency,
      generatedAt: new Date().toISOString()
    }
  });
});
