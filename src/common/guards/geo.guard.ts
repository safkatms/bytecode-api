import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { OfficeLocationRepository } from '../../modules/office-location/office-location.repository';
import { isWithinGeofence } from '../utils/geo.util';
import { ForbiddenException, BadRequestException } from '../exceptions/app.exception';

@Injectable()
export class GeoGuard implements CanActivate {
    constructor(private readonly officeLocationRepo: OfficeLocationRepository) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const { latitude, longitude } = req.body ?? {};

        if (latitude == null || longitude == null) {
            throw new BadRequestException('latitude and longitude are required');
        }

        const lat = Number(latitude);
        const lng = Number(longitude);

        const locations = await this.officeLocationRepo.findAllActive();

        if (locations.length === 0) {
            throw new ForbiddenException('No office location configured. Contact admin.');
        }

        const inside = locations.some((loc) =>
            isWithinGeofence(lat, lng, Number(loc.latitude), Number(loc.longitude), loc.radiusMeters),
        );

        if (!inside) {
            throw new ForbiddenException('You are not within an allowed office location.');
        }

        return true;
    }
}
