import { Router } from 'express';
import { SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { deleteAccountByAdmin } from '../auth/accountDeletion.service.js';
import { createTrialSubscriptionForUser, trialDays } from '../subscription/subscription.service.js';

export const adminRouter = Router();

adminRouter.use(requireUser, requireAdmin);

adminRouter.get('/', (req, res) => {
  res.json({
    admin: {
      id: req.user!.id,
      email: req.user!.email
    },
    capabilities: [
      'metrics',
      'user_search',
      'suspend',
      'unsuspend',
      'trial_management',
      'account_deletion',
      'audit_log'
    ]
  });
});

adminRouter.get('/metrics', async (_req, res, next) => {
  try {
    const now = new Date();
    const sevenDaysAgo = addDays(now, -7);
    const thirtyDaysAgo = addDays(now, -30);
    const sevenDaysAhead = addDays(now, 7);

    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      monthlyActiveUsers,
      newUsers7d,
      newUsers30d,
      trialingSubscriptions,
      trialsExpiring7d,
      expiredTrials,
      activeSubscriptions,
      pastDueSubscriptions,
      canceledSubscriptions,
      activeRevenueRows
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { status: UserStatus.PENDING_EMAIL_VERIFICATION } }),
      prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          lastSeenAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.userSubscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { gt: now }
        }
      }),
      prisma.userSubscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { gt: now, lte: sevenDaysAhead }
        }
      }),
      prisma.userSubscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { lte: now }
        }
      }),
      prisma.userSubscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gt: now }
        }
      }),
      prisma.userSubscription.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
      prisma.userSubscription.count({ where: { status: SubscriptionStatus.CANCELED } }),
      prisma.userSubscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gt: now }
        },
        select: { monthlyRecurringCents: true, currency: true }
      })
    ]);

    const mrrByCurrency = activeRevenueRows.reduce<Record<string, number>>((summary, row) => {
      summary[row.currency] = (summary[row.currency] ?? 0) + row.monthlyRecurringCents;
      return summary;
    }, {});

    const verifiedUsers = activeUsers + suspendedUsers;
    const paidConversionRate =
      verifiedUsers > 0 ? Number(((activeSubscriptions / verifiedUsers) * 100).toFixed(2)) : 0;

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        monthlyActiveUsers,
        newUsers7d,
        newUsers30d,
        trialingSubscriptions,
        trialsExpiring7d,
        expiredTrials,
        activeSubscriptions,
        pastDueSubscriptions,
        canceledSubscriptions,
        paidConversionRate,
        mrrByCurrency,
        defaultTrialDays: trialDays,
        generatedAt: now.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const statusInput = String(req.query.status ?? '').trim();
    const take = clampInt(req.query.limit, 1, 100, 50);

    const status = parseUserStatus(statusInput);
    if (statusInput && !status) {
      res.status(400).json({ error: 'Invalid user status filter' });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q } },
                { email: { contains: q } },
                { profile: { is: { fullName: { contains: q } } } },
                { profile: { is: { phone: { contains: q } } } }
              ]
            }
          : {})
      },
      include: {
        profile: {
          select: {
            fullName: true,
            phone: true
          }
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            provider: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            monthlyRecurringCents: true,
            currency: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take
    });

    res.json({
      users: users.map(toAdminUserSummary)
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users/:userId', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.userId) },
      include: {
        profile: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        referralReceived: true,
        referralsMade: {
          select: {
            id: true,
            status: true,
            paidPeriodCount: true,
            createdAt: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        ...toAdminUserSummary(user),
        profile: user.profile,
        referralReceived: user.referralReceived,
        referralsMade: user.referralsMade
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:userId/suspend', async (req, res, next) => {
  try {
    const targetUserId = String(req.params.userId);
    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: 'You cannot suspend your own admin account' });
      return;
    }

    const reason = requireReason(req.body?.reason);
    const before = await getUserAuditSnapshot(targetUserId);
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { status: UserStatus.SUSPENDED }
    });

    await writeAudit(req, {
      targetUserId,
      action: 'USER_SUSPENDED',
      reason,
      before,
      after: user
    });

    res.json({ user: toAdminUserSummary(user) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:userId/unsuspend', async (req, res, next) => {
  try {
    const targetUserId = String(req.params.userId);
    const reason = requireReason(req.body?.reason);
    const before = await getUserAuditSnapshot(targetUserId);
    const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!existing.emailVerifiedAt) {
      res.status(409).json({ error: 'Pending users must verify email before activation' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { status: UserStatus.ACTIVE }
    });

    await writeAudit(req, {
      targetUserId,
      action: 'USER_UNSUSPENDED',
      reason,
      before,
      after: user
    });

    res.json({ user: toAdminUserSummary(user) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:userId/trial', async (req, res, next) => {
  try {
    const targetUserId = String(req.params.userId);
    const action = String(req.body?.action ?? '').trim();
    const reason = requireReason(req.body?.reason);
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true, emailVerifiedAt: true }
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user.emailVerifiedAt || user.status === UserStatus.PENDING_EMAIL_VERIFICATION) {
      res.status(409).json({ error: 'Trial access can only be granted after email verification' });
      return;
    }

    let subscription = await prisma.userSubscription.findUnique({
      where: { userId: targetUserId }
    });

    if (!subscription) {
      await createTrialSubscriptionForUser(targetUserId, now);
      subscription = await prisma.userSubscription.findUniqueOrThrow({
        where: { userId: targetUserId }
      });
    }

    const paidAndCurrent =
      subscription.status === SubscriptionStatus.ACTIVE &&
      Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd > now);
    if (paidAndCurrent) {
      res.status(409).json({
        error: 'Active paid subscriptions cannot be replaced by admin trial access'
      });
      return;
    }

    const before = serialize(subscription);
    let expiresAt: Date;
    let status = SubscriptionStatus.TRIALING;

    if (action === 'reset30') {
      expiresAt = addDays(now, trialDays);
    } else if (action === 'extend') {
      const days = clampInt(req.body?.days, 1, 365, 7);
      const base =
        subscription.trialEndsAt && subscription.trialEndsAt > now
          ? subscription.trialEndsAt
          : now;
      expiresAt = addDays(base, days);
    } else if (action === 'set') {
      expiresAt = new Date(String(req.body?.expiresAt ?? ''));
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
        res.status(400).json({ error: 'expiresAt must be a valid future date' });
        return;
      }
    } else if (action === 'end') {
      expiresAt = now;
      status = SubscriptionStatus.EXPIRED;
    } else {
      res.status(400).json({ error: 'Action must be reset30, extend, set, or end' });
      return;
    }

    const updated = await prisma.userSubscription.update({
      where: { userId: targetUserId },
      data: {
        status,
        provider: 'admin',
        trialEndsAt: expiresAt,
        currentPeriodStart: action === 'extend' ? subscription.currentPeriodStart ?? now : now,
        currentPeriodEnd: expiresAt,
        canceledAt: null
      }
    });

    await writeAudit(req, {
      targetUserId,
      action: action === 'end' ? 'TRIAL_ENDED' : 'TRIAL_CHANGED',
      reason,
      before,
      after: updated
    });

    res.json({
      subscription: updated,
      defaultTrialDays: trialDays
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:userId', async (req, res, next) => {
  try {
    const targetUserId = String(req.params.userId);
    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: 'You cannot delete your own admin account' });
      return;
    }
    if (String(req.body?.confirmation ?? '') !== 'DELETE') {
      res.status(400).json({ error: 'Type DELETE to confirm permanent account deletion' });
      return;
    }
    const reason = requireReason(req.body?.reason);
    const before = await getUserAuditSnapshot(targetUserId);
    if (!before) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const result = await deleteAccountByAdmin({
      userId: targetUserId,
      requestId: req.body?.requestId ? String(req.body.requestId) : undefined
    });

    await writeAudit(req, {
      targetUserId,
      action: 'USER_DELETED',
      reason,
      before,
      after: result
    });

    res.json({
      ...result,
      message: 'Account permanently deleted by admin.'
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/audit', async (req, res, next) => {
  try {
    const targetUserId = String(req.query.targetUserId ?? '').trim();
    const take = clampInt(req.query.limit, 1, 200, 100);
    const rows = await prisma.adminAuditLog.findMany({
      where: targetUserId ? { targetUserId } : undefined,
      orderBy: { createdAt: 'desc' },
      take
    });
    res.json({ audit: rows });
  } catch (error) {
    next(error);
  }
});

function parseUserStatus(value: string): UserStatus | null {
  if (!value) return null;
  return Object.values(UserStatus).includes(value as UserStatus) ? (value as UserStatus) : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function requireReason(value: unknown): string {
  const reason = String(value ?? '').trim();
  if (reason.length < 3) {
    const error = new Error('Admin reason is required');
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  return reason.slice(0, 500);
}

function serialize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

async function getUserAuditSnapshot(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      emailVerifiedAt: true,
      lastSeenAt: true,
      createdAt: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          provider: true,
          trialEndsAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true
        }
      }
    }
  });
}

async function writeAudit(
  req: Express.Request,
  input: {
    targetUserId?: string;
    action: string;
    reason: string;
    before: unknown;
    after: unknown;
  }
) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: req.user!.id,
      targetUserId: input.targetUserId,
      action: input.action,
      reason: input.reason,
      beforeJson: JSON.stringify(input.before ?? null),
      afterJson: JSON.stringify(input.after ?? null),
      ipAddress: req.ip || null
    }
  });
}

function toAdminUserSummary(user: any) {
  const subscription = Array.isArray(user.subscriptions)
    ? user.subscriptions[0] ?? null
    : null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile
      ? {
          fullName: user.profile.fullName,
          phone: user.profile.phone
        }
      : null,
    subscription
  };
}
