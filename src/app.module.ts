import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { appConfig, jwtConfig } from './config';
import { PrismaModule } from './database/prisma.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttendanceModule } from '@modules/attendance/attendance.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { EmployeeModule } from '@modules/employee/employee.module';
import { DeviceModule } from '@modules/device/device.module';
import { OfficeLocationModule } from '@modules/office-location/office-location.module';
import { DepartmentModule } from '@modules/department/department.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, jwtConfig],   // database config is now just DATABASE_URL in .env
    }),

    // PrismaModule is @Global() — PrismaService available everywhere
    PrismaModule,

    // Feature modules
    AuthModule,
    UserModule,
    AttendanceModule,
    DashboardModule,
    EmployeeModule,
    DeviceModule,
    OfficeLocationModule,
    DepartmentModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule { }
