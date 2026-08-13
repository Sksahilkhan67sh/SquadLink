import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AppConfigService } from '../config/app-config.service';
import { JwtPayload } from '../auth/tokens.service';

export interface AuthenticatedSocket extends Socket {
  data: { user: { id: string; email: string; handle: string } };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);
    if (!token) throw new UnauthorizedException('Missing authentication token');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
      (client as AuthenticatedSocket).data.user = {
        id: payload.sub,
        email: payload.email,
        handle: payload.handle,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
