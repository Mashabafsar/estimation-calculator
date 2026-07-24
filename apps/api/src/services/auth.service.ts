import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { config } from '../config/index.js';
import type { UserRole } from '@prisma/client';

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError('Invalid credentials', 401);

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) throw new AppError('Email already in use', 409);
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
}
