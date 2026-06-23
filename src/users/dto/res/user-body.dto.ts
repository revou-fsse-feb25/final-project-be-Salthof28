import { Expose, Type } from "class-transformer";

export class UserBodyDto {
    @Expose()
    @Type(() => Number)
    id: number
    @Expose()
    @Type(() => String)
    name: string;
    @Expose()
    @Type(() => String)
    email: string;
    @Expose()
    @Type(() => String)
    phone: string;
    @Expose()
    @Type(() => String)
    status: string;
    @Expose()
    @Type(() => String)
    img_profile: string;
    @Expose()
    @Type(() => String)
    role: string
    @Expose()
    @Type(() => Date)
    created_at: Date
    @Expose()
    @Type(() => Date)
    updated_at: Date
}
