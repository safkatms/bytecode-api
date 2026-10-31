import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserService } from '../user/user.service';
import { DepartmentService } from '../department/department.service';
import { EmployeeRepository } from './employee.repository';
import { CreateEmployeeDto, EmployeeFilterDto, UpdateEmployeeDto } from './dto/employee.dto';
import { ConflictException, NotFoundException } from '../../common/exceptions/app.exception';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { MailService } from '../../common/mail/mail.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class EmployeeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly employeeRepo: EmployeeRepository,
        private readonly userService: UserService,
        private readonly departmentService: DepartmentService,
        private readonly cloudinary: CloudinaryService,
        private readonly mail: MailService,
    ) { }

    private personalData(dto: Partial<CreateEmployeeDto>) {
        return {
            ...(dto.fatherName !== undefined && { fatherName: dto.fatherName }),
            ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
            ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
            ...(dto.officeEmail !== undefined && { officeEmail: dto.officeEmail }),
            ...(dto.emergencyContactNo !== undefined && { emergencyContactNo: dto.emergencyContactNo }),
            ...(dto.presentAddress !== undefined && { presentAddress: dto.presentAddress }),
            ...(dto.permanentAddress !== undefined && { permanentAddress: dto.permanentAddress }),
            ...(dto.primeBankAccountNo !== undefined && { primeBankAccountNo: dto.primeBankAccountNo }),
        };
    }

    async uploadAvatar(id: number, file: Express.Multer.File, adminId: number) {
        if (!file) throw new BadRequestException('Image file is required');
        const emp = await this.findById(id);
        const result = await this.cloudinary.uploadImage(file.buffer, 'employee-avatars', `user-${emp.userId}`);
        await this.userService.update(emp.userId, { avatarUrl: result.secure_url, updatedBy: adminId });
        return { avatarUrl: result.secure_url };
    }

    /**
     * Creates a User account and Employee profile atomically.
     * Returns both records plus the plain-text temp password for the admin to share.
     */
    async create(dto: CreateEmployeeDto, adminId: number) {
        // Pre-flight checks outside transaction (cheaper)
        const [emailTaken, codeTaken] = await Promise.all([
            this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } }),
            this.employeeRepo.findByCode(dto.employeeCode),
        ]);
        if (emailTaken) throw new ConflictException('A user with this email already exists');
        if (codeTaken) throw new ConflictException('Employee code already in use');

        if (dto.departmentId) await this.departmentService.findById(dto.departmentId);

        const plainPassword = this.userService.generateOtp();
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        const { user, employee } = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    email: dto.email,
                    phone: dto.phone,
                    password: hashedPassword,
                    role: 'user',
                    mustChangePassword: true,
                    passwordChangedAt: new Date(),
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            });

            const employee = await tx.employee.create({
                data: {
                    userId: user.id,
                    employeeCode: dto.employeeCode,
                    departmentId: dto.departmentId ?? null,
                    designation: dto.designation,
                    joiningDate: new Date(dto.joiningDate),
                    weekendDays: dto.weekendDays ?? [5, 6],
                    ...this.personalData(dto),
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            });

            return { user, employee };
        });

        // Strip sensitive fields before returning
        const { password, refreshToken, passwordResetToken, ...safeUser } = user;

        const emailSent = await this.mail.sendAccountCreated(
            user.email,
            `${user.firstName} ${user.lastName}`.trim(),
            plainPassword,
        );

        return { user: safeUser, employee, temporaryPassword: plainPassword, emailSent };
    }

    async findAll(filter: EmployeeFilterDto) {
        return this.employeeRepo.search(filter);
    }

    async findById(id: number) {
        const emp = await this.employeeRepo.findById(id);
        if (!emp) throw new NotFoundException('Employee');
        return emp;
    }

    async findByUserId(userId: number) {
        const emp = await this.employeeRepo.findByUserId(userId);
        if (!emp) throw new NotFoundException('Employee profile');
        return emp;
    }

    async update(id: number, dto: UpdateEmployeeDto, adminId: number) {
        const emp = await this.findById(id);

        if (dto.employeeCode) {
            const existing = await this.employeeRepo.findByCode(dto.employeeCode);
            if (existing && existing.id !== id) throw new ConflictException('Employee code already in use');
        }
        if (dto.departmentId) await this.departmentService.findById(dto.departmentId);

        if (dto.officeEmail) {
            const dup = await this.prisma.employee.findFirst({ where: { officeEmail: dto.officeEmail, id: { not: id } } });
            if (dup) throw new ConflictException('Office email already in use');
        }

        // Update user fields if provided
        const userFields = ['firstName', 'lastName', 'email', 'phone'] as const;
        const hasUserUpdate = userFields.some((f) => dto[f] !== undefined);

        if (hasUserUpdate) {
            if (dto.email) {
                const existing = await this.prisma.user.findFirst({
                    where: { email: dto.email, deletedAt: null, id: { not: emp.userId } },
                });
                if (existing) throw new ConflictException('Email already in use');
            }
            await this.userService.update(emp.userId, {
                ...(dto.firstName && { firstName: dto.firstName }),
                ...(dto.lastName && { lastName: dto.lastName }),
                ...(dto.email && { email: dto.email }),
                ...(dto.phone && { phone: dto.phone }),
                updatedBy: adminId,
            });
        }

        return this.employeeRepo.update(id, {
            ...(dto.employeeCode && { employeeCode: dto.employeeCode }),
            ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
            ...(dto.designation !== undefined && { designation: dto.designation }),
            ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
            ...(dto.weekendDays !== undefined && { weekendDays: dto.weekendDays }),
            ...this.personalData(dto),
            updatedBy: adminId,
        });
    }

    async toggleActive(id: number, adminId: number) {
        const emp = await this.findById(id);
        const user = await this.userService.findById(emp.userId);
        if (!user) throw new NotFoundException('Associated user account');
        await this.userService.update(user.id, { isActive: !user.isActive });
        return this.employeeRepo.update(id, { isActive: !emp.isActive, updatedBy: adminId });
    }

    async remove(id: number, adminId: number) {
        await this.findById(id);
        await this.employeeRepo.update(id, {
            deletedAt: new Date(),
            deletedBy: adminId,
            recordStatus: 'deleted',
            updatedBy: adminId,
        });
    }
}
