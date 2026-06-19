import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Create a company + its first (OWNER) user, return a token. */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        users: {
          create: { email: dto.email, passwordHash, role: 'OWNER' },
        },
      },
      include: { users: true },
    });
    const user = company.users[0];
    return this.tokenFor(user.id, company.id, user.role, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokenFor(user.id, user.companyId, user.role, user.email);
  }

  private async tokenFor(
    userId: string,
    companyId: string,
    role: string,
    email: string,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      companyId,
      role,
      email,
    });
    return { accessToken, user: { id: userId, companyId, role, email } };
  }
}
