import { Injectable } from "@nestjs/common";
import { AllUpdate, NewImageUrl, NewShelter, OutAccomodate, OutCareShelter, OutDetailShelter, SheltersRepositoryItf, UpdateCare, UpdateShelter } from "./shelters.repository.interface";
import { PrismaService } from "prisma/prisma.service";
import { handlePrismaError, retry } from "../global/utils/prisma.error.util";
import { Condition } from "../global/entities/condition-entity";
import { CareGive, Shelter } from "@prisma/client";
import { CreateCareDto } from "./dto/req/create-care.dto";

@Injectable()
export class SheltersRepository implements SheltersRepositoryItf {
    constructor(private readonly prisma: PrismaService){}

    async getAllShelter(query?: Condition): Promise<Shelter[]> {
        try {
            const where: Condition = {}
            if (query?.category_id) where.category_id = query.category_id;

            if (query?.low_price || query?.high_price) {
            where.price = {};
                if (query.low_price) where.price.gte = query.low_price;
                if (query.high_price) where.price.lte = query.high_price;
            }
            if(query?.farm_id) where.farm_id = query.farm_id;
            // where or
            if(query?.name || query?.location){
                where.OR = [];
                if(query.name) where.OR.push({ name: {
                        contains: query.name,
                        mode: 'insensitive'
                    } 
                });
                if(query.location) where.OR.push({ location: {
                        contains: query.location,
                        mode: 'insensitive'
                    }
                });
            }
            
            const allShelter: Shelter[] = await retry(() => this.prisma.shelter.findMany({ 
                where,
                include: { 
                    category: {
                        select: { 
                            id: true,
                            name: true
                        }
                    },
                    img_shelter: {
                        select: {
                            id: true,
                            url: true
                        }
                    },
                    care_give: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            required: true,
                            unit: true
                        }
                    }                    
                }
            }));
            return allShelter;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async getAllShelterTransaction(id?: number[]): Promise<Shelter[]> {
        try {
            const where: any = {}
            if(id) where.id = { in: id }
            const allShelter: Shelter[] = await retry(() => this.prisma.shelter.findMany({ 
                where
            }));
            return allShelter;
        } catch (error) {
            handlePrismaError(error);
        }    
    }

    async getShelter(id: number): Promise<OutDetailShelter | undefined> {
        try {
            const shelter: OutDetailShelter | null = await retry(() => this.prisma.shelter.findUnique({
                where: { id },
                include: { 
                    category: true,
                    img_shelter: { select: { url: true } },
                    farm: true,
                    care_give: true,
                }
            }));
            if(shelter === null) return undefined;
            return shelter;
        } catch (error) {
            handlePrismaError(error);
        }
    }

    async getRelationShelter(id: number): Promise<{ farm: { user_id: number } } | undefined> {
        try {
            const shelter: { farm: { user_id: number } } | null = await retry(() => this.prisma.shelter.findUnique({
                where: { id },
                select: {
                    farm: {
                        select: { user_id: true }
                    }
                }
            }));
            if(shelter === null) return undefined;
            return shelter;
        } catch (error) {
            handlePrismaError(error);
        }
    }
    
