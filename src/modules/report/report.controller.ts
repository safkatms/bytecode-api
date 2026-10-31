import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReportService } from './report.service';
import { EmailAttendanceReportDto } from './dto/report.dto';
import { ApiResponse } from '../../common/response/api-response';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
    constructor(private readonly reportService: ReportService) { }

    @Post('attendance/email')
    @Roles(Role.admin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Email an attendance Excel report (Mon–Sun weeks, one tab per week) to selected users (Admin)' })
    async emailAttendance(@Body() dto: EmailAttendanceReportDto) {
        return ApiResponse.ok(await this.reportService.emailAttendanceReport(dto), 'Report sent');
    }
}
