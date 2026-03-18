import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: ip,
      },
    });

    return this.generateTokens(user);
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (exists) {
      throw new BadRequestException('Email já cadastrado');
    }

    const hash = await bcrypt.hash(dto.password, 10);
    // Apenas CLIENTE no cadastro público; admin/corretor criados internamente
    const role = UserRole.CLIENTE;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hash,
        name: dto.name,
        phone: dto.phone,
        role,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
      },
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.generateTokens(stored.user);
  }

  async forgotPassword(dto: { email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      return { message: 'Se o email existir, você receberá instruções' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hora

    await this.prisma.passwordResetToken.deleteMany({
      where: { email: user.email },
    });
    await this.prisma.passwordResetToken.create({
      data: { token, email: user.email, expiresAt },
    });

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const resendKey = this.config.get('RESEND_API_KEY');

    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: this.config.get('RESEND_FROM_EMAIL') || 'ImobiFlow <onboarding@resend.dev>',
          to: user.email,
          subject: 'Redefinição de senha - ImobiFlow',
          html: `
            <p>Olá,</p>
            <p>Você solicitou a redefinição de senha. Clique no link abaixo:</p>
            <p><a href="${resetLink}">Redefinir senha</a></p>
            <p>O link expira em 1 hora.</p>
            <p>Se você não solicitou, ignore este email.</p>
          `,
        });
      } catch (err) {
        console.error('Erro ao enviar email de reset:', err);
      }
    } else {
      console.log(`[DEV] Reset link for ${user.email}: ${resetLink}`);
    }

    return { message: 'Se o email existir, você receberá instruções' };
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: { token },
    });

    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { email: reset.email },
      data: { password: hash },
    });

    await this.prisma.passwordResetToken.deleteMany({ where: { token } });

    return { message: 'Senha alterada com sucesso' };
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = randomBytes(64).toString('hex');
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpires,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 min em segundos
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }
}
