import { Injectable } from "@nestjs/common";
import { BuildingFarm, FarmsRepositoryItf, UpdateFarm } from "./farms.repository.interface";
import { PrismaService } from "prisma/prisma.service";
import { Farms } from "@prisma/client";
import { Condition } from "../global/entities/condition-entity";
import { handlePrismaError, retry } from "src/global/utils/prisma.error.util";

@Injectable()
export class FarmsRepository implements FarmsRepositoryItf {
    constructor(private readonly prisma: PrismaService){}

    async getAll(query?: Condition): Promise<Farms[]> {
        try {
            const where: Condition = {};
            if(query?.name || query?.location || query?.rating) {
                where.OR = [];
                if(query.name) where.OR.push({name: {
                        contains: query.name,
                        mode: 'insensitive'
                    }
                });
                if(query.location) where.OR.push({ location: query.location });
                if(query.rating) where.OR.push({ rating: query.rating });
            };
            const allFarms: Farms[] = await retry(() => this.prisma.farms.findMany({
                where,
                include: {
                    shelters: {
                        select: {
                            name: true,
                            accomodate: true,
                            price_daily: true
                        }
                    },
                    livestock: {
                        select: {
                            name: true,
                            stock: true,
                            price: true
                        }
                    }
                }
            }));
            return allFarms;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async getFarm(id: number): Promise<Farms | undefined> {
        try {
            const farm: Farms | null = await retry(() => this.prisma.farms.findUnique({
                where: { id }
            }));
            if(farm === null) return undefined;
            return farm;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async getShelterFarm(id: number): Promise<Farms | undefined> {
        try {
            const farm: Farms | null = await retry(() => this.prisma.farms.findUnique({
                where: { id },
                include: {shelters: {
                    include: { 
                        care_give: true,
                        transaction: {
                            select: {
                                start_date: true,
                                finish_date: true,
                                total_livestock: true
                            }
                        },
                        img_shelter: true
                    }
                }}
            }));
            if(farm === null) return undefined;
            return farm;
        } catch (error) {
            handlePrismaError(error);
        }
    }

    async getFarmByUserId(user_id: number): Promise<Farms | undefined> {
        try {
            const farm: Farms | null = await retry(() => this.prisma.farms.findUnique({
                where: { user_id }
            }));
            if(farm === null) return undefined;
            return farm;
        } catch (error) {
            handlePrismaError(error);
        }
    }

    async created(farm: BuildingFarm): Promise<Farms> {
        try {
            const createFarm: Farms = await this.prisma.farms.create({
                data: {
                    user_id: farm.user_id,
                    name: farm.body.name,
                    location: farm.body.location,
                    img_farm: farm.body.img_farm,
                    status_farm: 'ACTIVE'
                }
            });
            return createFarm;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async updated(farm: UpdateFarm): Promise<Farms> {
        try {
            const updateFarm: Farms = await this.prisma.farms.update({
                where: { user_id: farm.id },
                data: {
                    name: farm.body.name,
                    location: farm.body.location,
                    img_farm: farm.body.img_farm,
                    updated_at: new Date()
                }
            });
            return updateFarm;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async updatedByAdmin(farm: UpdateFarm): Promise<Farms> {
        try {
            const updateFarm: Farms = await this.prisma.farms.update({
                where: { id: farm.id },
                data: {
                    name: farm.body.name,
                    location: farm.body.location,
                    img_farm: farm.body.img_farm,
                    status_farm: farm.body.status_farm,
                    updated_at: new Date()
                }
            });
            return updateFarm;
        } catch (error) {
            handlePrismaError(error);
        }
    }

    async deleted(id: number): Promise<Farms> {
        try {
            const deleteFarm: Farms = await this.prisma.farms.delete({ where: { id } });
            return deleteFarm;
        } catch (error) {
            handlePrismaError(error);
        }
    };
}