    async getAllCare(id?: number[]): Promise<OutCareShelter[]> {
        try {
            const where: any = {}
            if(id) where.id = { in: id }
            const allCare: OutCareShelter[] = await retry(() => this.prisma.careGive.findMany({
                where,
                include: {
                    shelter: {
                        select: {
                            id: true,
                            price_daily: true,
                        }
                    }
                }
            }));
            return allCare
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async getRelationCare(id: number): Promise<{ shelter: { farm: { user_id: number } } } | undefined> {
        try {
            const care = await retry(() => this.prisma.careGive.findUnique({
                where: { id },
                select: {
                    shelter: {
                        select: {
                            farm: {
                                select: { user_id: true }
                            }
                        }
                    }
                }
            }));
            if(care === null) return undefined;
            return care;
        } catch (error) {
            handlePrismaError(error);
        }
    }

    async createdShelter(newShel: NewShelter): Promise<Shelter> {
        try {
            const newShelter: Shelter = await this.prisma.shelter.create({
                data: {
                    farm_id: newShel.farm_id,
                    category_id:newShel.body.category_id,
                    name: newShel.body.name,
                    location: newShel.body.location,
                    accomodate: newShel.body.accomodate,
                    description: newShel.body.description,
                    price_daily: newShel.body.price_daily,
                }
            });
            return newShelter;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async updatedShelter(upShel: UpdateShelter): Promise<Shelter> {
        try {
            const upShelter: Shelter = await this.prisma.shelter.update({
                where: {
                    id: upShel.id
                },
                data: {
                    name: upShel.body.name,
                    location: upShel.body.location,
                    accomodate: upShel.body.accomodate,
                    description: upShel.body.description,
                    price_daily: upShel.body.price_daily,
                    updated_at: new Date()
                }
            });
            return upShelter
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async deletedShelter(id: number): Promise<Shelter> {
        try {
            const deleteShel: Shelter = await this.prisma.shelter.delete({
                where: { id }
            });
            return deleteShel;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async createdCare(body: CreateCareDto): Promise<CareGive> {
        try {
            const newCare: CareGive = await this.prisma.careGive.create({
                data: {
                    shelter_id: body.shelter_id,
                    name: body.name,
                    price: body.price,
                    unit: body.unit,
                    required: body.required
                }
            });
            return newCare
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async updatedCare(upCare: UpdateCare): Promise<CareGive> {
        try {
            const updateCare: CareGive = await this.prisma.careGive.update({
                where: { id: upCare.id },
                data: {
                    shelter_id: upCare.body.shelter_id,
                    name: upCare.body.name,
                    price: upCare.body.price,
                    unit: upCare.body.unit,
                    required: upCare.body.required
                }
            });
            return updateCare;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async deletedCare(id: number): Promise<CareGive> {
        try {
            const deleteCare: CareGive = await this.prisma.careGive.delete({
                where: { id }
            });
            return deleteCare;
        } catch (error) {
            handlePrismaError(error);
        }
    };

    async createManyImg(allUrl: NewImageUrl): Promise<number> {
        try {
            const { count } = await this.prisma.imgShelter.createMany({
                data: allUrl.body.map(imgUrl => ({
                    shelter_id: allUrl.shelter_id,
                    url: imgUrl
                }))
            });
            return count;
        } catch (error) {
            handlePrismaError(error);
        }        
    };

    async deleteManyImg(allUrl: string[]): Promise<number> {
        try {
            const { count } = await this.prisma.imgShelter.deleteMany({
                where: {
                    url: {
                        in: allUrl.map(url => url)
                    }
                }
            })
            return count;
        } catch (error) {
            handlePrismaError(error);
        }            
    };

    async getAllAccomodateShelter(id_shelter: number[]): Promise<OutAccomodate[]> {
        try {
            const shelter: OutAccomodate[] = await retry(() => this.prisma.shelter.findMany({
                where: { id: { in: id_shelter } },
                select: { id: true, accomodate: true },
            }));
            return shelter
        } catch (error) {
            handlePrismaError(error);
        }    
    }

    async updateShelterPros(allUpdate: AllUpdate) {
    try {
            const updateProses = await this.prisma.$transaction(async (tx) => {
                if(allUpdate.shelter) {
                    const shelter = await this.prisma.shelter.update({
                        where: {
                            id: allUpdate.shelter_id
                        },
                        data: {
                            name: allUpdate.shelter.name,
                            category_id: allUpdate.shelter.category_id,
                            location: allUpdate.shelter.location,
                            accomodate: allUpdate.shelter.accomodate,
                            description: allUpdate.shelter.description,
                            price_daily: allUpdate.shelter.price_daily,
                            updated_at: new Date()
                        }
                    });
                };
                // upload new image
                if(allUpdate.uploadImage) {
                    await this.prisma.imgShelter.createMany({
                        data: allUpdate.uploadImage.map(imgUrl => ({
                            shelter_id: allUpdate.shelter_id,
                            url: imgUrl
                        }))
                    });
                }; 

                // delete image
                if(allUpdate.deleteImage) {
                    await this.prisma.imgShelter.deleteMany({
                        where: {
                            id: {
                                in: allUpdate.deleteImage.map(id => id)
                            }
                        }
                    });
                };
                
                // new Care
                if(allUpdate.newCare) {
                    await this.prisma.careGive.createMany({
                        data: allUpdate.newCare.map(care => ({
                            shelter_id: allUpdate.shelter_id,
                            name: care.name,
                            price: care.price,
                            unit: care.unit,
                            required: care.required
                        }))
                    })
                }

                // update care
                if(allUpdate.updateCare) {
                    for (const care of allUpdate.updateCare){
                        await this.prisma.careGive.update({
                            where: { id: care.id },
                            data: {
                                // shelter_id: care.shelter_id,
                                name: care.name,
                                price: care.price,
                                unit: care.unit,
                                required: care.required
                            }
                        });
                    }
                }
                // delete care
                if(allUpdate.deleteCare) {
                    const ids = allUpdate.deleteCare.map(id => Number(id));
                    await this.prisma.careGive.deleteMany({
                        where: {
                            id: {
                                in: ids
                            }
                        }
                    });
                }
                return {
                    success: true,
                    updatedFields: Object.keys(allUpdate.shelter || {}),
                    newImages: allUpdate.uploadImage?.length || 0,
                    deletedImages: allUpdate.deleteImage?.length || 0,
                    newCareCount: allUpdate.newCare?.length || 0,
                    updatedCareCount: allUpdate.updateCare?.length || 0,
                    deletedCareCount: allUpdate.deleteCare?.length || 0
                }
            });
            return updateProses;
        } catch (error) {
            handlePrismaError(error);
        }
    }
}